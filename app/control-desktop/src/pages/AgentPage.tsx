import { useMemo, useState } from "react";
import {
  Bot,
  Braces,
  ChevronDown,
  ChevronRight,
  Circle,
  FileCode2,
  FileText,
  Folder,
  GitBranch,
  PanelLeftClose,
  Play,
  RefreshCw,
  Save,
  Search,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { IconButton } from "../components/ui";

type AgentPanel = "assistant" | "changes";

const projectFiles = [
  { path: "engine", type: "folder" },
  { path: "app", type: "folder" },
  { path: "app/control-desktop", type: "folder" },
  { path: "src/pages/AgentPage.tsx", type: "file" },
  { path: "src/bridge/stage.ts", type: "file" },
  { path: "CMakeLists.txt", type: "file" },
] as const;

const editorLines = [
  "class Live2DRenderer {",
  "public:",
  "  bool initFramework();",
  "  bool loadModel(const std::string& modelDir,",
  "                 const std::string& modelFileName);",
  "  void update();",
  "  void draw(int width, int height, float scale);",
  "  void onTouch(float x, float y, int width, int height);",
  "};",
];

export function AgentPage() {
  const [selectedPath, setSelectedPath] = useState("engine/include/nna/graphics/live2d/live2d_renderer.h");
  const [panel, setPanel] = useState<AgentPanel>("assistant");
  const [prompt, setPrompt] = useState("");
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [actionStatus, setActionStatus] = useState("工作区只读预览");

  const fileName = useMemo(() => {
    const pathParts = selectedPath.split("/");
    return pathParts[pathParts.length - 1] || selectedPath;
  }, [selectedPath]);

  return (
    <div className="agent-page">
      <header className="agent-toolbar">
        <div className="workspace-switcher">
          <span className="workspace-switcher__mark"><Braces size={16} /></span>
          <span><strong>OpenNeko Engine</strong><small>main</small></span>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <span className="toolbar-divider" />
        <div className="agent-toolbar__path"><GitBranch size={14} /> main <span>/</span> {fileName}</div>
        <span className="agent-toolbar__spacer" />
        <span className="subtle-status"><Circle size={7} fill="currentColor" />{actionStatus}</span>
        <IconButton label="刷新工作区" onClick={() => setActionStatus("工作区已刷新")}><RefreshCw size={16} /></IconButton>
        <button type="button" className="button button--secondary" onClick={() => setActionStatus("构建命令等待 Rust 接入")}>
          <Play size={15} />构建
        </button>
      </header>

      <div className={`agent-workspace ${terminalOpen ? "agent-workspace--terminal" : ""}`}>
        <aside className="explorer-pane">
          <div className="pane-title-row">
            <span>资源管理器</span>
            <IconButton label="收起资源管理器"><PanelLeftClose size={15} /></IconButton>
          </div>
          <label className="search-field search-field--compact">
            <Search size={14} />
            <input type="search" placeholder="筛选文件" aria-label="筛选文件" />
          </label>
          <div className="tree-root"><ChevronDown size={14} /><Folder size={15} /> OpenNeko Engine</div>
          <div className="file-tree">
            {projectFiles.map((entry, index) => {
              const isFile = entry.type === "file";
              const active = isFile && selectedPath.endsWith(entry.path);
              return (
                <button
                  type="button"
                  key={`${entry.path}-${index}`}
                  className={`file-tree__row file-tree__row--${entry.type} ${active ? "is-active" : ""}`}
                  onClick={() => {
                    if (isFile) setSelectedPath(entry.path.startsWith("src") ? `app/control-desktop/${entry.path}` : entry.path);
                  }}
                >
                  {entry.type === "folder" ? <ChevronRight size={13} /> : <span className="tree-indent" />}
                  {entry.type === "folder" ? <Folder size={15} /> : entry.path.endsWith(".md") ? <FileText size={15} /> : <FileCode2 size={15} />}
                  <span>{entry.path}</span>
                </button>
              );
            })}
          </div>
          <div className="explorer-section">
            <button type="button"><ChevronRight size={13} />更改 <span>0</span></button>
            <button type="button"><ChevronRight size={13} />大纲</button>
          </div>
        </aside>

        <section className="editor-pane">
          <div className="editor-tabs">
            <button type="button" className="editor-tab editor-tab--active"><FileCode2 size={14} />{fileName}<span className="editor-tab__dirty" /></button>
          </div>
          <div className="editor-breadcrumbs">{selectedPath.split("/").map((part) => <span key={part}>{part}<ChevronRight size={11} /></span>)}</div>
          <div className="code-editor" role="region" aria-label={`${fileName} 代码预览`}>
            {editorLines.map((line, index) => (
              <div className="code-line" key={`${line}-${index}`}>
                <span className="code-line__number">{index + 19}</span>
                <code>{line || " "}</code>
              </div>
            ))}
          </div>
          <div className="terminal-pane">
            <div className="terminal-pane__tabs">
              <button type="button" className="is-active" onClick={() => setTerminalOpen(true)}>终端</button>
              <button type="button">问题 <span>0</span></button>
              <button type="button">输出</button>
              <span />
              <IconButton label={terminalOpen ? "关闭终端" : "打开终端"} onClick={() => setTerminalOpen((current) => !current)}>
                <TerminalSquare size={15} />
              </IconButton>
            </div>
            {terminalOpen ? (
              <div className="terminal-output">
                <div><span className="terminal-prompt">openneko</span> <span className="terminal-branch">main</span></div>
                <div className="terminal-cursor-line"><span>$</span><span className="terminal-cursor" /></div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="agent-pane">
          <div className="agent-pane__tabs">
            <button type="button" className={panel === "assistant" ? "is-active" : ""} onClick={() => setPanel("assistant")}><Bot size={15} />Agent</button>
            <button type="button" className={panel === "changes" ? "is-active" : ""} onClick={() => setPanel("changes")}><GitBranch size={15} />更改</button>
          </div>

          {panel === "assistant" ? (
            <>
              <div className="agent-thread">
                <div className="agent-empty-mark"><Bot size={23} /></div>
                <strong>Agent 工作区</strong>
                <p>描述要完成的代码任务。Agent 服务接入后，工具活动和差异会显示在这里。</p>
                <div className="agent-capabilities">
                  <span><Wrench size={13} />工具调用</span>
                  <span><FileCode2 size={13} />代码差异</span>
                </div>
              </div>
              <div className="agent-composer">
                <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="给 Agent 一个任务" rows={4} />
                <div className="agent-composer__footer">
                  <button type="button" className="mode-button">受控执行<ChevronDown size={12} /></button>
                  <button
                    type="button"
                    className="send-button"
                    disabled={!prompt.trim()}
                    onClick={() => {
                      setActionStatus("Agent 服务尚未连接");
                      setPrompt("");
                    }}
                    aria-label="运行 Agent 任务"
                    title="运行 Agent 任务"
                  ><Play size={15} fill="currentColor" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="changes-panel">
              <div className="changes-panel__header"><span>工作区更改</span><button type="button" className="button button--ghost"><Save size={14} />保存全部</button></div>
              <div className="pane-empty">当前没有未保存的更改。</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
