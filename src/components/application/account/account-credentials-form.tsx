import { useEffect, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogInIcon, ScanLineIcon } from "@/components/foundations/icons/app-icons";
import { parseDesktopAccountProfile } from "@/app/account/desktop-account-contract";
import { accountPhoneNumber, DEFAULT_PHONE_REGION, detectPhoneRegion, phoneRegionName } from "@/app/account/phone-regions";
import { useApplicationLanguage } from "@/components/application/language/application-language";
import { Button } from "@/components/base/buttons/button";
import { Divider } from "@/components/base/divider/divider";
import { LinkButton } from "@/components/base/buttons/link-button";
import { SocialButton } from "@/components/base/social-button/social-button";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { AccountConsent } from "./account-consent";
import { useAccountSession } from "./account-session";
import { PhoneRegionPicker } from "./phone-region-picker";
import { useCodeCountdown } from "./use-code-countdown";

const errorText = (error: unknown, fallback: string) => typeof error === "string" ? error : fallback;
export const CONSENT_REQUIRED = "请先阅读并同意《用户协议》和《隐私政策》。";

/**
 * One form for signing in and signing up: an unregistered number verified by
 * SMS becomes a new account, so there is no separate sign-up page. SMS is the
 * default; a password works once the account has one.
 */
export function AccountCredentialsForm({ consent, onConsentChange, onScan }: {
  consent: boolean;
  onConsentChange: (accepted: boolean) => void;
  onScan: () => void;
}) {
  const { availability, setProfile } = useAccountSession();
  const { language } = useApplicationLanguage();
  const [method, setMethod] = useState<"password" | "sms">("sms");
  const [region, setRegion] = useState(DEFAULT_PHONE_REGION);
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"code" | "submit">();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [consentMissing, setConsentMissing] = useState(false);
  const countdown = useCodeCountdown();
  const live = useRef(true);
  const attempt = useRef<string>(null);
  const available = availability === "available";
  const busy = !available || Boolean(pending);
  const sms = method === "sms";
  const phone = accountPhoneNumber(region, mobile);
  const resetPhoneFeedback = () => { setCode(""); setNotice(""); setError(""); };
  const requireConsent = () => {
    if (consent) return true;
    setConsentMissing(true);
    setError(CONSENT_REQUIRED);
    return false;
  };

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (attempt.current) void invoke("account_cancel", { attempt: attempt.current }).catch(() => {});
    };
  }, []);

  const sendCode = async () => {
    if (busy || countdown.remaining || !phone || !requireConsent()) return;
    setPending("code");
    setError("");
    setNotice("");
    try {
      await invoke("account_send_code", { mobile: phone });
      if (!live.current) return;
      countdown.start();
      setNotice("验证码已发送。");
    } catch (failure) {
      if (live.current) setError(errorText(failure, "发送验证码失败，请重试。"));
    } finally {
      if (live.current) setPending(undefined);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!phone) { setError(`请输入有效的${phoneRegionName(region, language)}手机号。`); return; }
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (sms && code.length !== 6) { setError("请输入 6 位短信验证码。"); return; }
    if (!sms && !password) { setError("请输入密码。"); return; }
    if (!requireConsent()) return;
    const id = crypto.randomUUID();
    attempt.current = id;
    setPending("submit");
    setError("");
    try {
      const raw = await invoke("account_sign_in", {
        attempt: id, credentials: sms ? { method, mobile: phone, code } : { method, mobile: phone, password },
      });
      if (!live.current) return;
      const profile = parseDesktopAccountProfile(raw);
      attempt.current = null;
      setProfile(profile);
    } catch (failure) {
      if (live.current) {
        setError(errorText(failure, "无法完成登录，请重试。"));
        void invoke("account_cancel", { attempt: id }).catch(() => {});
      }
    } finally {
      if (live.current) { attempt.current = null; setPending(undefined); }
    }
  };

  return <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
    <div className="flex items-end gap-2">
      <Input label="手机号" name="mobile" type="tel" autoComplete="tel" placeholder="手机号"
        className="min-w-0 flex-1" maxLength={20} value={mobile} isRequired isDisabled={busy}
        onChange={(value) => {
          const detected = detectPhoneRegion(value, region);
          if (detected) setRegion(detected.regionId);
          setMobile(detected?.national ?? value);
          resetPhoneFeedback();
        }}
        leadingAddon={<PhoneRegionPicker value={region} isDisabled={busy}
          onChange={(next) => { setRegion(next); resetPhoneFeedback(); }} />} />
      {sms && <Button type="button" variant="secondary" className="h-9 shrink-0" onClick={() => void sendCode()}
        disabled={busy || !phone || countdown.remaining > 0}>
        {pending === "code" ? "正在发送…" : countdown.remaining ? `${countdown.remaining} 秒后重发` : "获取验证码"}
      </Button>}
    </div>
    {sms
      ? <div className="flex flex-col gap-1.5">
        <span className="text-body-medium text-text-primary">短信验证码</span>
        <InputOtp aria-label="短信验证码" value={code} onChange={setCode} isDisabled={busy} />
      </div>
      : <Input label="密码" name="password" type="password" autoComplete="current-password"
        placeholder="输入账号密码" maxLength={256} isRequired isDisabled={busy} />}
    <AccountConsent accepted={consent} invalid={consentMissing && !consent} isDisabled={Boolean(pending)}
      onChange={(accepted) => {
        onConsentChange(accepted);
        if (accepted) { setConsentMissing(false); if (error === CONSENT_REQUIRED) setError(""); }
      }} />
    {availability !== "available" && <p role="status" className="text-body-2-regular text-text-secondary">
      {availability === "checking" ? "正在检查账号服务配置…" : availability === "browser"
        ? "请在 NekoPapa 桌面应用中使用官方账号。"
        : "此桌面版本尚未配置官方账号服务地址。"}
    </p>}
    {notice && <p role="status" className="text-body-2-regular text-text-secondary">{notice}</p>}
    {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
    <Button type="submit" className="w-full" disabled={busy}
      leadingIcon={pending === "submit" ? undefined : LogInIcon}>
      {pending === "submit" && <SpinnerGlyph size="xs" />}
      {pending === "submit" ? "正在验证…" : sms ? "登录 / 注册" : "登录"}
    </Button>
    <div className="flex justify-center">
      <LinkButton type="button" disabled={Boolean(pending)} onClick={() => {
        setMethod(sms ? "password" : "sms");
        setCode("");
        setError("");
        setNotice("");
      }}>{sms ? "使用密码登录" : "使用短信验证码登录或注册"}</LinkButton>
    </div>
    <Divider contentClassName="text-caption-1-regular">其他登录方式</Divider>
    <SocialButton brand="custom" config={{ label: "NekoBuddy", icon: <ScanLineIcon aria-hidden className="size-full" /> }}
      type="button" appearance="white" fullWidth disabled={Boolean(pending)} onClick={() => { if (requireConsent()) onScan(); }}>
      用 NekoBuddy 扫码登录
    </SocialButton>
    {/* Not connected yet: the account service has no Google or GitHub sign-in. */}
    <div className="grid grid-cols-2 gap-2">
      <SocialButton brand="google" type="button" appearance="white" fullWidth disabled aria-describedby="account-third-party-status">Google</SocialButton>
      <SocialButton brand="github" type="button" appearance="white" fullWidth disabled aria-describedby="account-third-party-status">GitHub</SocialButton>
    </div>
    <p id="account-third-party-status" className="-mt-2 text-center text-caption-1-regular text-text-tertiary">
      Google 与 GitHub 登录暂未开放
    </p>
  </form>;
}
