import { getValue, setValue, type AppSettings as Settings } from "../../database/implementations/index.js";

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
  const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;
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
