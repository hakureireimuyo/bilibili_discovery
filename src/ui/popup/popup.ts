import { getValue, loadUPList, type ClassifyStatus, type InterestProfile } from "../../database/implementations/index.js";
import { armProgressTimeout, bindProgressListener, hideProgress, showProgress, updateProgress } from "./popup-progress.js";
import { hasChromeRuntime, navigateCurrentTab, openExtensionPage, sendMessage } from "./popup-runtime.js";
import type { InterestRow } from "./popup-types.js";

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

export function formatRecommendTitle(title: string | null): string {
  return title && title.trim().length > 0 ? title.trim() : "-";
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

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

async function hydrateProgress(): Promise<void> {
  const progress = await sendMessage<{ active?: boolean; current?: number; total?: number; text?: string }>(
    "get_classify_progress"
  );
  if (progress?.active) {
    showProgress();
    updateProgress(progress.current ?? 0, progress.total ?? 0, progress.text ?? "准备中...");
  }
}

async function loadStatus(): Promise<void> {
  const settings = (await getValue<{ userId?: number }>("settings")) ?? {};
  const upCache = await loadUPList();
  const classifyCache = (await getValue<ClassifyStatus>("classifyStatus")) ?? null;

  setText("status-user-id", settings.userId ? String(settings.userId) : "-");
  setText("status-up-update", formatTime(upCache?.lastUpdate ?? null));
  setText("status-classify-update", formatTime(classifyCache?.lastUpdate ?? null));
}

async function handleUpdateUpList(): Promise<void> {
  if (!hasChromeRuntime()) {
    return;
  }

  try {
    const response = await sendMessage<{ success: boolean; newCount?: number }>("update_up_list");
    if (!response) {
      alert("更新失败，未收到响应");
      return;
    }
    if (response.success) {
      alert(
        response.newCount && response.newCount > 0
          ? `更新成功！发现 ${response.newCount} 个新关注的UP主`
          : "更新成功！没有发现新的UP主"
      );
      await loadStatus();
      return;
    }
    alert("更新失败，请检查设置");
  } catch (error) {
    console.error("[Popup] Update UP list error", error);
    alert("更新失败，请稍后重试");
  }
}

async function handleAutoClassify(): Promise<void> {
  if (!hasChromeRuntime()) {
    return;
  }

  try {
    showProgress();
    updateProgress(0, 0, "准备中...");
    bindProgressListener(() => {
      alert("分类完成！");
      void loadStatus();
    });
    await sendMessage("start_auto_classification");
    armProgressTimeout();
  } catch (error) {
    console.error("[Popup] Auto classify error", error);
    hideProgress();
    alert("分类失败，请稍后重试");
  }
}

async function jumpToRandomUP(): Promise<void> {
  const upCache = await loadUPList();
  if (!upCache?.upList?.length) {
    alert("没有已关注的UP主数据，请先更新关注列表");
    return;
  }
  const randomUP = upCache.upList[Math.floor(Math.random() * upCache.upList.length)];
  await navigateCurrentTab(`https://space.bilibili.com/${randomUP.mid}`);
}

function bindButtons(): void {
  document.getElementById("btn-update-up")?.addEventListener("click", () => void handleUpdateUpList());
  document.getElementById("btn-auto-classify")?.addEventListener("click", () => void handleAutoClassify());
  document.getElementById("btn-random-up")?.addEventListener("click", () => void jumpToRandomUP());
  document.getElementById("btn-stats")?.addEventListener("click", () => openExtensionPage("ui/stats/stats.html"));
  document.getElementById("btn-watch-stats")?.addEventListener("click", () => openExtensionPage("ui/watch-stats/watch-stats.html"));
  document.getElementById("btn-settings")?.addEventListener("click", () => openExtensionPage("ui/options/options.html"));
}

export function initPopup(): void {
  if (typeof document === "undefined") {
    return;
  }
  bindButtons();
  bindProgressListener(() => undefined);
  void hydrateProgress();
  void loadStatus();
}

if (typeof document !== "undefined") {
  initPopup();
}
