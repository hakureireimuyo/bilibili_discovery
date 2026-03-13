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
async function handleUpdateUpList() {
    if (typeof chrome === "undefined") {
        console.log("[Popup] Update UP list");
        return;
    }
    try {
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "update_up_list" }, (response) => {
                resolve(response);
            });
        });
        if (!response) {
            alert("更新失败，未收到响应");
            return;
        }
        if (response.success) {
            if (response.newCount && response.newCount > 0) {
                alert(`更新成功！发现 ${response.newCount} 个新关注的UP主`);
            }
            else {
                alert("更新成功！没有发现新的UP主");
            }
            // Reload status after update
            void loadStatus();
        }
        else {
            alert("更新失败，请检查设置");
        }
    }
    catch (error) {
        console.error("[Popup] Update UP list error", error);
        alert("更新失败，请稍后重试");
    }
}
// 进度条相关
let progressInterval = null;
let progressListener = null;
function showProgress() {
    const section = document.getElementById("classify-progress-section");
    if (section) {
        section.style.display = "block";
    }
}
function hideProgress() {
    const section = document.getElementById("classify-progress-section");
    if (section) {
        section.style.display = "none";
    }
    if (progressInterval !== null) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}
function updateProgress(current, total, text) {
    const progressText = document.getElementById("progress-text");
    const progressCount = document.getElementById("progress-count");
    const progressFill = document.getElementById("progress-fill");
    if (progressText)
        progressText.textContent = text;
    if (progressCount)
        progressCount.textContent = `${current}/${total}`;
    if (progressFill) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressFill.style.width = `${percentage}%`;
    }
}
async function handleAutoClassify() {
    if (typeof chrome === "undefined") {
        console.log("[Popup] Auto classify");
        return;
    }
    try {
        showProgress();
        updateProgress(0, 0, "准备中...");
        const listener = (message) => {
            const msg = message;
            if (msg.type === "classify_progress") {
                const payload = msg.payload;
                updateProgress(payload.current, payload.total, payload.text);
            }
            else if (msg.type === "classify_complete") {
                hideProgress();
                if (progressListener) {
                    chrome.runtime.onMessage.removeListener(progressListener);
                    progressListener = null;
                }
                alert("分类完成！");
                void loadStatus();
            }
        };
        if (progressListener) {
            chrome.runtime.onMessage.removeListener(progressListener);
        }
        chrome.runtime.onMessage.addListener(listener);
        progressListener = listener;
        await sendActionWithResponse("start_auto_classification");
        setTimeout(() => {
            hideProgress();
            if (progressListener) {
                chrome.runtime.onMessage.removeListener(progressListener);
                progressListener = null;
            }
        }, 5 * 60 * 1000);
    }
    catch (error) {
        console.error("[Popup] Auto classify error", error);
        hideProgress();
        alert("分类失败，请稍后重试");
    }
}
async function hydrateProgress() {
    if (typeof chrome === "undefined") {
        return;
    }
    const response = await sendActionWithResponse("get_classify_progress");
    const progress = response;
    if (progress?.active) {
        showProgress();
        updateProgress(progress.current ?? 0, progress.total ?? 0, progress.text ?? "准备中...");
    }
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
        const activeTab = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab[0]?.id) {
            chrome.tabs.update(activeTab[0].id, { url: `https://space.bilibili.com/${randomUP.mid}` });
        }
        else {
            chrome.tabs.update(undefined, { url: `https://space.bilibili.com/${randomUP.mid}` });
        }
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
    const watchStatsBtn = document.getElementById("btn-watch-stats");
    const settingsBtn = document.getElementById("btn-settings");
    updateUpBtn?.addEventListener("click", () => void handleUpdateUpList());
    autoClassifyBtn?.addEventListener("click", () => void handleAutoClassify());
    randomUpBtn?.addEventListener("click", () => void jumpToRandomUP());
    statsBtn?.addEventListener("click", () => {
        if (typeof chrome !== "undefined") {
            chrome.tabs.create({ url: chrome.runtime.getURL("ui/stats/stats.html") });
        }
    });
    watchStatsBtn?.addEventListener("click", () => {
        if (typeof chrome !== "undefined") {
            chrome.tabs.create({ url: chrome.runtime.getURL("ui/watch-stats/watch-stats.html") });
        }
    });
    settingsBtn?.addEventListener("click", () => {
        if (typeof chrome !== "undefined") {
            chrome.tabs.create({ url: chrome.runtime.getURL("ui/options/options.html") });
        }
    });
    if (typeof chrome !== "undefined") {
        progressListener = (message) => {
            const msg = message;
            if (msg.type === "classify_progress") {
                const payload = msg.payload;
                showProgress();
                updateProgress(payload.current, payload.total, payload.text);
            }
            else if (msg.type === "classify_complete") {
                hideProgress();
            }
        };
        chrome.runtime.onMessage.addListener(progressListener);
    }
    void hydrateProgress();
    void loadStatus();
}
if (typeof document !== "undefined") {
    initPopup();
}
