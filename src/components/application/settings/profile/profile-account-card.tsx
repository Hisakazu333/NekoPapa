import { RiArrowRightUpLine } from "@remixicon/react";
import { desktopAccountApi } from "@/app/desktop-account-api";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Button } from "@/components/base/buttons/button";

/**
 * NekoPapa account status. While the account service is closed it says so
 * and links to the real login page, which shows the same unavailable state;
 * no NekoID, plan or cloud-point values are shown before a real sign-in.
 */
export function ProfileAccountCard({ onOpenLogin }: { onOpenLogin: () => void }) {
  const closed = desktopAccountApi.availability.kind === "disabled";
  return (
    <section aria-labelledby="profile-account-title" className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id="profile-account-title" className="text-body-medium text-text-primary">NekoPapa 账号</h3>
          <p className="flex items-center gap-2 text-body-2-regular text-text-secondary">
            <StatusDot color="yellow" />
            {closed ? "官方账号服务暂未开放" : "未登录"}
          </p>
        </div>
        <Button variant="secondary" size="small" trailingIcon={RiArrowRightUpLine} onClick={onOpenLogin}>
          {closed ? "查看登录页" : "登录"}
        </Button>
      </div>
      <p className="text-body-2-regular text-text-secondary">
        {closed
          ? "账号服务正在重构，当前版本不会连接认证服务器。开放并登录后，这里显示 NekoID、套餐和云点余额，上方的名称与头像也会使用账号资料。"
          : "登录后，这里显示 NekoID、套餐和云点余额，上方的名称与头像也会使用账号资料。"}
      </p>
      <p className="text-body-2-regular text-text-tertiary">本机资料、聊天记录和自定义 API 配置始终保存在此设备。</p>
    </section>
  );
}
