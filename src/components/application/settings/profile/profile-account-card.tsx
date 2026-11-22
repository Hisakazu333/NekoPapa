import { ArrowUpRightIcon } from "@/components/foundations/icons/app-icons";
import { useAccountSession } from "@/components/application/account/account-session";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Button } from "@/components/base/buttons/button";

export function ProfileAccountCard({ onOpenLogin }: { onOpenLogin: () => void }) {
  const { availability, profile } = useAccountSession();
  const status = profile ? "已登录" : availability === "available" ? "未登录" : "官方账号服务未连接";
  return <section aria-labelledby="profile-account-title" className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 id="profile-account-title" className="text-body-medium text-text-primary">NekoPapa 账号</h3>
        <p className="flex items-center gap-2 text-body-2-regular text-text-secondary">
          <StatusDot color={profile ? "green" : "yellow"} />{status}
        </p>
      </div>
      <Button variant="secondary" size="small" trailingIcon={ArrowUpRightIcon} onClick={onOpenLogin}>
        {profile ? "打开个人资料" : "登录或注册"}
      </Button>
    </div>
    {profile?.cloudPointBalance !== undefined && <p className="text-body-2-regular text-text-secondary">
      云点余额 <span className="text-body-2-medium text-text-primary">{profile.cloudPointBalance.toLocaleString()}</span>
    </p>}
    <p className="text-body-2-regular text-text-tertiary">本机资料、聊天记录和自定义 API 配置始终保存在此设备。</p>
  </section>;
}
