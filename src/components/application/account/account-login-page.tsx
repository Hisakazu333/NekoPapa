import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AuthCard, AuthMediaCarousel } from "@/components/application/auth/auth-card";
import { AccountCredentialsForm } from "./account-credentials-form";
import { AccountPageFrame } from "./account-page-frame";
import { AccountScan, useAccountScan } from "./account-scan";
import { useAccountSession } from "./account-session";
import { AccountSetup, accountSetupText, type AccountSetupStatus } from "./account-setup";

const COMPANION_ART = [
  { src: "/characters/lumia-avatar.jpg" },
  { src: "/characters/rinne-avatar.webp" },
];

type SetupStep = "nickname" | "password";

/**
 * Sign-in and sign-up share one page: an unregistered number verified by SMS
 * becomes a new account, which then gets first-run setup before returning.
 */
export function AccountLoginPage({ onBack, fromProfile }: { onBack: () => void; fromProfile: boolean }) {
  const { availability, profile } = useAccountSession();
  const [mode, setMode] = useState<"signin" | "scan">("signin");
  const [consent, setConsent] = useState(false);
  const [setup, setSetup] = useState<{ status: AccountSetupStatus; step: SetupStep }>();
  const scan = useAccountScan();
  const userId = profile?.userId;
  // Read through a ref: a new onBack must not re-check setup and restart it.
  const back = useRef(onBack);
  back.current = onBack;

  useEffect(() => {
    if (userId === undefined) return;
    let active = true;
    void invoke<AccountSetupStatus>("account_setup_status")
      .then((status) => { if (active) status.pending ? setSetup({ status, step: "nickname" }) : back.current(); })
      .catch(() => { if (active) back.current(); });
    return () => { active = false; };
  }, [userId]);

  const changeMode = (next: typeof mode) => {
    if (mode === "scan") scan.stop();
    setMode(next);
    if (next === "scan") void scan.start();
  };
  const leave = () => {
    if (setup) void invoke("account_setup_dismiss").catch(() => {});
    onBack();
  };

  const destination = fromProfile ? "个人资料" : "工作区";
  const copy = setup ? accountSetupText(setup.step) : mode === "scan"
    ? { title: "扫码登录 NekoPapa", description: "使用手机上的 NekoBuddy 登录这台设备。" }
    : { title: "登录或注册 NekoPapa", description: "未注册的手机号验证后将自动创建账号。" };
  const frameKey = setup ? `setup-${setup.step}` : mode;
  return <AccountPageFrame key={frameKey} title={copy.title} onBack={leave} backLabel={`返回${destination}`}>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-8 pt-4">
      {(profile && !setup) || availability === "checking"
        ? <p role="status" className="m-auto text-body-regular text-text-secondary">
          {profile ? `已登录，正在返回${destination}…` : "正在检查登录状态…"}
        </p>
        : <div className="my-auto">
          <AuthCard
            centered
            providers={[]}
            logo={<img src="/brand/nekopapa-app-icon-v1-128.png" alt="" className="size-12 rounded-2xl object-contain" />}
            title={copy.title}
            className="mx-auto"
            media={<AuthMediaCarousel slides={COMPANION_ART} />}
            description={copy.description}
            form={setup
              ? <AccountSetup status={setup.status} step={setup.step} onDone={onBack}
                onStep={(step) => setSetup({ ...setup, step })} />
              : mode === "scan" ? <AccountScan scan={scan} onBack={() => changeMode("signin")} />
              : <AccountCredentialsForm consent={consent} onConsentChange={setConsent} onScan={() => changeMode("scan")} />}
          />
        </div>}
    </div>
  </AccountPageFrame>;
}
