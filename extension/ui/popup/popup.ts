/**
 * Popup UI logic.
 */

import { getValue } from "../../storage/storage.js";

export interface InterestProfile {
  [tag: string]: { tag: string; score: number };
}

export interface UP {
  mid: number;
  name: string;
  face: string;
  sign: string;
  follow_time: number;
}

export interface UPCache {
  upList: UP[];
  lastUpdate: number;
}

export interface ClassifyCache {
  lastUpdate: number;
}

export interface InterestRow {
  tag: string;
  score: number;
  ratio: number;
}

declare const chrome: {
  runtime: { 
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
    getURL: (path: string) => string;
    onMessage: {
      addListener: (callback: (message: unknown) => void) => void;
      removeListener: (callback: (message: unknown) => void) => void;
    };
  };
  tabs: {
    create: (options: { url: string }) => void;
    query: (queryInfo: { active?: boolean; currentWindow?: boolean }) => Promise<{ id?: number }[]>;
    update: (tabId: number | undefined, updateProperties: { url: string }) => void;
  };
};

export function sortInterests(profile: InterestProfile): InterestRow[] {
  return Object.values(profile)
    .map((item) => ({ tag: item.tag, score: item.score, ratio: 0 }))
    .sort((a, b) => b.score - a.score);
}

export function buildInterestRows(profile: InterestProfile): InterestRow[] {
  const rows = sortInterests(profile);
  const maxScore = rows.length > 0 ? rows[0].score : 0;
  return rows.map((row) => ({
    ...row,
    ratio: maxScore > 0 ? Math.min(1, row.score / maxScore) : 0
  }));
}

function renderInterestList(container: HTMLElement, rows: InterestRow[]): void {
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

function sendAction(type: string): void {
  if (typeof chrome === "undefined") {
    console.log("[Popup] Action", type);
    return;
  }
  chrome.runtime.sendMessage({ type });
}

async function handleUpdateUpList(): Promise<void> {
  if (typeof chrome === "undefined") {
    console.log("[Popup] Update UP list");
    return;
  }

  try {
    const response = await new Promise<{ success: boolean; newCount?: number }>((resolve) => {
      chrome.runtime.sendMessage({ type: "update_up_list" }, (response) => {
        resolve(response as { success: boolean; newCount?: number });
      });
    });

    if (response.success) {
      if (response.newCount && response.newCount > 0) {
        alert(`更新成功！发现 ${response.newCount} 个新关注的UP主`);
      } else {
        alert("更新成功！没有发现新的UP主");
      }
      // Reload status after update
      void loadStatus();
    } else {
      alert("更新失败，请检查设置");
    }
  } catch (error) {
    console.error("[Popup] Update UP list error", error);
    alert("更新失败，请稍后重试");
  }
}

// 进度条相关
let progressInterval: number | null = null;
let progressListener: ((message: unknown) => void) | null = null;

function showProgress(): void {
  const section = document.getElementById("classify-progress-section");
  if (section) {
    section.style.display = "block";
  }
}

function hideProgress(): void {
  const section = document.getElementById("classify-progress-section");
  if (section) {
    section.style.display = "none";
  }
  if (progressInterval !== null) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function updateProgress(current: number, total: number, text: string): void {
  const progressText = document.getElementById("progress-text");
  const progressCount = document.getElementById("progress-count");
  const progressFill = document.getElementById("progress-fill");
  
  if (progressText) progressText.textContent = text;
  if (progressCount) progressCount.textContent = `${current}/${total}`;
  if (progressFill) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
  }
}

async function handleAutoClassify(): Promise<void> {
  if (typeof chrome === "undefined") {
    console.log("[Popup] Auto classify");
    return;
  }

  try {
    showProgress();
    updateProgress(0, 0, "准备中...");

    const listener = (message: unknown) => {
      const msg = message as { type: string; payload?: unknown };
      if (msg.type === "classify_progress") {
        const payload = msg.payload as { current: number; total: number; text: string };
        updateProgress(payload.current, payload.total, payload.text);
      } else if (msg.type === "classify_complete") {
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
  } catch (error) {
    console.error("[Popup] Auto classify error", error);
    hideProgress();
    alert("分类失败，请稍后重试");
  }
}

async function hydrateProgress(): Promise<void> {
  if (typeof chrome === "undefined") {
    return;
  }
  const response = await sendActionWithResponse("get_classify_progress");
  const progress = response as { active?: boolean; current?: number; total?: number; text?: string } | null;
  if (progress?.active) {
    showProgress();
    updateProgress(progress.current ?? 0, progress.total ?? 0, progress.text ?? "准备中...");
  }
}

function sendActionWithResponse(type: string): Promise<unknown> {
  if (typeof chrome === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, (response) => {
      resolve(response ?? null);
    });
  });
}

export function formatRecommendTitle(title: string | null): string {
  return title && title.trim().length > 0 ? title.trim() : "-";
}

function setRecommendTitle(title: string | null): void {
  const el = document.getElementById("recommend-title");
  if (el) {
    el.textContent = formatRecommendTitle(title);
  }
}

async function loadInterests(): Promise<void> {
  const container = document.getElementById("interest-list");
  if (!container) {
    return;
  }
  const profile = (await getValue<InterestProfile>("interestProfile")) ?? {};
  const rows = buildInterestRows(profile);
  renderInterestList(container, rows);
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) {
    return "-";
  }
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

async function loadStatus(): Promise<void> {
  const userIdEl = document.getElementById("status-user-id");
  const upUpdateEl = document.getElementById("status-up-update");
  const classifyEl = document.getElementById("status-classify-update");

  const settings = (await getValue<{ userId?: number }>("settings")) ?? {};
  const upCache = (await getValue<UPCache>("upList")) ?? null;
  const classifyCache = (await getValue<ClassifyCache>("classifyStatus")) ?? null;

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

async function jumpToRandomUP(): Promise<void> {
  const upCache = (await getValue<UPCache>("upList")) ?? null;
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
    } else {
      chrome.tabs.update(undefined, { url: `https://space.bilibili.com/${randomUP.mid}` });
    }
  }
}

export function initPopup(): void {
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
    progressListener = (message: unknown) => {
      const msg = message as { type: string; payload?: unknown };
      if (msg.type === "classify_progress") {
        const payload = msg.payload as { current: number; total: number; text: string };
        showProgress();
        updateProgress(payload.current, payload.total, payload.text);
      } else if (msg.type === "classify_complete") {
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
