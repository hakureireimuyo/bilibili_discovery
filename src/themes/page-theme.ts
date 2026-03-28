import { themeManager } from "./theme-manager.js";

export type ThemePageId =
  | "popup"
  | "options"
  | "stats"
  | "theme-settings"
  | "theme-example";

/**
 * 为页面建立统一的主题接入点。
 * 新页面只需在入口调用一次即可获得主题变量、页面命名空间和跨页同步能力。
 */
export function initThemedPage(pageId: ThemePageId): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.themePage = pageId;
  document.documentElement.classList.add("theme-ready");

  if (document.body) {
    document.body.dataset.themePage = pageId;
    document.body.classList.add("theme-page", `theme-page-${pageId}`);
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        document.body?.classList.add("theme-page", `theme-page-${pageId}`);
        if (document.body) {
          document.body.dataset.themePage = pageId;
        }
      },
      { once: true }
    );
  }

  // 触发单例初始化，确保当前页面立即拿到主题变量并接入跨页同步。
  themeManager.getCurrentTheme();
}
