import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from "./settings.js";
import { initThemedPage } from "../../themes/index.js";

declare const chrome: { runtime: { getURL: (path: string) => string } };

function setStatus(text: string): void {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = text;
  }
}

function setLinkTarget(id: string, path: string): void {
  const link = document.getElementById(id) as HTMLAnchorElement | null;
  if (link && typeof chrome !== "undefined") {
    link.href = chrome.runtime.getURL(path);
    link.target = "_blank";
  }
}

function fillForm(settings: Awaited<ReturnType<typeof loadSettings>>): void {
  const cacheHoursEl = document.getElementById("cache-hours") as HTMLInputElement | null;
  const userIdEl = document.getElementById("user-id") as HTMLInputElement | null;
  const classifyMethodEl = document.getElementById("classify-method") as HTMLSelectElement | null;
  const apiBaseUrlEl = document.getElementById("api-base-url") as HTMLInputElement | null;
  const apiModelEl = document.getElementById("api-model") as HTMLInputElement | null;
  const apiKeyEl = document.getElementById("api-key") as HTMLInputElement | null;
  const biliCookieEl = document.getElementById("bili-cookie") as HTMLTextAreaElement | null;

  if (cacheHoursEl) cacheHoursEl.value = String(settings.cacheHours);
  if (userIdEl && settings.userId) userIdEl.value = String(settings.userId);
  if (classifyMethodEl) classifyMethodEl.value = settings.classifyMethod;
  if (apiBaseUrlEl) apiBaseUrlEl.value = settings.apiBaseUrl;
  if (apiModelEl) apiModelEl.value = settings.apiModel;
  if (apiKeyEl) apiKeyEl.value = settings.apiKey;
  if (biliCookieEl) biliCookieEl.value = settings.biliCookie;
}

function readForm() {
  const cacheHoursEl = document.getElementById("cache-hours") as HTMLInputElement | null;
  const userIdEl = document.getElementById("user-id") as HTMLInputElement | null;
  const classifyMethodEl = document.getElementById("classify-method") as HTMLSelectElement | null;
  const apiBaseUrlEl = document.getElementById("api-base-url") as HTMLInputElement | null;
  const apiModelEl = document.getElementById("api-model") as HTMLInputElement | null;
  const apiKeyEl = document.getElementById("api-key") as HTMLInputElement | null;
  const biliCookieEl = document.getElementById("bili-cookie") as HTMLTextAreaElement | null;

  return normalizeSettings({
    cacheHours: Number(cacheHoursEl?.value ?? DEFAULT_SETTINGS.cacheHours),
    userId: Number(userIdEl?.value ?? DEFAULT_SETTINGS.userId),
    classifyMethod: (classifyMethodEl?.value as "api" | "page") ?? DEFAULT_SETTINGS.classifyMethod,
    apiBaseUrl: String(apiBaseUrlEl?.value ?? DEFAULT_SETTINGS.apiBaseUrl),
    apiModel: String(apiModelEl?.value ?? DEFAULT_SETTINGS.apiModel),
    apiKey: String(apiKeyEl?.value ?? DEFAULT_SETTINGS.apiKey),
    biliCookie: String(biliCookieEl?.value ?? DEFAULT_SETTINGS.biliCookie)
  });
}

function bindCookieHelp(): void {
  const helpLink = document.getElementById("show-cookie-help");
  helpLink?.addEventListener("click", (event) => {
    event.preventDefault();
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

function bindSave(): void {
  const saveBtn = document.getElementById("save-btn");
  saveBtn?.addEventListener("click", async () => {
    await saveSettings(readForm());
    setStatus("已保存");
  });
}

export async function initOptions(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  initThemedPage("options");

  const settings = await loadSettings();
  fillForm(settings);
  setLinkTarget("open-stats", "ui/stats/stats.html");
  setLinkTarget("open-api-test", "ui/api-test/api-test.html");
  setLinkTarget("open-image-compress", "ui/image-compress/image-compress.html");
  setLinkTarget("open-test-tools", "ui/test-tools/test-tools.html");
  bindCookieHelp();
  bindSave();
}

if (typeof document !== "undefined") {
  void initOptions();
}
