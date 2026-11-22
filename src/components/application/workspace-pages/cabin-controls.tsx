import { Button } from "@/components/base/buttons/button";
import { Popover, PopoverTrigger } from "@/components/base/popover/popover";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { CameraIcon, ImageIcon, WandSparklesIcon } from "@/components/foundations/icons/app-icons";
import { cx } from "@/utils/cx";
import type { CabinFraming } from "./live2d-preview";

export type CabinBackground = "light" | "plain";

const gestures = [
  { label: "打招呼", aliases: ["MioGreeting", "Wave", "WaveR"] },
  { label: "点头", aliases: ["Nod", "MioListenAck"] },
  { label: "开心", aliases: ["Happy", "MioHappyNews"] },
];

export function CabinControls({ motions, framing, background, onFraming, onBackground, onMotion }: {
  motions: string[];
  framing: CabinFraming;
  background: CabinBackground;
  onFraming: (mode: CabinFraming) => void;
  onBackground: (mode: CabinBackground) => void;
  onMotion: (motion: string) => void;
}) {
  const actions = gestures.flatMap(({ label, aliases }) => {
    const motion = aliases.find((alias) => motions.includes(alias));
    return motion ? [{ label, motion }] : [];
  });
  const button = "bg-transparent text-text-primary hover:bg-background-secondary-hover active:bg-background-tertiary-hover";
  return <div role="group" aria-label="小屋控制" className="flex items-center gap-0.5 rounded-2xl border border-border-button-default bg-background-primary-default/95 p-1 shadow-sm backdrop-blur">
    {actions.length > 0 && <PopoverTrigger>
      <Button variant="ghost" size="small" className={button} leadingIcon={WandSparklesIcon}>互动</Button>
      <Popover placement="top end" aria-label="互动动作" className="w-40" dialogClassName="p-0">
        {({ close }) => <div className="flex flex-col">
          {actions.map(({ label, motion }) => <Button key={motion} variant="ghost" size="small"
            className={cx(button, "justify-start")} onClick={() => { close(); onMotion(motion); }}>{label}</Button>)}
        </div>}
      </Popover>
    </PopoverTrigger>}
    <PopoverTrigger>
      <Button variant="ghost" size="small" className={button} leadingIcon={CameraIcon}>镜头</Button>
      <Popover placement="top end" aria-label="角色镜头" className="w-auto" dialogClassName="p-0">
        <SegmentedControl aria-label="取景" selectedKeys={[framing]} onSelectionChange={(keys) => {
          onFraming(keys.has("close") ? "close" : "full");
        }}>
          <SegmentedControlItem id="full">全身</SegmentedControlItem>
          <SegmentedControlItem id="close">近景</SegmentedControlItem>
        </SegmentedControl>
      </Popover>
    </PopoverTrigger>
    <PopoverTrigger>
      <Button variant="ghost" size="small" className={button} leadingIcon={ImageIcon}>背景</Button>
      <Popover placement="top end" aria-label="小屋背景" className="w-auto" dialogClassName="p-0">
        <SegmentedControl aria-label="背景样式" selectedKeys={[background]} onSelectionChange={(keys) => {
          onBackground(keys.has("plain") ? "plain" : "light");
        }}>
          <SegmentedControlItem id="light">柔光</SegmentedControlItem>
          <SegmentedControlItem id="plain">纯色</SegmentedControlItem>
        </SegmentedControl>
      </Popover>
    </PopoverTrigger>
  </div>;
}
