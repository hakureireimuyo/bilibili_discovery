import { initThemedPage } from "../../themes/index.js";
import { createAnimation, type AnimationId } from "./animations.js";
import { getValue } from "../../database/implementations/index.js";

declare const chrome: {
  runtime?: {
    getURL: (path: string) => string;
  };
};

interface WorkbenchView {
  id: string;
  title: string;
  icon: string;
  path: string;
}

const STORAGE_KEY = "workbench-last-view";

/** 每个 view 对应一个持久化的 iframe，首次访问时创建，永不销毁 */
const frameCache = new Map<string, HTMLIFrameElement>();
/** 记录已加载完成的 view */
const loadedViews = new Set<string>();
/** 当前激活的 view id */
let currentViewId: string | null = null;

const VIEWS: WorkbenchView[] = [
  {
    id: "overview",
    title: "观看统计",
    icon: "fa-chart-line",
    path: "ui/watch-stats/watch-stats.html"
  },
  {
    id: "stats",
    title: "UP 与标签",
    icon: "fa-user-group",
    path: "ui/stats/stats.html"
  },
  {
    id: "watch-history",
    title: "观看历史",
    icon: "fa-clock-rotate-left",
    path: "ui/watch-history/watch-history.html"
  },
  {
    id: "favorites",
    title: "收藏视频",
    icon: "fa-heart",
    path: "ui/favorites/favorites.html"
  },
  {
    id: "database",
    title: "数据库统计",
    icon: "fa-database",
    path: "ui/database-stats/database-stats.html"
  },
  {
    id: "themes",
    title: "主题设置",
    icon: "fa-palette",
    path: "ui/theme-settings/theme-settings.html"
  },
  {
    id: "settings",
    title: "基础设置",
    icon: "fa-sliders",
    path: "ui/options/options.html"
  },
  {
    id: "test-tools",
    title: "测试工具",
    icon: "fa-flask",
    path: "ui/test-tools/test-tools.html"
  },
  {
    id: "animation-test",
    title: "动画测试",
    icon: "fa-wand-magic-sparkles",
    path: "ui/animation-test/animation-test.html"
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

function setLoading(visible: boolean): void {
  document.getElementById("frame-loading")?.classList.toggle("is-visible", visible);
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
  renderNav(view.id);
  window.location.hash = view.id;
  window.localStorage.setItem(STORAGE_KEY, view.id);

  if (currentViewId === view.id) {
    return;
  }

  const frameShell = document.querySelector(".frame-shell");
  if (!frameShell) {
    return;
  }

  // 懒创建：每个 view 只创建一次 iframe
  let iframe = frameCache.get(view.id);

  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.className = "workbench-frame";
    iframe.title = `Bilibili Discovery - ${view.title}`;
    iframe.dataset.viewId = view.id;

    iframe.addEventListener("load", () => {
      hideFrameScrollbars(iframe!);
      loadedViews.add(view.id);
      // 如果当前仍为此 view，隐藏 loading
      if (currentViewId === view.id) {
        setLoading(false);
      }
    }, { once: true });

    frameShell.appendChild(iframe);
    iframe.src = getRuntimeUrl(view.path);
    frameCache.set(view.id, iframe);
  }

  // 切换可见性
  if (currentViewId) {
    const prevFrame = frameCache.get(currentViewId);
    prevFrame?.classList.remove("is-active");
  }

  iframe.classList.add("is-active");
  currentViewId = view.id;

  // 未加载完成的 view 显示 loading
  if (loadedViews.has(view.id)) {
    setLoading(false);
  } else if (!options?.immediate) {
    setLoading(true);
  }
}

let stopAnimation: (() => void) | null = null;

async function initAnimation(): Promise<void> {
  stopAnimation?.();

  try {
    const settings = await getValue<{ backgroundAnimation?: string }>("settings");
    const animId = (settings?.backgroundAnimation ?? "particles") as AnimationId;
    const anim = createAnimation(animId);
    stopAnimation = anim.start(document.querySelector(".frame-shell")!);
  } catch {
    // Fallback: particles if settings can't be loaded
    const anim = createAnimation("particles");
    stopAnimation = anim.start(document.querySelector(".frame-shell")!);
  }
}

export function initWorkbench(): void {
  if (typeof document === "undefined") {
    return;
  }

  initThemedPage("workbench");

  void initAnimation();

  const initialView = getInitialView();
  const nav = document.getElementById("workbench-nav");

  renderNav(initialView.id);

  nav?.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-view-id]");
    if (!target) {
      return;
    }

    const viewId = target.dataset.viewId;
    activateView(getViewById(viewId));
  });

  window.addEventListener("hashchange", () => {
    const nextView = getViewById(window.location.hash.replace(/^#/, ""));
    if (currentViewId !== nextView.id) {
      activateView(nextView);
    }
  });

  activateView(initialView, { immediate: true });
}

if (typeof document !== "undefined") {
  initWorkbench();
}
