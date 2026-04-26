import { getValue, setValue, type AppSettings as Settings } from "../../database/implementations/index.js";

export const DEFAULT_SETTINGS: Settings = {
  cacheHours: 24,
  userId: null,
  apiBaseUrl: "https://api.deepseek.com",
  apiModel: "deepseek-chat",
  apiKey: "",
  imageCacheRetentionDays: 30,
  tagFetchInterval: 200,
  apiMinInterval: 500,
  apiMaxInterval: 1000,
  maxVideosToFetch: 3,
  backgroundAnimation: "particles"
};

export function normalizeSettings(input: Partial<Settings>): Settings {
  const cacheHoursRaw = Number(input.cacheHours ?? DEFAULT_SETTINGS.cacheHours);
  const cacheHours = Math.min(168, Math.max(1, cacheHoursRaw));
  const userIdRaw = Number(input.userId);
  const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;
  const apiBaseUrl = String(input.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl).trim();
  const apiModel = String(input.apiModel ?? DEFAULT_SETTINGS.apiModel).trim();
  const apiKey = String(input.apiKey ?? DEFAULT_SETTINGS.apiKey).trim();
  const imageCacheRetentionDaysRaw = Number(
    input.imageCacheRetentionDays ?? DEFAULT_SETTINGS.imageCacheRetentionDays
  );
  const imageCacheRetentionDays: Settings["imageCacheRetentionDays"] =
    imageCacheRetentionDaysRaw === 7 ||
    imageCacheRetentionDaysRaw === 30 ||
    imageCacheRetentionDaysRaw === 180 ||
    imageCacheRetentionDaysRaw === 365
      ? imageCacheRetentionDaysRaw
      : DEFAULT_SETTINGS.imageCacheRetentionDays;
  const tagFetchIntervalRaw = Number(input.tagFetchInterval ?? DEFAULT_SETTINGS.tagFetchInterval);
  const tagFetchInterval = Math.min(5000, Math.max(0, tagFetchIntervalRaw));
  const apiMinIntervalRaw = Number(input.apiMinInterval ?? DEFAULT_SETTINGS.apiMinInterval);
  const apiMinInterval = Math.min(5000, Math.max(0, apiMinIntervalRaw));
  const apiMaxIntervalRaw = Number(input.apiMaxInterval ?? DEFAULT_SETTINGS.apiMaxInterval);
  const apiMaxInterval = Math.min(10000, Math.max(apiMinInterval, apiMaxIntervalRaw));
  const maxVideosToFetchRaw = Number(input.maxVideosToFetch ?? DEFAULT_SETTINGS.maxVideosToFetch);
  const maxVideosToFetch = Math.min(10, Math.max(1, maxVideosToFetchRaw));
  const backgroundAnimation = typeof input.backgroundAnimation === "string"
    ? input.backgroundAnimation
    : DEFAULT_SETTINGS.backgroundAnimation;

  return {
    cacheHours,
    userId,
    apiBaseUrl,
    apiModel,
    apiKey,
    imageCacheRetentionDays,
    tagFetchInterval,
    apiMinInterval,
    apiMaxInterval,
    maxVideosToFetch,
    backgroundAnimation
  };
}

export async function loadSettings(): Promise<Settings> {
  const saved = (await getValue<Settings>("settings")) ?? DEFAULT_SETTINGS;
  return normalizeSettings(saved);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setValue("settings", settings);
  if (settings.userId) {
    await setValue("userId", settings.userId);
  }
}
