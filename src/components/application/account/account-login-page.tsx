import { useEffect, useState } from "react";
import { AuthCard, AuthMediaCarousel } from "@/components/application/auth/auth-card";
import { AccountCredentialsForm } from "./account-credentials-form";
import { AccountPageFrame } from "./account-page-frame";
import { AccountScan, useAccountScan } from "./account-scan";
import { useAccountSession } from "./account-session";

const COMPANION_ART = [
  { src: "/characters/lumia-avatar.jpg" },
  { src: "/characters/rinne-avatar.webp" },
];

export function AccountLoginPage({ onBack, fromProfile }: { onBack: () => void; fromProfile: boolean }) {
  const { availability, profile } = useAccountSession();
  const [mode, setMode] = useState<"signin" | "signup" | "scan">("signin");
  const scan = useAccountScan();
  const signup = mode === "signup";
  const title = signup ? "注册 NekoPapa" : mode === "scan" ? "扫码登录 NekoPapa" : "登录 NekoPapa";

  useEffect(() => { if (profile) onBack(); }, [profile, onBack]);

  const changeMode = (next: typeof mode) => {
    if (mode === "scan") scan.stop();
    setMode(next);
    if (next === "scan") void scan.start();
  };

  const destination = fromProfile ? "个人资料" : "工作区";
  return <AccountPageFrame key={mode} title={title} onBack={onBack} backLabel={`返回${destination}`}>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8 pt-4">
      {profile || availability === "checking"
        ? <p role="status" className="m-auto text-body-regular text-text-secondary">
          {profile ? `已登录，正在返回${destination}…` : "正在检查登录状态…"}
        </p>
        : <div className="my-auto">
          <AuthCard
            centered
            providers={[]}
            logo={<img src="/brand/nekopapa-app-icon-v1-128.png" alt="" className="size-12 rounded-2xl object-contain" />}
            title={title}
            mode={signup ? "signup" : "signin"}
            className="mx-auto"
            media={<AuthMediaCarousel slides={COMPANION_ART} />}
            description={signup ? "用短信验证码验证手机号，即可创建账号。"
              : mode === "scan" ? "使用手机上的 NekoBuddy 登录这台设备。" : "登录后可使用小屋和官方账号服务。"}
            form={mode === "scan" ? <AccountScan scan={scan} onBack={() => changeMode("signin")} />
              : <AccountCredentialsForm key={mode} signup={signup} onScan={() => changeMode("scan")}
                onSwitch={() => changeMode(signup ? "signin" : "signup")} />}
          />
        </div>}
    </div>
  </AccountPageFrame>;
}
