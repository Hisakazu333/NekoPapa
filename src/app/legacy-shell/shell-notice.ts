import { icon } from "./icons";
import { escapeHtml } from "./view-shared";

export interface NoticeActions {
  undo?: () => void;
  view?: { label: string; run: () => void };
}

export class ShellNotice {
  private element: HTMLElement | null = null;

  clear(): void {
    this.element?.remove();
    this.element = null;
  }

  show(message: string, actions: NoticeActions = {}): void {
    this.clear();
    const notice = document.createElement("div");
    notice.className = "shell-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = `<span>${escapeHtml(message)}</span>${actions.undo ? '<button class="text-button" type="button" data-undo>撤销</button>' : ""}${actions.view ? `<button class="text-button" type="button" data-view>${escapeHtml(actions.view.label)}</button>` : ""}<button class="icon-button" type="button" data-dismiss-notice aria-label="关闭提示">${icon("close")}</button>`;
    notice.addEventListener("click", (event) => {
      const target = (event.target as Element).closest("button");
      if (!target) return;
      if (target.hasAttribute("data-undo")) actions.undo?.();
      else if (target.hasAttribute("data-view")) { notice.remove(); actions.view?.run(); }
      else if (target.hasAttribute("data-dismiss-notice")) notice.remove();
    });
    document.body.append(notice);
    this.element = notice;
  }
}
