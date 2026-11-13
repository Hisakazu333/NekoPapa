import type { ComponentType, SVGProps } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Bell, Book, BookOpen, BookUser, Bot, Brain, Camera, ChevronUp, GripHorizontal,
  ChartColumn, ChartPie, Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Eye, EyeOff,
  CircleCheck, CircleHelp, CircleStop, Cloud, CloudUpload, Code, Compass, Contact, Copy, Cpu,
  Command, CornerDownLeft, Crosshair, Database, Delete, Download, Ellipsis, EllipsisVertical, ExternalLink, File,
  FileArchive, FileAudio, FileBraces, FileCode, FileCog, FileDiff, FileImage, FileLock, FileSearch, FileSpreadsheet, FileText, FileVideo, Folder, FolderOpen, FolderPlus, GitBranch, GitMerge, Globe,
  GraduationCap, History, House, Image, ImagePlus, Info, Keyboard, Languages, Laptop, Layers,
  LayoutGrid, LayoutPanelLeft, Library, Lightbulb, Link, Link2, List, ListChecks, LogIn,
  Mail, MailCheck, MailOpen, Map, Menu, MessageCircle, MessageCircleHeart, MessageSquareText,
  MessageSquareWarning, MessagesSquare, Mic, Minus, Monitor, Moon,
  NotebookPen, Palette, PanelLeft, PanelLeftClose, PanelLeftOpen, PanelRight, PanelTop,
  Paperclip, Pencil, Presentation, PencilLine, Pin, PinOff, Plug, Plus, Puzzle, RectangleHorizontal,
  RefreshCw, RotateCcw, Search, Settings, Settings2, ShieldAlert, ShieldCheck,
  ScanLine, ShieldEllipsis, ShieldUser, Smartphone, Smile, Sparkle, Square, SquarePen, SquareTerminal,
  StickyNote, Sun, Tablet, Terminal, Trash2, Undo2, Upload, User, UserCog, UserPlus, Users,
  Volume2, VolumeX, WandSparkles, Webhook, Workflow, Wrench, X, Zap,
  type LucideIcon, type LucideProps,
} from "lucide-react";

/**
 * The app's functional icons: Lucide outlines with a 1.5 stroke on their 24
 * grid, so the line scales with the icon (about 1px at 16px, 1.25px at 20px)
 * and stays fine at the sizes the app uses. Pages import
 * icons from here, never from lucide-react directly, so the stroke stays one
 * decision. Provider logos and illustrations keep their own assets.
 */
export type AppIcon = ComponentType<LucideProps>;
export const ICON_STROKE = 1.5;

function outline(Icon: LucideIcon, filled = false): AppIcon {
  function AppIconComponent(props: LucideProps) {
    return <Icon strokeWidth={ICON_STROKE} {...(filled ? { fill: "currentColor" } : {})} {...props} />;
  }
  AppIconComponent.displayName = `${Icon.displayName ?? "Icon"}Icon`;
  return AppIconComponent;
}

/** GitHub's mark (Octicons `mark-github`, MIT); Lucide no longer ships brand logos. */
export function GithubIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor" aria-hidden className={className} {...props}>
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
  </svg>;
}

/**
 * NekoPapa's 批注 mark: a rounded tag whose sharp corner points at what it
 * marks, with a pen inside. The browser's annotation cursor and pins use the
 * same tag (TAG in src-tauri/src/browser_pick.js), so the tool reads as its
 * own thing rather than the system pointer. Drawn on Lucide's 24 grid and stroke.
 */
export function AnnotateIcon({ className, strokeWidth = ICON_STROKE, ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} {...props}>
    <path d="M8 3.5h8.5a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9.5L4 21V7.5a4 4 0 0 1 4-4z" />
    <path d="m9.5 13.5.7-2.3 3.9-3.9a1.06 1.06 0 0 1 1.5 1.5l-3.9 3.9z" />
  </svg>;
}

/** Filled where the solid shape is the meaning: a pinned item, the stop button. */
export const PinFilledIcon = outline(Pin, true);
export const StopFilledIcon = outline(Square, true);

export const ArrowLeftIcon = outline(ArrowLeft);
export const ArrowRightIcon = outline(ArrowRight);
export const ArrowDownIcon = outline(ArrowDown);
export const ArrowUpIcon = outline(ArrowUp);
export const ArrowUpRightIcon = outline(ArrowUpRight);
export const BellIcon = outline(Bell);
export const BookIcon = outline(Book);
export const BookOpenIcon = outline(BookOpen);
export const BookUserIcon = outline(BookUser);
export const BotIcon = outline(Bot);
export const CameraIcon = outline(Camera);
export const ChevronUpIcon = outline(ChevronUp);
export const GripHorizontalIcon = outline(GripHorizontal);
export const ChartColumnIcon = outline(ChartColumn);
export const ChartPieIcon = outline(ChartPie);
export const BrainIcon = outline(Brain);
export const CheckIcon = outline(Check);
export const CommandIcon = outline(Command);
export const CornerDownLeftIcon = outline(CornerDownLeft);
export const ChevronDownIcon = outline(ChevronDown);
export const ChevronLeftIcon = outline(ChevronLeft);
export const ChevronRightIcon = outline(ChevronRight);
export const CircleAlertIcon = outline(CircleAlert);
export const CircleCheckIcon = outline(CircleCheck);
export const CircleHelpIcon = outline(CircleHelp);
export const CircleStopIcon = outline(CircleStop);
export const CloudIcon = outline(Cloud);
export const CloudUploadIcon = outline(CloudUpload);
export const CodeIcon = outline(Code);
export const CompassIcon = outline(Compass);
export const ContactIcon = outline(Contact);
export const CopyIcon = outline(Copy);
export const CpuIcon = outline(Cpu);
export const CrosshairIcon = outline(Crosshair);
export const DatabaseIcon = outline(Database);
export const DeleteIcon = outline(Delete);
export const DownloadIcon = outline(Download);
export const EllipsisIcon = outline(Ellipsis);
export const EllipsisVerticalIcon = outline(EllipsisVertical);
export const ExternalLinkIcon = outline(ExternalLink);
export const FileIcon = outline(File);
export const FileLockIcon = outline(FileLock);
export const FileArchiveIcon = outline(FileArchive);
export const FileAudioIcon = outline(FileAudio);
export const FileCodeIcon = outline(FileCode);
export const FileSpreadsheetIcon = outline(FileSpreadsheet);
export const FileVideoIcon = outline(FileVideo);
export const PresentationIcon = outline(Presentation);
export const FileTextIcon = outline(FileText);
export const FileSearchIcon = outline(FileSearch);
export const FolderIcon = outline(Folder);
export const FolderOpenIcon = outline(FolderOpen);
export const FolderPlusIcon = outline(FolderPlus);
export const GitBranchIcon = outline(GitBranch);
export const GitMergeIcon = outline(GitMerge);
export const GlobeIcon = outline(Globe);
export const GraduationCapIcon = outline(GraduationCap);
export const HistoryIcon = outline(History);
export const HouseIcon = outline(House);
export const ImageIcon = outline(Image);
export const ImagePlusIcon = outline(ImagePlus);
export const InfoIcon = outline(Info);
export const KeyboardIcon = outline(Keyboard);
export const LanguagesIcon = outline(Languages);
export const LaptopIcon = outline(Laptop);
export const LayersIcon = outline(Layers);
export const LayoutGridIcon = outline(LayoutGrid);
export const LayoutPanelLeftIcon = outline(LayoutPanelLeft);
export const LibraryIcon = outline(Library);
export const LightbulbIcon = outline(Lightbulb);
export const LinkIcon = outline(Link);
export const Link2Icon = outline(Link2);
export const ListIcon = outline(List);
export const ListChecksIcon = outline(ListChecks);
export const LogInIcon = outline(LogIn);
export const MailIcon = outline(Mail);
export const MailCheckIcon = outline(MailCheck);
export const MailOpenIcon = outline(MailOpen);
export const MapIcon = outline(Map);
export const MenuIcon = outline(Menu);
export const MessageCircleIcon = outline(MessageCircle);
export const MessageCircleHeartIcon = outline(MessageCircleHeart);
export const MessageSquareTextIcon = outline(MessageSquareText);
export const MessageSquareWarningIcon = outline(MessageSquareWarning);
export const MessagesSquareIcon = outline(MessagesSquare);
export const MicIcon = outline(Mic);
export const MinusIcon = outline(Minus);
export const MonitorIcon = outline(Monitor);
export const MoonIcon = outline(Moon);
export const NotebookPenIcon = outline(NotebookPen);
export const PaletteIcon = outline(Palette);
export const PanelLeftIcon = outline(PanelLeft);
export const PanelLeftCloseIcon = outline(PanelLeftClose);
export const PanelLeftOpenIcon = outline(PanelLeftOpen);
export const PanelRightIcon = outline(PanelRight);
export const PanelTopIcon = outline(PanelTop);
export const PaperclipIcon = outline(Paperclip);
export const PencilIcon = outline(Pencil);
export const PencilLineIcon = outline(PencilLine);
export const PinIcon = outline(Pin);
export const PinOffIcon = outline(PinOff);
export const PlugIcon = outline(Plug);
export const PlusIcon = outline(Plus);
export const PuzzleIcon = outline(Puzzle);
export const RectangleHorizontalIcon = outline(RectangleHorizontal);
export const RefreshCwIcon = outline(RefreshCw);
export const RotateCcwIcon = outline(RotateCcw);
export const ZapIcon = outline(Zap);
export const EyeIcon = outline(Eye);
export const EyeOffIcon = outline(EyeOff);
export const SearchIcon = outline(Search);
export const SettingsIcon = outline(Settings);
export const Settings2Icon = outline(Settings2);
export const ShieldAlertIcon = outline(ShieldAlert);
export const ShieldCheckIcon = outline(ShieldCheck);
export const ShieldEllipsisIcon = outline(ShieldEllipsis);
export const ShieldUserIcon = outline(ShieldUser);
export const ScanLineIcon = outline(ScanLine);
export const SmartphoneIcon = outline(Smartphone);
export const SmileIcon = outline(Smile);
export const SparkleIcon = outline(Sparkle);
export const SquarePenIcon = outline(SquarePen);
export const SquareTerminalIcon = outline(SquareTerminal);
export const StickyNoteIcon = outline(StickyNote);
export const SunIcon = outline(Sun);
export const TabletIcon = outline(Tablet);
export const TerminalIcon = outline(Terminal);
export const FileDiffIcon = outline(FileDiff);
export const FileBracesIcon = outline(FileBraces);
export const FileCogIcon = outline(FileCog);
export const FileImageIcon = outline(FileImage);
export const Trash2Icon = outline(Trash2);
export const Undo2Icon = outline(Undo2);
export const UploadIcon = outline(Upload);
export const UserIcon = outline(User);
export const UserCogIcon = outline(UserCog);
export const UserPlusIcon = outline(UserPlus);
export const UsersIcon = outline(Users);
export const Volume2Icon = outline(Volume2);
export const VolumeXIcon = outline(VolumeX);
export const WandSparklesIcon = outline(WandSparkles);
export const WebhookIcon = outline(Webhook);
export const WorkflowIcon = outline(Workflow);
export const WrenchIcon = outline(Wrench);
export const XIcon = outline(X);
