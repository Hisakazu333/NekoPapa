import { useEffect, useRef } from "react";
import { RiArrowLeftLine, RiCloudLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { desktopAccountApi } from "@/app/desktop-account-api";

export function AccountLoginPage({ onBack }: { onBack: () => void }) {
  const pageRef = useRef<HTMLElement>(null);
  const connection = desktopAccountApi.availability;

  useEffect(() => {
    pageRef.current?.focus();
  }, []);

  return (
    <main
      ref={pageRef}
      tabIndex={-1}
      aria-labelledby="account-login-title"
      className="fixed inset-0 z-[120] flex min-h-0 flex-col bg-background-full text-text-primary outline-none"
    >
      <header className="flex h-14 shrink-0 items-center border-b border-separator-border px-4 sm:px-6">
        <Button variant="ghost" size="small" leadingIcon={RiArrowLeftLine} onClick={onBack}>
          返回工作区
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-10">
        <section className="w-full max-w-[480px]">
          <div className="mb-7 flex items-center gap-3">
            <img src="/brand/nekopapa-app-icon-v1-128.png" alt="" className="size-10 rounded-xl object-contain" />
            <span className="text-title-3-medium text-text-primary">NekoPapa</span>
          </div>
          <h1 id="account-login-title" className="text-title-1-semibold text-text-primary">登录 NekoPapa</h1>
          <p className="mt-2 text-body-regular text-text-secondary">登录后可使用 NekoPapa 官方账号服务。</p>
          <div role="status" className="mt-7 flex gap-4 rounded-2xl border border-separator-border bg-background-primary-default p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background-secondary-default">
              <RiCloudLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-body-medium text-text-primary">
                {connection.kind === "disabled" ? "官方账号服务暂未开放" : "桌面登录尚未启用"}
              </p>
              <p className="mt-1 text-body-regular text-text-secondary">
                {connection.kind === "disabled"
                  ? "账号服务正在重构，当前版本不会连接认证服务器或收集登录凭据。"
                  : "当前桌面端尚未启用登录流程。"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-body-2-regular text-text-tertiary">本机资料、聊天记录和自定义 API 配置仍保存在此设备。</p>
          <div className="mt-7">
            <Button disabled className="w-full">
              {connection.kind === "disabled" ? "登录暂未开放" : "桌面登录尚未启用"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
