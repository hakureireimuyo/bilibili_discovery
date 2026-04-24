import { initThemedPage } from "../../themes/index.js";

declare const chrome: {
  runtime?: {
    getURL: (path: string) => string;
  };
};

interface WorkbenchView {
  id: string;
  title: string;
  kicker: string;
  description: string;
  icon: string;
  path: string;
}

const STORAGE_KEY = "workbench-last-view";
const FRAME_IDS = ["workbench-frame-a", "workbench-frame-b"] as const;

const VIEWS: WorkbenchView[] = [
  {
    id: "overview",
    title: "观看统计",
    kicker: "Overview",
    description: "先从整体观看趋势开始看，适合每次打开时快速扫一眼。",
    icon: "fa-chart-line",
    path: "ui/watch-stats/watch-stats.html"
  },
  {
    id: "stats",
    title: "UP 与标签",
    kicker: "Creators",
    description: "查看你关注和整理过的 UP、标签、分区信息。",
    icon: "fa-user-group",
    path: "ui/stats/stats.html"
  },
  {
    id: "watch-history",
    title: "观看历史",
    kicker: "History",
    description: "浏览已记录的观看内容与筛选结果。",
    icon: "fa-clock-rotate-left",
    path: "ui/watch-history/watch-history.html"
  },
  {
    id: "favorites",
    title: "收藏视频",
    kicker: "Favorites",
    description: "查看你整理到收藏体系里的内容。",
    icon: "fa-heart",
    path: "ui/favorites/favorites.html"
  },
  {
    id: "database",
    title: "数据库统计",
    kicker: "Database",
    description: "检查本地数据规模和存储情况。",
    icon: "fa-database",
    path: "ui/database-stats/database-stats.html"
  },
  {
    id: "themes",
    title: "主题设置",
    kicker: "Theme",
    description: "调整扩展视觉主题和表现风格。",
    icon: "fa-palette",
    path: "ui/theme-settings/theme-settings.html"
  },
  {
    id: "settings",
    title: "基础设置",
    kicker: "Settings",
    description: "配置 UID、缓存和 API 相关参数。",
    icon: "fa-sliders",
    path: "ui/options/options.html"
  },
  {
    id: "test-tools",
    title: "测试工具",
    kicker: "Tools",
    description: "保留原有调试与实验入口。",
    icon: "fa-flask",
    path: "ui/test-tools/test-tools.html"
  }
];

function getRuntimeUrl(path: string): string {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `../${path.replace(/^ui\//, "")}`;
}

function getViewById(viewId: string | null | undefined): WorkbenchView {
  return VIEWS.find((item) => item.id === viewId) ?? VIEWS[0];
}

function getInitialView(): WorkbenchView {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    return getViewById(hash);
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return getViewById(stored);
}

function renderNav(activeId: string): void {
  const nav = document.getElementById("workbench-nav");
  if (!nav) {
    return;
  }

  nav.innerHTML = VIEWS.map(
    (view) => `
      <button
        type="button"
        class="nav-item${view.id === activeId ? " is-active" : ""}"
        data-view-id="${view.id}"
        aria-pressed="${view.id === activeId}"
        title="${view.title}"
      >
        <span class="nav-icon"><i class="fas ${view.icon}"></i></span>
        <span class="nav-label">${view.title}</span>
      </button>
    `
  ).join("");
}

function setWorkspaceHeader(view: WorkbenchView): void {
  const kicker = document.getElementById("workspace-kicker");
  const title = document.getElementById("workspace-title");

  if (kicker) {
    kicker.textContent = view.kicker;
  }
  if (title) {
    title.textContent = view.title;
  }
}

function setLoading(visible: boolean): void {
  document.getElementById("frame-loading")?.classList.toggle("is-visible", visible);
}

function getFrames(): HTMLIFrameElement[] {
  return FRAME_IDS.map((id) => document.getElementById(id) as HTMLIFrameElement | null).filter(
    (frame): frame is HTMLIFrameElement => Boolean(frame)
  );
}

function getActiveFrame(frames: HTMLIFrameElement[]): HTMLIFrameElement | null {
  return frames.find((frame) => frame.classList.contains("is-active")) ?? frames[0] ?? null;
}

function markActiveFrame(nextFrame: HTMLIFrameElement, previousFrame: HTMLIFrameElement | null): void {
  previousFrame?.classList.remove("is-active", "is-staged");
  nextFrame.classList.remove("is-staged");
  nextFrame.classList.add("is-active");
}

function hideFrameScrollbars(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    if (!doc) {
      return;
    }

    let style = doc.getElementById("workbench-scrollbar-style") as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement("style");
      style.id = "workbench-scrollbar-style";
      style.textContent = `
        html, body {
          scrollbar-width: none !important;
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
        }
      `;
      doc.head?.appendChild(style);
    }
  } catch (error) {
    console.warn("[workbench] Failed to hide iframe scrollbars:", error);
  }
}

function activateView(view: WorkbenchView, options?: { immediate?: boolean }): void {
  const frames = getFrames();
  const frameShell = document.querySelector(".frame-shell");
  const currentFrame = getActiveFrame(frames);
  const nextFrame = frames.find((frame) => frame !== currentFrame) ?? currentFrame;

  if (!nextFrame) {
    return;
  }

  setWorkspaceHeader(view);
  renderNav(view.id);
  window.location.hash = view.id;
  window.localStorage.setItem(STORAGE_KEY, view.id);

  const nextUrl = getRuntimeUrl(view.path);
  const isImmediate = Boolean(options?.immediate);

  if (currentFrame?.dataset.viewId === view.id) {
    return;
  }

  if (isImmediate || !currentFrame) {
    setLoading(false);
    currentFrame?.classList.remove("is-active", "is-staged");
    nextFrame.classList.add("is-active");
    nextFrame.classList.remove("is-staged");
    nextFrame.dataset.viewId = view.id;
    nextFrame.addEventListener("load", () => hideFrameScrollbars(nextFrame), { once: true });
    nextFrame.src = nextUrl;
    return;
  }

  setLoading(true);
  frameShell?.classList.add("is-switching");
  nextFrame.classList.add("is-staged");
  nextFrame.dataset.viewId = view.id;

  const handleLoad = (): void => {
    nextFrame.removeEventListener("load", handleLoad);
    hideFrameScrollbars(nextFrame);
    markActiveFrame(nextFrame, currentFrame);
    frameShell?.classList.remove("is-switching");
    setLoading(false);
  };

  nextFrame.addEventListener("load", handleLoad, { once: true });
  nextFrame.src = nextUrl;
}

export function initWorkbench(): void {
  if (typeof document === "undefined") {
    return;
  }

  initThemedPage("workbench");

  const initialView = getInitialView();
  const nav = document.getElementById("workbench-nav");

  renderNav(initialView.id);
  setWorkspaceHeader(initialView);

  nav?.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-view-id]");
    if (!target) {
      return;
    }

    const viewId = target.dataset.viewId;
    activateView(getViewById(viewId));
  });

  window.addEventListener("hashchange", () => {
    const frames = getFrames();
    const activeFrame = getActiveFrame(frames);
    const nextView = getViewById(window.location.hash.replace(/^#/, ""));
    if (activeFrame?.dataset.viewId !== nextView.id) {
      activateView(nextView);
    }
  });

  activateView(initialView, { immediate: true });
}

if (typeof document !== "undefined") {
  initWorkbench();
}
