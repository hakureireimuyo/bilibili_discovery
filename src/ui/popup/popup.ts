import { getValue, loadUPList, type ClassifyStatus, type InterestProfile } from "../../database/implementations/index.js";
import { getAllCollectionVideos } from "../../database/implementations/collection-facade.impl.js";
import { armProgressTimeout, bindProgressListener, hideProgress, showProgress, updateProgress } from "./popup-progress.js";
import { armSyncProgressTimeout, bindSyncProgressListener, hideSyncProgress, showSyncProgress, updateSyncProgress } from "./popup-sync-progress.js";
import { hasChromeRuntime, navigateCurrentTab, openExtensionPage, sendMessage } from "./popup-runtime.js";
import type { InterestRow } from "./popup-types.js";

type ClassifyProgress = {
  active?: boolean;
  stopping?: boolean;
  current?: number;
  total?: number;
  title?: string;
  detail?: string;
  text?: string;
};

type SyncProgress = {
  active?: boolean;
  stopping?: boolean;
  current?: number;
  total?: number;
  title?: string;
  detail?: string;
  text?: string;
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
  const progress = await sendMessage<ClassifyProgress>("get_classify_progress");
  if (progress?.active) {
    showProgress();
    updateProgress({
      current: progress.current ?? 0,
      total: progress.total ?? 0,
      title: progress.title,
      detail: progress.detail,
      text: progress.text,
      stopping: progress.stopping
    });
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
    const progress = await sendMessage<ClassifyProgress>("get_classify_progress");
    if (progress?.active) {
      updateProgress({
        current: progress.current ?? 0,
        total: progress.total ?? 0,
        title: "正在停止分类",
        detail: "等待当前任务收尾并关闭采集标签页",
        stopping: true
      });
      await sendMessage("stop_auto_classification");
      armProgressTimeout();
      return;
    }

    showProgress();
    updateProgress({
      current: 0,
      total: 0,
      title: "自动分类",
      detail: "准备中...",
      text: "准备中..."
    });
    bindProgressListener(() => {
      hideProgress();
      void loadStatus();
    });
    const response = await sendMessage<{ success?: boolean }>("start_auto_classification");
    if (response?.success === false) {
      hideProgress();
    }
    armProgressTimeout();
  } catch (error) {
    console.error("[Popup] Auto classify error", error);
    hideProgress();
    alert("分类失败，请稍后重试");
  }
}

async function handleSyncFavorites(): Promise<void> {
  if (!hasChromeRuntime()) {
    return;
  }

  try {
    const settings = (await getValue<{ userId?: number }>("settings")) ?? {};
    if (!settings.userId) {
      alert("请先在设置中配置用户UID");
      return;
    }

    const progress = await sendMessage<SyncProgress>("get_sync_progress");
    if (progress?.active) {
      updateSyncProgress({
        current: progress.current ?? 0,
        total: progress.total ?? 0,
        title: "正在停止同步",
        detail: "等待当前任务收尾",
        stopping: true
      });
      await sendMessage("set_should_stop_sync", { shouldStop: true });
      armSyncProgressTimeout();
      return;
    }

    showSyncProgress();
    updateSyncProgress({
      current: 0,
      total: 0,
      title: "同步收藏",
      detail: "准备中...",
      text: "准备中..."
    });
    bindSyncProgressListener(() => {
      hideSyncProgress();
      void loadStatus();
    });
    const response = await sendMessage<{ success?: boolean; count?: number }>("sync_favorite_videos", { uid: settings.userId });
    if (response?.success && response.count !== undefined) {
      alert(`同步完成！共同步 ${response.count} 个收藏视频`);
    } else if (response?.success === false) {
      hideSyncProgress();
    }
    armSyncProgressTimeout();
  } catch (error) {
    console.error("[Popup] Sync favorites error", error);
    hideSyncProgress();
    alert("同步失败，请稍后重试");
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

async function jumpToRandomFavorite(): Promise<void> {
  try {
    const allVideos = await getAllCollectionVideos();
    if (!allVideos || allVideos.length === 0) {
      alert("没有已收藏的视频，请先添加收藏");
      return;
    }
    const randomVideo = allVideos[Math.floor(Math.random() * allVideos.length)];
    await navigateCurrentTab(`https://www.bilibili.com/video/${randomVideo.videoId}`);
  } catch (error) {
    console.error("[Popup] Jump to random favorite error", error);
    alert("跳转失败，请稍后重试");
  }
}

function bindButtons(): void {
  document.getElementById("btn-update-up")?.addEventListener("click", () => void handleUpdateUpList());
  document.getElementById("btn-auto-classify")?.addEventListener("click", () => void handleAutoClassify());
  document.getElementById("btn-sync-favorites")?.addEventListener("click", () => void handleSyncFavorites());
  document.getElementById("btn-random-up")?.addEventListener("click", () => void jumpToRandomUP());
  document.getElementById("btn-random-favorite")?.addEventListener("click", () => void jumpToRandomFavorite());
  document.getElementById("btn-stats")?.addEventListener("click", () => openExtensionPage("ui/stats/stats.html"));
  document.getElementById("btn-watch-stats")?.addEventListener("click", () => openExtensionPage("ui/watch-stats/watch-stats.html"));
  document.getElementById("btn-favorites")?.addEventListener("click", () => openExtensionPage("ui/favorites/favorites.html"));
  document.getElementById("btn-interest-stats")?.addEventListener("click", () => openExtensionPage("ui/interest-stats/interest-stats.html"));
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
