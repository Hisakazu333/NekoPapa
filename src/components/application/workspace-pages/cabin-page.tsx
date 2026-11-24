import { useRef, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { HouseIcon, MenuIcon } from "@/components/foundations/icons/app-icons";
import { useAccountPageNavigation } from "../account/account-page-provider";
import { useAccountSession } from "../account/account-session";
import { ToolbarIconButton } from "../dashboard/toolbar-icon-button";
import { CabinCompanions } from "./cabin-companions";
import { CabinModelStage } from "./cabin-model-stage";

export function CabinPage({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAccountSession();
  const accountPage = useAccountPageNavigation();
  const cabin = useRef<HTMLElement>(null);
  const companionButton = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<{ userId: number; key: string } | null>(null);
  const selected = preview && preview.userId === profile?.userId ? preview.key : null;
  return <section ref={cabin} tabIndex={-1} aria-label="小屋" className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-separator-border bg-background-primary-default outline-none">
    <header className="flex h-12 shrink-0 items-center gap-2 px-4">
      {onNavigate && <ToolbarIconButton icon={MenuIcon} label="打开导航" onPress={onNavigate} className="lg:hidden" />}
      <HouseIcon className="size-4 text-foreground-icon-secondary" aria-hidden /><h1 className="text-body-medium text-text-primary">小屋</h1>
      {profile && <div className="ms-auto flex items-center gap-1.5">
        {selected && <Button size="small" variant="ghost" onClick={() => {
          setPreview(null);
          companionButton.current?.focus();
        }}>回到当前同伴</Button>}
        <CabinCompanions key={profile.userId} selected={selected} trigger={companionButton}
          onSelect={(key) => setPreview(key ? { userId: profile.userId, key } : null)} />
      </div>}
    </header>
    {profile ? <CabinModelStage key={profile.userId} companionKey={selected} /> : <div className="m-auto flex max-w-sm flex-col items-center gap-3 px-6 pb-12 text-center">
      <h2 className="text-title-3-medium text-text-primary">登录后进入小屋</h2>
      <p className="text-body-regular text-text-secondary">小屋使用当前账号绑定的同伴和模型。</p>
      <Button onClick={(event) => accountPage.open("login", event.currentTarget, cabin.current)}>登录 NekoPapa</Button>
    </div>}
  </section>;
}
