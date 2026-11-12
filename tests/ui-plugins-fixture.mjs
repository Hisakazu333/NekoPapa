// A manifest exercising every open slot; used only by tests/ui-plugins*.test.mjs.
export const manifest = (overrides = {}) => ({
  manifestVersion: 1,
  id: "acme.git-notes",
  name: "Git 笔记",
  version: "0.1.0",
  description: "在工作面板里查看 Git 笔记。",
  engines: { nekopapa: ">=0.1.0" },
  permissions: ["link.open"],
  requires: [],
  contributes: {
    "workPanel.view": [
      { id: "notes", title: "笔记", icon: "notebook-pen", content: { kind: "status", text: "需要 Coding 执行层。" }, requires: ["runtime.coding"] },
    ],
    "command.palette": [
      { id: "open-notes", title: "打开 Git 笔记", action: { openView: "workPanel.view/notes" } },
      { id: "docs", title: "Git 笔记文档", icon: "link", action: { openUrl: "https://example.com/docs" } },
    ],
  },
  ...overrides,
});
