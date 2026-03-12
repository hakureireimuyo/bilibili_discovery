/**
 * Popup UI logic.
 */
import { getValue } from "../../storage/storage.js";
export function sortInterests(profile) {
    return Object.values(profile)
        .map((item) => ({ tag: item.tag, score: item.score, ratio: 0 }))
        .sort((a, b) => b.score - a.score);
}
export function buildInterestRows(profile) {
    const rows = sortInterests(profile);
    const maxScore = rows.length > 0 ? rows[0].score : 0;
    return rows.map((row) => ({
        ...row,
        ratio: maxScore > 0 ? Math.min(1, row.score / maxScore) : 0
    }));
}
function renderInterestList(container, rows) {
    container.innerHTML = "";
    for (const row of rows) {
        const item = document.createElement("div");
        item.className = "interest-item";
        const label = document.createElement("span");
        label.textContent = `${row.tag} ${row.score.toFixed(1)}`;
        const bar = document.createElement("span");
        bar.className = "bar";
        const fill = document.createElement("span");
        fill.className = "bar-fill";
        fill.style.width = `${Math.round(row.ratio * 100)}%`;
        bar.appendChild(fill);
        item.appendChild(label);
        item.appendChild(bar);
        container.appendChild(item);
    }
}
function sendAction(type) {
    if (typeof chrome === "undefined") {
        console.log("[Popup] Action", type);
        return;
    }
    chrome.runtime.sendMessage({ type });
}
function sendActionWithResponse(type) {
    if (typeof chrome === "undefined") {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type }, (response) => {
            resolve(response ?? null);
        });
    });
}
export function formatRecommendTitle(title) {
    return title && title.trim().length > 0 ? title.trim() : "-";
}
function setRecommendTitle(title) {
    const el = document.getElementById("recommend-title");
    if (el) {
        el.textContent = formatRecommendTitle(title);
    }
}
async function loadInterests() {
    const container = document.getElementById("interest-list");
    if (!container) {
        return;
    }
    const profile = (await getValue("interestProfile")) ?? {};
    const rows = buildInterestRows(profile);
    renderInterestList(container, rows);
}
function formatTime(timestamp) {
    if (!timestamp) {
        return "-";
    }
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date
        .getHours()
        .toString()
        .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}
async function loadStatus() {
    const userIdEl = document.getElementById("status-user-id");
    const upUpdateEl = document.getElementById("status-up-update");
    const classifyEl = document.getElementById("status-classify-update");
    const settings = (await getValue("settings")) ?? {};
    const upCache = (await getValue("upList")) ?? null;
    const classifyCache = (await getValue("classifyStatus")) ?? null;
    if (userIdEl) {
        userIdEl.textContent = settings.userId ? String(settings.userId) : "-";
    }
    if (upUpdateEl) {
        upUpdateEl.textContent = formatTime(upCache?.lastUpdate ?? null);
    }
    if (classifyEl) {
        classifyEl.textContent = formatTime(classifyCache?.lastUpdate ?? null);
    }
}
async function jumpToRandomUP() {
    const upCache = (await getValue("upList")) ?? null;
    if (!upCache || !upCache.upList || upCache.upList.length === 0) {
        alert("没有已关注的UP主数据，请先更新关注列表");
        return;
    }
    const randomIndex = Math.floor(Math.random() * upCache.upList.length);
    const randomUP = upCache.upList[randomIndex];
    if (typeof chrome !== "undefined") {
        chrome.tabs.create({ url: `https://space.bilibili.com/${randomUP.mid}` });
    }
}
export function initPopup() {
    if (typeof document === "undefined") {
        return;
    }
    const updateUpBtn = document.getElementById("btn-update-up");
    const autoClassifyBtn = document.getElementById("btn-auto-classify");
    const randomUpBtn = document.getElementById("btn-random-up");
    const statsBtn = document.getElementById("btn-stats");
    const settingsBtn = document.getElementById("btn-settings");
    updateUpBtn?.addEventListener("click", () => sendAction("update_up_list"));
    autoClassifyBtn?.addEventListener("click", () => sendAction("start_auto_classification"));
    randomUpBtn?.addEventListener("click", () => void jumpToRandomUP());
    statsBtn?.addEventListener("click", () => {
        if (typeof chrome !== "undefined") {
            chrome.tabs.create({ url: chrome.runtime.getURL("ui/stats/stats.html") });
        }
    });
    settingsBtn?.addEventListener("click", () => {
        if (typeof chrome !== "undefined") {
            chrome.tabs.create({ url: chrome.runtime.getURL("ui/options/options.html") });
        }
    });
    void loadStatus();
}
if (typeof document !== "undefined") {
    initPopup();
}
