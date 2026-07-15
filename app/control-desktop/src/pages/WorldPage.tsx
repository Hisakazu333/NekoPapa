import { useState } from "react";
import {
  Activity,
  Bluetooth,
  Bot,
  Camera,
  Cpu,
  Mic,
  Radar,
  RefreshCw,
  Router,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { EmptyState, PageHeading, Toggle } from "../components/ui";

type WorldSection = "perception" | "devices" | "automation";

export function WorldPage() {
  const [section, setSection] = useState<WorldSection>("perception");
  const [microphone, setMicrophone] = useState(false);
  const [camera, setCamera] = useState(false);
  const [scanResult, setScanResult] = useState("尚未扫描");

  return (
    <div className="page world-page">
      <PageHeading
        eyebrow="现实接口"
        title="世界"
        description="管理环境感知、附近设备和自动化边界。"
        actions={
          <button type="button" className="button button--secondary" onClick={() => setScanResult("未发现可用设备") }>
            <RefreshCw size={15} />扫描设备
          </button>
        }
      />

      <div className="world-workspace">
        <aside className="section-nav">
          <button className={section === "perception" ? "is-active" : ""} onClick={() => setSection("perception")}><Radar size={16} />环境感知</button>
          <button className={section === "devices" ? "is-active" : ""} onClick={() => setSection("devices")}><Router size={16} />设备</button>
          <button className={section === "automation" ? "is-active" : ""} onClick={() => setSection("automation")}><Workflow size={16} />自动化</button>
        </aside>

        <section className="world-content">
          {section === "perception" ? (
            <>
              <div className="section-heading"><div><h2>环境感知</h2><p>权限默认关闭，由用户逐项启用。</p></div><ShieldAlert size={18} /></div>
              <div className="settings-group">
                <div className="setting-row">
                  <span className="setting-row__icon"><Mic size={17} /></span>
                  <span className="setting-row__copy"><strong>麦克风</strong><small>用于语音输入与声音事件检测</small></span>
                  <span className="setting-row__control"><Toggle checked={microphone} onChange={setMicrophone} label="麦克风权限" /></span>
                </div>
                <div className="setting-row">
                  <span className="setting-row__icon"><Camera size={17} /></span>
                  <span className="setting-row__copy"><strong>摄像头</strong><small>用于明确触发的视觉感知任务</small></span>
                  <span className="setting-row__control"><Toggle checked={camera} onChange={setCamera} label="摄像头权限" /></span>
                </div>
                <div className="setting-row">
                  <span className="setting-row__icon"><Activity size={17} /></span>
                  <span className="setting-row__copy"><strong>系统活动</strong><small>当前应用与空闲状态</small></span>
                  <span className="setting-row__control"><span className="state-badge">未授权</span></span>
                </div>
              </div>
            </>
          ) : null}

          {section === "devices" ? (
            <>
              <div className="section-heading"><div><h2>附近设备</h2><p>{scanResult}</p></div><Bluetooth size={18} /></div>
              <div className="device-list">
                <div className="device-row"><span><Cpu size={18} /></span><div><strong>NekoLink 网关</strong><small>等待本地发现服务</small></div><span className="state-badge">离线</span></div>
                <div className="device-row"><span><Bot size={18} /></span><div><strong>IoT 执行器</strong><small>尚未绑定设备</small></div><span className="state-badge">未配置</span></div>
              </div>
            </>
          ) : null}

          {section === "automation" ? (
            <>
              <div className="section-heading"><div><h2>自动化</h2><p>由事件和明确授权的动作组成。</p></div><Workflow size={18} /></div>
              <EmptyState icon={<Workflow size={24} />} title="没有自动化任务" detail="当前没有已启用的触发器。" />
            </>
          ) : null}
        </section>

        <aside className="event-stream">
          <div className="context-panel__header"><Radar size={16} /><h2>事件流</h2></div>
          <EmptyState icon={<Activity size={21} />} title="等待事件" detail="环境事件会在这里按时间出现。" />
        </aside>
      </div>
    </div>
  );
}
