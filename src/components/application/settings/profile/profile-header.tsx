import type { Ref } from "react";
import { Link2Icon, PencilIcon, UserIcon } from "@/components/foundations/icons/app-icons";
import type { LocalProfile } from "@/app/account/local-profile";
import type { ProfileIdentity } from "@/app/account/profile-identity";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";

export function ProfileWebsite({ website }: { website: string }) {
  let url: URL;
  try {
    url = new URL(website);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return <a href={url.href} target="_blank" rel="noreferrer"
    className="inline-flex max-w-full items-center gap-1.5 rounded-md text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
    <Link2Icon className="size-4 shrink-0" aria-hidden />
    <span translate="no" className="truncate">{url.host}{url.pathname === "/" ? "" : url.pathname}</span>
  </a>;
}

/**
 * Identity card: cover band, large avatar, name, NekoID or local-profile note,
 * plan badge, introduction and website. A signed-in account fills the same
 * slots (see `profileIdentity`), so the layout does not change at sign-in.
 */
export function ProfileHeader({ identity, profile, onEdit, editRef }: {
  identity: ProfileIdentity;
  profile: LocalProfile;
  onEdit: () => void;
  editRef?: Ref<HTMLButtonElement>;
}) {
  const signedIn = identity.source === "account";
  const biography = profile.biography.trim();
  const website = profile.website.trim();
  return (
    <section aria-labelledby="profile-identity-name" className="overflow-hidden rounded-2xl border border-separator-border bg-background-full">
      <div aria-hidden className="h-24 bg-linear-to-br from-accent-500/30 via-accent-300/15 to-background-secondary-default" />
      <div className="px-5 pb-5">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <Avatar
            size="lg"
            color="blue"
            src={identity.avatarUrl}
            alt={identity.name}
            fallback={<UserIcon className="size-9" aria-hidden />}
            className="size-20 text-title-1-semibold ring-4 ring-background-full"
          />
          <Button ref={editRef} variant="secondary" size="small" leadingIcon={PencilIcon} onClick={onEdit}>
            {signedIn ? "编辑本机资料" : "编辑资料"}
          </Button>
        </div>
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h3 id="profile-identity-name" translate="no" className="min-w-0 break-words text-title-2-semibold text-text-primary">{identity.name}</h3>
          {identity.plan
            ? <Badge color="primary" translate="no">{identity.plan}</Badge>
            : <Badge>{signedIn ? "NekoPapa 账号" : "本机资料"}</Badge>}
        </div>
        <p className="mt-0.5 text-body-regular text-text-secondary">
          {identity.handle ?? (signedIn ? "已登录" : "未登录 · 名称和介绍只保存在此设备")}
        </p>
        {biography
          ? <p className="mt-3 whitespace-pre-wrap break-words text-body-regular text-text-primary">{biography}</p>
          : <button type="button" onClick={onEdit}
            className="mt-3 cursor-pointer rounded-md text-start text-body-regular text-text-tertiary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring">
            添加一段介绍…
          </button>}
        {website && <div className="mt-2"><ProfileWebsite website={website} /></div>}
      </div>
    </section>
  );
}
