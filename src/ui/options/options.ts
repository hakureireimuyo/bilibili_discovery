import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from "./settings.js";
import { initThemedPage } from "../../themes/index.js";
import { updateRateLimiterIntervals } from "../../api/request.js";

declare const chrome: { runtime: { getURL: (path: string) => string } };

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
  const imageCacheRetentionEl = document.getElementById("image-cache-retention") as HTMLSelectElement | null;
  const apiBaseUrlEl = document.getElementById("api-base-url") as HTMLInputElement | null;
  const apiModelEl = document.getElementById("api-model") as HTMLInputElement | null;
  const apiKeyEl = document.getElementById("api-key") as HTMLInputElement | null;
  const tagFetchIntervalEl = document.getElementById("tag-fetch-interval") as HTMLInputElement | null;
  const apiMinIntervalEl = document.getElementById("api-min-interval") as HTMLInputElement | null;
  const apiMaxIntervalEl = document.getElementById("api-max-interval") as HTMLInputElement | null;
  const maxVideosToFetchEl = document.getElementById("max-videos-to-fetch") as HTMLInputElement | null;
  const backgroundAnimationEl = document.getElementById("background-animation") as HTMLSelectElement | null;

  if (cacheHoursEl) cacheHoursEl.value = String(settings.cacheHours);
  if (userIdEl && settings.userId) userIdEl.value = String(settings.userId);
  if (imageCacheRetentionEl) imageCacheRetentionEl.value = String(settings.imageCacheRetentionDays);
  if (apiBaseUrlEl) apiBaseUrlEl.value = settings.apiBaseUrl;
  if (apiModelEl) apiModelEl.value = settings.apiModel;
  if (apiKeyEl) apiKeyEl.value = settings.apiKey;
  if (tagFetchIntervalEl) tagFetchIntervalEl.value = String(settings.tagFetchInterval);
  if (apiMinIntervalEl) apiMinIntervalEl.value = String(settings.apiMinInterval);
  if (apiMaxIntervalEl) apiMaxIntervalEl.value = String(settings.apiMaxInterval);
  if (maxVideosToFetchEl) maxVideosToFetchEl.value = String(settings.maxVideosToFetch);
  if (backgroundAnimationEl) backgroundAnimationEl.value = settings.backgroundAnimation;
}

function readForm() {
  const cacheHoursEl = document.getElementById("cache-hours") as HTMLInputElement | null;
  const userIdEl = document.getElementById("user-id") as HTMLInputElement | null;
  const imageCacheRetentionEl = document.getElementById("image-cache-retention") as HTMLSelectElement | null;
  const apiBaseUrlEl = document.getElementById("api-base-url") as HTMLInputElement | null;
  const apiModelEl = document.getElementById("api-model") as HTMLInputElement | null;
  const apiKeyEl = document.getElementById("api-key") as HTMLInputElement | null;
  const tagFetchIntervalEl = document.getElementById("tag-fetch-interval") as HTMLInputElement | null;
  const apiMinIntervalEl = document.getElementById("api-min-interval") as HTMLInputElement | null;
  const apiMaxIntervalEl = document.getElementById("api-max-interval") as HTMLInputElement | null;
  const maxVideosToFetchEl = document.getElementById("max-videos-to-fetch") as HTMLInputElement | null;
  const backgroundAnimationEl = document.getElementById("background-animation") as HTMLSelectElement | null;

  return normalizeSettings({
    cacheHours: Number(cacheHoursEl?.value ?? DEFAULT_SETTINGS.cacheHours),
    userId: Number(userIdEl?.value ?? DEFAULT_SETTINGS.userId),
    imageCacheRetentionDays: Number(
      imageCacheRetentionEl?.value ?? DEFAULT_SETTINGS.imageCacheRetentionDays
    ) as 7 | 30 | 180 | 365,
    apiBaseUrl: String(apiBaseUrlEl?.value ?? DEFAULT_SETTINGS.apiBaseUrl),
    apiModel: String(apiModelEl?.value ?? DEFAULT_SETTINGS.apiModel),
    apiKey: String(apiKeyEl?.value ?? DEFAULT_SETTINGS.apiKey),
    tagFetchInterval: Number(tagFetchIntervalEl?.value ?? DEFAULT_SETTINGS.tagFetchInterval),
    apiMinInterval: Number(apiMinIntervalEl?.value ?? DEFAULT_SETTINGS.apiMinInterval),
    apiMaxInterval: Number(apiMaxIntervalEl?.value ?? DEFAULT_SETTINGS.apiMaxInterval),
    maxVideosToFetch: Number(maxVideosToFetchEl?.value ?? DEFAULT_SETTINGS.maxVideosToFetch),
    backgroundAnimation: String(backgroundAnimationEl?.value ?? DEFAULT_SETTINGS.backgroundAnimation)
  });
}

function bindAutoSave(): void {
  const content = document.querySelector(".content");
  if (!content) return;

  content.addEventListener("change", async () => {
    const settings = readForm();
    await saveSettings(settings);
    updateRateLimiterIntervals(settings.apiMinInterval, settings.apiMaxInterval);
  });
}

export async function initOptions(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  initThemedPage("options");

  const settings = await loadSettings();
  fillForm(settings);
  updateRateLimiterIntervals(settings.apiMinInterval, settings.apiMaxInterval);
  setLinkTarget("open-stats", "ui/stats/stats.html");
  setLinkTarget("open-api-test", "ui/api-test/api-test.html");
  setLinkTarget("open-image-compress", "ui/image-compress/image-compress.html");
  setLinkTarget("open-test-tools", "ui/test-tools/test-tools.html");
  bindAutoSave();
}

if (typeof document !== "undefined") {
  void initOptions();
}
