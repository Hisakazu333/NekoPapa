import { useEffect, useRef, useState } from "react";
import { profileIdentity } from "@/app/account/profile-identity";
import { ProfileActivityCard } from "@/components/application/settings/profile/profile-activity-card";
import { ProfileEditForm } from "@/components/application/settings/profile/profile-edit-form";
import { ProfileWebsite } from "@/components/application/settings/profile/profile-header";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { AlertDialog, Modal, ModalHeader, ModalTrigger } from "@/components/base/modal/modal";
import { PencilIcon, UserIcon } from "@/components/foundations/icons/app-icons";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { AccountPageFrame } from "./account-page-frame";
import { AccountAvatarEditor } from "./account-avatar-editor";
import { useAccountSession } from "./account-session";

export function AccountProfilePage({ onBack, onLogin, editAvatar }: { onBack: () => void; onLogin: () => void; editAvatar?: boolean }) {
  const { profile: local } = useLocalProfile();
  const { profile, availability, signOut } = useAccountSession();
  const identity = profileIdentity(local, profile);
  const [signOutError, setSignOutError] = useState("");
  const sessionAction = useRef<HTMLButtonElement>(null);
  const restoreSignOutFocus = useRef(false);
  const website = local.website.trim();
  const bio = local.biography.trim();
  const avatar = <Avatar size="lg" src={identity.avatarUrl} alt=""
    fallback={<UserIcon aria-hidden className="size-9" />}
    className="size-20 rounded-3xl bg-background-tertiary-hover text-display-4-semibold text-text-primary sm:size-24" />;
  const accountDetails = [
    { label: "套餐", value: profile?.cloudPlanCode },
    { label: "云点余额", value: profile?.cloudPointBalance?.toLocaleString() },
  ].filter(({ value }) => value !== undefined);
  useEffect(() => {
    if (profile || !restoreSignOutFocus.current) return;
    restoreSignOutFocus.current = false;
    const frame = window.requestAnimationFrame(() => sessionAction.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [profile]);
  const editAction = <ModalTrigger>
    <Button size="small" variant="ghost" leadingIcon={PencilIcon}
      className="bg-transparent text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary active:bg-background-tertiary-hover">
      编辑
    </Button>
    <Modal isDismissable={false}>
      {({ close }) => <>
        <ModalHeader title="编辑本机资料" />
        <ProfileEditForm onDone={close} />
      </>}
    </Modal>
  </ModalTrigger>;

  return <AccountPageFrame title="个人资料" onBack={onBack} actions={editAction}>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-8 px-5 pb-14 pt-6 sm:px-9 sm:pt-10">
        <section aria-labelledby="account-profile-name" className="flex min-w-0 flex-col items-center gap-3 text-center">
          {profile ? <AccountAvatarEditor userId={profile.userId} key={profile.userId} initiallyOpen={editAvatar}>{avatar}</AccountAvatarEditor> : avatar}
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <h1 id="account-profile-name" translate="no" className="max-w-full wrap-anywhere text-title-1-semibold sm:text-display-4-semibold">
              {identity.name}
            </h1>
            {identity.handle && <p translate="no" className="max-w-full wrap-anywhere text-body-regular text-text-secondary">{identity.handle}</p>}
            {!profile && <Badge>本机资料</Badge>}
          </div>
          {bio && <p className="mt-1 max-w-prose whitespace-pre-wrap wrap-anywhere text-body-regular text-text-secondary">{bio}</p>}
          {website && <ProfileWebsite website={website} />}
        </section>

        <ProfileActivityCard standalone />

        <section aria-labelledby="profile-session-title" className="flex flex-col gap-4 border-t border-separator-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="profile-session-title" className="text-headline-medium">NekoPapa 账号</h2>
            {profile ? <ModalTrigger>
              <Button variant="secondary" size="small" onClick={() => setSignOutError("")}>退出登录</Button>
              <AlertDialog title="退出登录？" description="退出后需要重新登录才能使用小屋和账号服务。本机资料和聊天记录会保留。"
                confirmLabel="退出登录" cancelLabel="取消" pendingLabel="正在退出…" onConfirm={async () => {
                  setSignOutError("");
                  try {
                    restoreSignOutFocus.current = true;
                    await signOut();
                  }
                  catch (failure) {
                    restoreSignOutFocus.current = false;
                    setSignOutError(typeof failure === "string" ? failure : "退出失败，请重试。");
                    throw failure;
                  }
                }}>
                {signOutError && <p role="alert" className="text-body-2-regular text-text-error-primary">{signOutError}</p>}
              </AlertDialog>
            </ModalTrigger> : availability !== "checking" &&
              <Button ref={sessionAction} variant="secondary" size="small" onClick={onLogin}>登录 NekoPapa</Button>}
          </div>
          {accountDetails.length > 0 && <dl className="grid gap-4 sm:grid-cols-2">
            {accountDetails.map(({ label, value }) => <div key={label} className="flex items-baseline justify-between gap-3 rounded-xl bg-background-secondary-default px-4 py-3">
              <dt className="text-body-2-regular text-text-secondary">{label}</dt>
              <dd translate="no" className="wrap-anywhere text-body-medium tabular-nums">{value}</dd>
            </div>)}
          </dl>}
          {!profile && <p role="status" className="text-body-2-regular text-text-secondary">
            {availability === "checking" ? "正在检查登录状态…" : "登录后可在这里查看账号套餐和云点余额。"}
          </p>}
        </section>
      </div>
    </div>
  </AccountPageFrame>;
}
