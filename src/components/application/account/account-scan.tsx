import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import { parseDesktopAccountProfile } from "@/app/account/desktop-account-contract";
import { Button } from "@/components/base/buttons/button";
import { LinkButton } from "@/components/base/buttons/link-button";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { useAccountSession } from "./account-session";

interface DeviceCode { qrText: string; expireSeconds: number; pollIntervalMs: number }
type ScanState =
  | { kind: "idle" | "starting" }
  | { kind: "waiting" | "scanned"; qrText: string }
  | { kind: "ended"; message: string };

export function useAccountScan() {
  const { availability, setProfile } = useAccountSession();
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const current = useRef<string>(null);
  const timer = useRef<number>(undefined);

  const stop = () => {
    window.clearTimeout(timer.current);
    const attempt = current.current;
    current.current = null;
    if (attempt) void invoke("account_cancel", { attempt }).catch(() => {});
  };

  useEffect(() => stop, []);

  const start = async () => {
    if (availability !== "available") return;
    stop();
    const attempt = crypto.randomUUID();
    current.current = attempt;
    setState({ kind: "starting" });
    const end = (message: string) => {
      if (current.current !== attempt) return;
      stop();
      setState({ kind: "ended", message });
    };
    const fail = (error: unknown) => end(typeof error === "string" ? error : "无法完成扫码登录，请重新获取二维码。");

    try {
      const code = await invoke<DeviceCode>("account_device_start", { attempt });
      if (current.current !== attempt) return;
      const deadline = Date.now() + code.expireSeconds * 1000;
      const poll = async () => {
        if (current.current !== attempt) return;
        if (Date.now() >= deadline) { end("二维码已过期，请重新获取。"); return; }
        try {
          const result = await invoke<{ status: string; profile?: unknown }>("account_device_poll", { attempt });
          if (current.current !== attempt) return;
          switch (result.status) {
            case "CONFIRMED": {
              const profile = parseDesktopAccountProfile(result.profile);
              current.current = null;
              setProfile(profile);
              break;
            }
            case "WAITING":
            case "SCANNED":
              setState({ kind: result.status === "SCANNED" ? "scanned" : "waiting", qrText: code.qrText });
              schedule();
              break;
            case "CANCELED":
              end("手机端已取消登录。");
              break;
            case "EXPIRED":
              end("二维码已过期，请重新获取。");
              break;
            default:
              end("二维码已使用或不可用，请重新获取。");
          }
        } catch (error) { fail(error); }
      };
      const schedule = () => { timer.current = window.setTimeout(() => void poll(), Math.max(0, Math.min(code.pollIntervalMs, deadline - Date.now()))); };
      setState({ kind: "waiting", qrText: code.qrText });
      schedule();
    } catch (error) { fail(error); }
  };

  return { state, start, stop };
}

export function AccountScan({ scan, onBack }: { scan: ReturnType<typeof useAccountScan>; onBack: () => void }) {
  const { availability } = useAccountSession();
  const { state } = scan;
  return <div className="flex flex-col items-center gap-4 text-center">
    {(state.kind === "waiting" || state.kind === "scanned") &&
      <QRCodeSVG value={state.qrText} size={164} marginSize={4} title="NekoBuddy 扫码登录二维码" className="rounded-xl" />}
    <p role="status" className="flex items-center justify-center gap-2 text-body-2-regular text-text-secondary">
      {state.kind === "starting" && <><SpinnerGlyph size="xs" />正在获取二维码…</>}
      {state.kind === "waiting" && "打开 NekoBuddy，扫描后在手机上确认。"}
      {state.kind === "scanned" && "已扫描，请在手机上确认登录。"}
      {state.kind === "ended" && state.message}
      {state.kind === "idle" && (availability === "browser" ? "请在 NekoPapa 桌面应用中使用扫码登录。" :
        availability === "unconfigured" ? "此桌面版本尚未配置官方账号服务地址。" : "使用已登录的 NekoBuddy 确认本次登录。")}
    </p>
    {availability === "available" && (state.kind === "idle" || state.kind === "ended") &&
      <Button className="w-full" onClick={() => void scan.start()}>{state.kind === "ended" ? "重新获取二维码" : "获取二维码"}</Button>}
    <LinkButton onClick={onBack}>返回手机号登录</LinkButton>
  </div>;
}
