/**
 * Options page logic.
 */

import { getValue, setValue } from "../../storage/storage.js";

export interface Settings {
  cacheHours: number;
  userId: number | null;
  apiBaseUrl: string;
  apiModel: string;
  apiKey: string;
  classifyMethod: "api" | "page";
  biliCookie: string;
}

export const DEFAULT_SETTINGS: Settings = {
  cacheHours: 24,
  userId: null,
  apiBaseUrl: "https://api.deepseek.com",
  apiModel: "deepseek-chat",
  apiKey: "",
  classifyMethod: "page",
  biliCookie: ""
};

export function normalizeSettings(input: Partial<Settings>): Settings {
  const cacheHoursRaw = Number(input.cacheHours ?? DEFAULT_SETTINGS.cacheHours);
  const cacheHours = Math.min(168, Math.max(1, cacheHoursRaw));
  const userIdRaw = Number(input.userId);
  const userId =
    Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;
  const apiBaseUrl = String(input.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl).trim();
  const apiModel = String(input.apiModel ?? DEFAULT_SETTINGS.apiModel).trim();
  const apiKey = String(input.apiKey ?? DEFAULT_SETTINGS.apiKey).trim();
  const classifyMethodRaw = input.classifyMethod ?? DEFAULT_SETTINGS.classifyMethod;
  const classifyMethod: "api" | "page" =
    classifyMethodRaw === "api" || classifyMethodRaw === "page"
      ? classifyMethodRaw
      : DEFAULT_SETTINGS.classifyMethod;
  const biliCookie = String(input.biliCookie ?? DEFAULT_SETTINGS.biliCookie).trim();

  return {
    cacheHours,
    userId,
    apiBaseUrl,
    apiModel,
    apiKey,
    classifyMethod,
    biliCookie
  };
}

function showStatus(text: string): void {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = text;
  }
}

async function loadSettings(): Promise<Settings> {
  const saved = (await getValue<Settings>("settings")) ?? DEFAULT_SETTINGS;
  return normalizeSettings(saved);
}

async function saveSettings(settings: Settings): Promise<void> {
  await setValue("settings", settings);
  if (settings.userId) {
    await setValue("userId", settings.userId);
  }
}

declare const chrome: { runtime: { getURL: (path: string) => string } };

export async function initOptions(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  const statsLink = document.getElementById("open-stats") as HTMLAnchorElement | null;
  const cacheHoursEl = document.getElementById("cache-hours") as HTMLInputElement | null;
  const userIdEl = document.getElementById("user-id") as HTMLInputElement | null;
  const classifyMethodEl = document.getElementById("classify-method") as HTMLSelectElement | null;
  const apiBaseUrlEl = document.getElementById("api-base-url") as HTMLInputElement | null;
  const apiModelEl = document.getElementById("api-model") as HTMLInputElement | null;
  const apiKeyEl = document.getElementById("api-key") as HTMLInputElement | null;
  const biliCookieEl = document.getElementById("bili-cookie") as HTMLTextAreaElement | null;
  const showCookieHelpLink = document.getElementById("show-cookie-help") as HTMLAnchorElement | null;
  const saveBtn = document.getElementById("save-btn");

  const settings = await loadSettings();
  if (cacheHoursEl) cacheHoursEl.value = String(settings.cacheHours);
  if (userIdEl && settings.userId) userIdEl.value = String(settings.userId);
  if (classifyMethodEl) classifyMethodEl.value = settings.classifyMethod;
  if (apiBaseUrlEl) apiBaseUrlEl.value = settings.apiBaseUrl;
  if (apiModelEl) apiModelEl.value = settings.apiModel;
  if (apiKeyEl) apiKeyEl.value = settings.apiKey;
  if (biliCookieEl) biliCookieEl.value = settings.biliCookie;

  if (statsLink && typeof chrome !== "undefined") {
    statsLink.href = chrome.runtime.getURL("ui/stats/stats.html");
    statsLink.target = "_blank";
  }

  const openApiTestLink = document.getElementById("open-api-test") as HTMLAnchorElement | null;
  if (openApiTestLink && typeof chrome !== "undefined") {
    openApiTestLink.href = chrome.runtime.getURL("ui/api-test/api-test.html");
    openApiTestLink.target = "_blank";
  }

  if (showCookieHelpLink) {
    showCookieHelpLink.addEventListener("click", (e) => {
      e.preventDefault();
      alert(
        "如何获取B站Cookie：\n\n" +
        "1. 在浏览器中登录B站\n" +
        "2. 按F12打开开发者工具\n" +
        "3. 切换到\"Network\"（网络）标签\n" +
        "4. 刷新页面或访问任意B站页面\n" +
        "5. 在请求列表中找到任意请求，查看其\"Headers\"\n" +
        "6. 找到\"Request Headers\"中的\"Cookie\"字段\n" +
        "7. 复制完整的Cookie值并粘贴到输入框中\n\n" +
        "注意：Cookie会过期，如果API返回\"访问权限不足\"，需要重新获取Cookie"

      );
    });
  }

  saveBtn?.addEventListener("click", async () => {
    const next = normalizeSettings({
      cacheHours: Number(cacheHoursEl?.value ?? DEFAULT_SETTINGS.cacheHours),
      userId: Number(userIdEl?.value ?? DEFAULT_SETTINGS.userId),
      classifyMethod: (classifyMethodEl?.value as "api" | "page") ?? DEFAULT_SETTINGS.classifyMethod,
      apiBaseUrl: String(apiBaseUrlEl?.value ?? DEFAULT_SETTINGS.apiBaseUrl),
      apiModel: String(apiModelEl?.value ?? DEFAULT_SETTINGS.apiModel),
      apiKey: String(apiKeyEl?.value ?? DEFAULT_SETTINGS.apiKey),
      biliCookie: String(biliCookieEl?.value ?? DEFAULT_SETTINGS.biliCookie)
    });
    await saveSettings(next);
    showStatus("已保存");
  });
}

if (typeof document !== "undefined") {
  void initOptions();
}
