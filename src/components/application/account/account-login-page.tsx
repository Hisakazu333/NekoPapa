import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon } from "@/components/foundations/icons/app-icons";
import { AuthCard, AuthMediaCarousel } from "@/components/application/auth/auth-card";
import { Button } from "@/components/base/buttons/button";
import { isMacTauriWindow, useMacWindowFullscreen } from "@/components/application/dashboard/mac-window-frame";
import { cx } from "@/utils/cx";
import { AccountCredentialsForm } from "./account-credentials-form";
import { AccountScan, useAccountScan } from "./account-scan";
import { useAccountSession } from "./account-session";

const COMPANIONS = [
  { src: "/characters/lumia-avatar.jpg", alt: "" },
  { src: "/characters/rinne-avatar.webp", alt: "" },
];

export function AccountLoginPage({ onBack }: { onBack: () => void }) {
  const pageRef = useRef<HTMLElement>(null);
  const { profile } = useAccountSession();
  const [mode, setMode] = useState<"signin" | "signup" | "scan">("signin");
  const scan = useAccountScan();
  const signup = mode === "signup";
  const title = profile ? "NekoPapa 账号" : signup ? "注册 NekoPapa" : mode === "scan" ? "扫码登录 NekoPapa" : "登录 NekoPapa";
  const changeMode = (next: typeof mode) => {
    if (mode === "scan") scan.stop();
    setMode(next);
    pageRef.current?.focus();
    if (next === "scan") void scan.start();
  };
  // The page covers the window, title bar included: on macOS the back button
  // starts after the traffic lights, and the empty bar still drags the window.
  const macWindow = isMacTauriWindow();
  const fullscreen = useMacWindowFullscreen(macWindow);

  useEffect(() => {
    pageRef.current?.focus();
  }, []);

  return (
    <main
      ref={pageRef}
      tabIndex={-1}
      aria-label={title}
      className="fixed inset-0 z-[120] flex min-h-0 flex-col bg-background-full text-text-primary outline-none"
    >
      {/* macOS: the 40px title bar stays an empty drag strip for the traffic
          lights; the back button sits on its own row below it. */}
      {macWindow && !fullscreen && <div data-tauri-drag-region aria-hidden className="h-10 shrink-0" />}
      <header data-tauri-drag-region={macWindow || undefined}
        className={cx("flex h-14 shrink-0 items-center px-4 sm:px-6", macWindow && "h-12")}>
        <Button variant="ghost" size="small" leadingIcon={ArrowLeftIcon} onClick={onBack}>
          返回工作区
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8 pt-4">
        <div className="my-auto"><AuthCard
          centered
          providers={[]}
          logo={<img src="/brand/nekopapa-app-icon-v1-128.png" alt="" className="size-12 rounded-2xl object-contain" />}
          title={title}
          mode={signup ? "signup" : "signin"}
          className="mx-auto"
          description={profile ? "管理这台设备上的登录状态。" : signup
            ? "用短信验证码验证手机号，即可创建账号。"
            : mode === "scan" ? "使用手机上的 NekoBuddy 登录这台设备。" : "登录后，在这台设备上使用官方账号服务。"}
          media={<AuthMediaCarousel slides={COMPANIONS} />}
          footnote="本机资料、聊天记录和自定义 API 配置仍保存在此设备，登录与否都不受影响。"
          form={profile ? <SignedInAccount onBack={onBack} onSignedOut={() => changeMode("signin")} />
            : mode === "scan" ? <AccountScan scan={scan} onBack={() => changeMode("signin")} />
            : <AccountCredentialsForm key={mode} signup={signup} onScan={() => changeMode("scan")}
              onSwitch={() => changeMode(signup ? "signin" : "signup")} />}
        /></div>
      </div>
    </main>
  );
}


function SignedInAccount({ onBack, onSignedOut }: { onBack: () => void; onSignedOut: () => void }) {
  const { profile, signOut } = useAccountSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!profile) return null;
  return <>
    <dl className="flex flex-col gap-2 rounded-2xl bg-background-secondary-default p-4 text-body-2-regular text-text-secondary">
      <div className="flex justify-between gap-3"><dt>账号</dt><dd translate="no" className="text-text-primary">{profile.userName || profile.nekoId || profile.userId}</dd></div>
      {profile.cloudPlanCode && <div className="flex justify-between gap-3"><dt>套餐</dt><dd translate="no" className="text-text-primary">{profile.cloudPlanCode}</dd></div>}
      {profile.cloudPointBalance !== undefined && <div className="flex justify-between gap-3"><dt>云点余额</dt><dd className="text-text-primary">{profile.cloudPointBalance.toLocaleString()}</dd></div>}
    </dl>
    {error && <p role="alert" className="text-body-2-regular text-text-error-primary">{error}</p>}
    <Button onClick={onBack}>进入工作区</Button>
    <Button variant="secondary" disabled={busy} onClick={() => {
      setBusy(true);
      setError("");
      void signOut().then(onSignedOut).catch((failure: unknown) => {
        setError(typeof failure === "string" ? failure : "退出失败，请重试。");
        setBusy(false);
      });
    }}>{busy ? "正在退出…" : "退出账号"}</Button>
  </>;
}
