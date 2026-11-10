import { useEffect, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogInIcon, ScanLineIcon } from "@/components/foundations/icons/app-icons";
import { parseDesktopAccountProfile } from "@/app/desktop-account-contract";
import { Button } from "@/components/base/buttons/button";
import { Divider } from "@/components/base/divider/divider";
import { LinkButton } from "@/components/base/buttons/link-button";
import { SocialButton } from "@/components/base/social-button/social-button";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { useAccountSession } from "./account-session";

const MOBILE = /^1[0-9]{10}$/;
const errorText = (error: unknown, fallback: string) => typeof error === "string" ? error : fallback;

export function AccountCredentialsForm({ signup, onSwitch, onScan }: { signup: boolean; onSwitch: () => void; onScan: () => void }) {
  const { availability, setProfile } = useAccountSession();
  const [method, setMethod] = useState<"password" | "sms">(signup ? "sms" : "password");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"code" | "submit">();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [lastCodeAt, setLastCodeAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const live = useRef(true);
  const attempt = useRef<string>(null);
  const remaining = Math.max(0, Math.ceil((lastCodeAt + 60_000 - now) / 1000));
  const available = availability === "available";
  const sms = method === "sms";
  const phone = mobile.trim();

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (attempt.current) void invoke("account_cancel", { attempt: attempt.current }).catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!lastCodeAt) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lastCodeAt + 60_000) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lastCodeAt]);

  const sendCode = async () => {
    if (!available || pending || remaining || !MOBILE.test(phone)) return;
    setPending("code");
    setError("");
    setNotice("");
    try {
      await invoke("account_send_code", { mobile: phone });
      if (!live.current) return;
      const sent = Date.now();
      setNow(sent);
      setLastCodeAt(sent);
      setNotice("验证码已发送。");
    } catch (failure) {
      if (live.current) setError(errorText(failure, "发送验证码失败，请重试。"));
    } finally {
      if (live.current) setPending(undefined);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!available || pending) return;
    if (!MOBILE.test(phone)) { setError("请输入有效的 11 位中国大陆手机号。"); return; }
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (sms && code.length !== 6) { setError("请输入 6 位短信验证码。"); return; }
    if (!sms && !password) { setError("请输入密码。"); return; }
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
    <Input label="手机号" name="mobile" type="tel" autoComplete="tel-national" placeholder="中国大陆手机号"
      maxLength={11} value={mobile} isRequired isDisabled={!available || Boolean(pending)}
      onChange={(value) => { setMobile(value); setCode(""); setNotice(""); setError(""); }} />
    {sms ? <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-body-medium text-text-primary">短信验证码</span>
          <InputOtp aria-label="短信验证码" value={code} onChange={setCode} isDisabled={!available || Boolean(pending)} />
        </div>
        <Button type="button" variant="secondary" size="small" onClick={() => void sendCode()}
          disabled={!available || !MOBILE.test(phone) || Boolean(pending) || remaining > 0}>
          {pending === "code" ? "正在发送…" : remaining ? `${remaining} 秒后重发` : "获取验证码"}
        </Button>
      </div>
      <p className="text-caption-1-regular text-text-secondary">首次验证手机号会创建账号，已注册的手机号直接登录。</p>
    </> : <Input label="密码" name="password" type="password" autoComplete="current-password"
      placeholder="输入账号密码" maxLength={256} isRequired isDisabled={!available || Boolean(pending)} />}
    {availability !== "available" && <p role="status" className="text-body-2-regular text-text-secondary">
      {availability === "checking" ? "正在检查账号服务配置…" : availability === "browser"
        ? "请在 NekoPapa 桌面应用中使用官方账号。"
        : "此桌面版本尚未配置官方账号服务地址。"}
    </p>}
    {notice && <p role="status" className="text-body-2-regular text-text-secondary">{notice}</p>}
    {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
    <Button type="submit" className="w-full" disabled={!available || Boolean(pending)}
      leadingIcon={pending === "submit" ? undefined : LogInIcon}>
      {pending === "submit" && <SpinnerGlyph size="xs" />}
      {pending === "submit" ? "正在验证…" : signup ? "验证并注册" : "登录"}
    </Button>
    {!signup && <>
      <div className="flex justify-center">
        <LinkButton type="button" disabled={Boolean(pending)} onClick={() => {
          setMethod(sms ? "password" : "sms");
          setCode("");
          setError("");
          setNotice("");
        }}>{sms ? "使用密码登录" : "使用短信验证码登录"}</LinkButton>
      </div>
      <Divider contentClassName="text-caption-1-regular">其他登录方式</Divider>
      <SocialButton brand="custom" config={{ label: "NekoBuddy", icon: <ScanLineIcon aria-hidden className="size-full" /> }}
        type="button" appearance="white" fullWidth disabled={Boolean(pending)} onClick={onScan}>
        用 NekoBuddy 扫码登录
      </SocialButton>
    </>}
    <p className="text-center text-body-2-regular text-text-secondary">
      {signup ? "已有账号？" : "第一次使用？"}{" "}
      <LinkButton type="button" disabled={Boolean(pending)} onClick={onSwitch}>{signup ? "返回登录" : "注册账号"}</LinkButton>
    </p>
  </form>;
}
