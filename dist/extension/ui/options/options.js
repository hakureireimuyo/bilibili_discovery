/**
 * Options page logic.
 */
import { getValue, setValue } from "../../storage/storage.js";
export const DEFAULT_SETTINGS = {
    cacheHours: 24,
    userId: null,
    apiBaseUrl: "https://api.deepseek.com",
    apiModel: "deepseek-chat",
    apiKey: ""
};
export function normalizeSettings(input) {
    const cacheHoursRaw = Number(input.cacheHours ?? DEFAULT_SETTINGS.cacheHours);
    const cacheHours = Math.min(168, Math.max(1, cacheHoursRaw));
    const userIdRaw = Number(input.userId);
    const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null;
    const apiBaseUrl = String(input.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl).trim();
    const apiModel = String(input.apiModel ?? DEFAULT_SETTINGS.apiModel).trim();
    const apiKey = String(input.apiKey ?? DEFAULT_SETTINGS.apiKey).trim();
    return {
        cacheHours,
        userId,
        apiBaseUrl,
        apiModel,
        apiKey
    };
}
function showStatus(text) {
    const status = document.getElementById("status");
    if (status) {
        status.textContent = text;
    }
}
async function loadSettings() {
    const saved = (await getValue("settings")) ?? DEFAULT_SETTINGS;
    return normalizeSettings(saved);
}
async function saveSettings(settings) {
    await setValue("settings", settings);
    if (settings.userId) {
        await setValue("userId", settings.userId);
    }
}
export async function initOptions() {
    if (typeof document === "undefined") {
        return;
    }
    const statsLink = document.getElementById("open-stats");
    const cacheHoursEl = document.getElementById("cache-hours");
    const userIdEl = document.getElementById("user-id");
    const apiBaseUrlEl = document.getElementById("api-base-url");
    const apiModelEl = document.getElementById("api-model");
    const apiKeyEl = document.getElementById("api-key");
    const saveBtn = document.getElementById("save-btn");
    const settings = await loadSettings();
    if (cacheHoursEl)
        cacheHoursEl.value = String(settings.cacheHours);
    if (userIdEl && settings.userId)
        userIdEl.value = String(settings.userId);
    if (apiBaseUrlEl)
        apiBaseUrlEl.value = settings.apiBaseUrl;
    if (apiModelEl)
        apiModelEl.value = settings.apiModel;
    if (apiKeyEl)
        apiKeyEl.value = settings.apiKey;
    if (statsLink && typeof chrome !== "undefined") {
        statsLink.href = chrome.runtime.getURL("ui/stats/stats.html");
        statsLink.target = "_blank";
    }
    saveBtn?.addEventListener("click", async () => {
        const next = normalizeSettings({
            cacheHours: Number(cacheHoursEl?.value ?? DEFAULT_SETTINGS.cacheHours),
            userId: Number(userIdEl?.value ?? DEFAULT_SETTINGS.userId),
            apiBaseUrl: String(apiBaseUrlEl?.value ?? DEFAULT_SETTINGS.apiBaseUrl),
            apiModel: String(apiModelEl?.value ?? DEFAULT_SETTINGS.apiModel),
            apiKey: String(apiKeyEl?.value ?? DEFAULT_SETTINGS.apiKey)
        });
        await saveSettings(next);
        showStatus("已保存");
    });
}
if (typeof document !== "undefined") {
    void initOptions();
}
