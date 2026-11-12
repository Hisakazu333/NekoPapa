import {
  BookOpenIcon, BotIcon, ChartColumnIcon, CodeIcon, CompassIcon, DatabaseIcon, FileCodeIcon, GitBranchIcon, GlobeIcon,
  HistoryIcon, LayersIcon, LibraryIcon, LightbulbIcon, LinkIcon, ListChecksIcon, MapIcon, MessagesSquareIcon,
  NotebookPenIcon, PaletteIcon, PlugIcon, PuzzleIcon, SparkleIcon, StickyNoteIcon, TerminalIcon, WrenchIcon,
} from "@/components/foundations/icons/app-icons";
import type { PluginIconName } from "@/app/plugins/plugin-manifest";

/** The host's icon for each name a plugin manifest may use; plugins never ship their own SVG. */
export const PLUGIN_ICONS: Record<PluginIconName, typeof PuzzleIcon> = {
  puzzle: PuzzleIcon, plug: PlugIcon, "notebook-pen": NotebookPenIcon, "book-open": BookOpenIcon, library: LibraryIcon,
  code: CodeIcon, "file-code": FileCodeIcon, terminal: TerminalIcon, "git-branch": GitBranchIcon, globe: GlobeIcon,
  link: LinkIcon, history: HistoryIcon, layers: LayersIcon, "list-checks": ListChecksIcon, lightbulb: LightbulbIcon,
  wrench: WrenchIcon, bot: BotIcon, database: DatabaseIcon, "chart-column": ChartColumnIcon,
  "messages-square": MessagesSquareIcon, palette: PaletteIcon, sparkle: SparkleIcon, compass: CompassIcon, map: MapIcon,
  "sticky-note": StickyNoteIcon,
};

export const pluginIcon = (name: PluginIconName | undefined) => PLUGIN_ICONS[name ?? "puzzle"];
