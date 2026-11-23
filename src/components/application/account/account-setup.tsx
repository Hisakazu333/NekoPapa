import { useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseDesktopAccountProfile } from "@/app/account/desktop-account-contract";
import { nicknameProblem, passwordProblem } from "@/app/account/account-setup-rules";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { InputOtp } from "@/components/base/input-otp/input-otp";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { useAccountSession } from "./account-session";
import { useCodeCountdown } from "./use-code-countdown";

export interface AccountSetupStatus { pending: boolean; maskedMobile?: string }

const errorText = (error: unknown, fallback: string) => typeof error === "string" ? error : fallback;
const STEP_TEXT = {
  nickname: { title: "欢迎来到 NekoPapa", description: "账号已创建。先取一个昵称，之后可以在个人资料中修改。" },
  password: { title: "设置登录密码", description: "设置后也可以用手机号和密码登录。可以跳过，以后继续用短信验证码。" },
} as const;

export function accountSetupText(step: keyof typeof STEP_TEXT) { return STEP_TEXT[step]; }

/**
 * First-run setup for a new account: a nickname, then an optional password.
 * Every step can be skipped; finishing or skipping returns to the workspace.
 */
export function AccountSetup({ status, step, onStep, onDone }: {
  status: AccountSetupStatus;
  step: keyof typeof STEP_TEXT;
  onStep: (step: keyof typeof STEP_TEXT) => void;
  onDone: () => void;
}) {
  const finish = () => { void invoke("account_setup_dismiss").catch(() => {}).finally(onDone); };
  return step === "nickname"
    ? <NicknameStep onNext={() => onStep("password")} />
    : <PasswordStep maskedMobile={status.maskedMobile} onDone={finish} />;
}

function NicknameStep({ onNext }: { onNext: () => void }) {
  const { profile, setProfile } = useAccountSession();
  const [nickname, setNickname] = useState(profile?.userName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const problem = nicknameProblem(nickname);
    if (problem) { setError(problem); return; }
    if (nickname.trim() === profile?.userName) { onNext(); return; }
    setSaving(true);
    setError("");
    try {
      setProfile(parseDesktopAccountProfile(await invoke("account_update_nickname", { nickname })));
      onNext();
    } catch (failure) {
      setError(errorText(failure, "昵称未保存，请重试。"));
      setSaving(false);
    }
  };

  return <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
    <Input label="昵称" name="nickname" autoComplete="nickname" maxLength={32} value={nickname}
      onChange={(value) => { setNickname(value); setError(""); }} isDisabled={saving} autoFocus
      isInvalid={Boolean(error)} errorMessage={error} hint="最多 32 个字符" />
    <Button type="submit" className="w-full" disabled={saving}>
      {saving && <SpinnerGlyph size="xs" />}
      {saving ? "正在保存…" : "下一步"}
    </Button>
    <Button type="button" variant="ghost" className="w-full" disabled={saving} onClick={onNext}>暂时跳过</Button>
  </form>;
}

function PasswordStep({ maskedMobile, onDone }: { maskedMobile?: string; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState<"code" | "submit">();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const countdown = useCodeCountdown();

  const sendCode = async () => {
    if (pending || countdown.remaining) return;
    setPending("code");
    setError("");
    try {
      await invoke("account_send_password_code");
      countdown.start();
      setNotice(`验证码已发送至 ${maskedMobile ?? "注册手机号"}。`);
    } catch (failure) {
      setError(errorText(failure, "发送验证码失败，请重试。"));
    } finally {
      setPending(undefined);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (code.length !== 6) { setError("请输入 6 位短信验证码。"); return; }
    const problem = passwordProblem(password, confirmation);
    if (problem) { setError(problem); return; }
    setPending("submit");
    setError("");
    try {
      await invoke("account_set_password", { code, password });
      onDone();
    } catch (failure) {
      setError(errorText(failure, "密码未设置，请重试。"));
      setPending(undefined);
    }
  };

  return <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
    <div className="flex items-end gap-2">
      <Input label="手机号" value={maskedMobile ?? "注册手机号"} isReadOnly className="min-w-0 flex-1" />
      <Button type="button" variant="secondary" className="h-9 shrink-0" onClick={() => void sendCode()}
        disabled={Boolean(pending) || countdown.remaining > 0}>
        {pending === "code" ? "正在发送…" : countdown.remaining ? `${countdown.remaining} 秒后重发` : "获取验证码"}
      </Button>
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="text-body-medium text-text-primary">短信验证码</span>
      <InputOtp aria-label="短信验证码" value={code} onChange={setCode} isDisabled={pending === "submit"} />
    </div>
    <Input label="新密码" name="new-password" type="password" autoComplete="new-password" maxLength={32}
      value={password} onChange={setPassword} isDisabled={pending === "submit"} hint="6–32 个字符" />
    <Input label="确认密码" name="confirm-password" type="password" autoComplete="new-password" maxLength={32}
      value={confirmation} onChange={setConfirmation} isDisabled={pending === "submit"} />
    {notice && <p role="status" className="text-body-2-regular text-text-secondary">{notice}</p>}
    {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
    <Button type="submit" className="w-full" disabled={Boolean(pending)}>
      {pending === "submit" && <SpinnerGlyph size="xs" />}
      {pending === "submit" ? "正在设置…" : "完成"}
    </Button>
    <Button type="button" variant="ghost" className="w-full" disabled={pending === "submit"} onClick={onDone}>
      暂不设置，进入 NekoPapa
    </Button>
  </form>;
}
