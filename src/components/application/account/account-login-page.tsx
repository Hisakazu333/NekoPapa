import { useEffect, useRef } from "react";
import { RiArrowLeftLine, RiExternalLinkLine } from "@remixicon/react";
import { desktopAccountApi } from "@/app/desktop-account-api";
import { AuthCard, AuthMediaCarousel } from "@/components/application/auth/auth-card";
import { Button } from "@/components/base/buttons/button";
import { StatusDot } from "@/components/base/badges/status-dot";

const COMPANIONS = [
  { src: "/characters/lumia-avatar.jpg", alt: "" },
  { src: "/characters/rinne-avatar.webp", alt: "" },
];

/**
 * The login page, built on BoardUI's Auth Card (split layout, companion art
 * on the right). NekoPapa signs in by device authorization: the app opens a
 * confirmation page in the browser, so there are no email, password or
 * provider fields. While the account backend is closed the action stays
 * disabled with the real reason; nothing is requested or stored.
 */
export function AccountLoginPage({ onBack }: { onBack: () => void }) {
  const pageRef = useRef<HTMLElement>(null);
  const connection = desktopAccountApi.availability;
  const closed = connection.kind === "disabled";

  useEffect(() => {
    pageRef.current?.focus();
  }, []);

  return (
    <main
      ref={pageRef}
      tabIndex={-1}
      aria-label="登录 NekoPapa"
      className="fixed inset-0 z-[120] flex min-h-0 flex-col bg-background-full text-text-primary outline-none"
    >
      <header className="flex h-14 shrink-0 items-center px-4 sm:px-6">
        <Button variant="ghost" size="small" leadingIcon={RiArrowLeftLine} onClick={onBack}>
          返回工作区
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 pb-14 pt-4">
        <AuthCard
          centered
          providers={[]}
          logo={<img src="/brand/nekopapa-app-icon-v1-128.png" alt="" className="size-12 rounded-2xl object-contain" />}
          title="登录 NekoPapa"
          description="登录后，在这台设备上使用 NekoPapa 官方账号服务。"
          media={<AuthMediaCarousel slides={COMPANIONS} />}
          footnote="本机资料、聊天记录和自定义 API 配置仍保存在此设备，登录与否都不受影响。"
          form={<>
            <div role="status" className="flex gap-3 rounded-2xl bg-background-secondary-default p-4">
              <StatusDot color="yellow" className="mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-body-medium text-text-primary">{closed ? "官方账号服务暂未开放" : "桌面登录尚未启用"}</p>
                <p className="mt-1 text-body-2-regular text-text-secondary">
                  {closed ? "账号服务正在重构，当前版本不会连接认证服务器或收集登录凭据。" : "当前桌面端尚未启用登录流程。"}
                </p>
              </div>
            </div>
            <Button disabled className="w-full" trailingIcon={RiExternalLinkLine}>在浏览器中登录</Button>
            <p className="text-center text-caption-1-regular text-text-tertiary">
              开放后，NekoPapa 会在浏览器中打开确认页面，不需要在这里输入密码。
            </p>
          </>}
        />
      </div>
    </main>
  );
}
