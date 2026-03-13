import { getValue, loadUPList } from "../../storage/storage.js";
import { formatSeconds, formatTime, getRecentDays } from "./utils.js";
import { renderHeatmap } from "./heatmap.js";
import { renderLineChart } from "./line-chart.js";
import { renderTagList, renderUPList, renderVideoList } from "./list-renderer.js";
import { initVideoSearch, initTagSearch } from "./search.js";
import type { WatchStats } from "../../background/modules/common-types";
import type { UP } from "../../storage/storage";

/**
 * 刷新统计数据
 */
async function refreshStats(): Promise<WatchStats | null> {
  console.log("[WatchStats UI] Loading stats...");
  const stats = await getValue<WatchStats>("watchStats");
  console.log("[WatchStats UI] Retrieved stats:", stats);
  
  if (!stats) {
    console.log("[WatchStats UI] No stats found");
    return null;
  }

  // 加载已关注的UP列表
  const upCache = await loadUPList();
  const upInfoMap = new Map<number, UP>();
  if (upCache?.upList) {
    for (const up of upCache.upList) {
      upInfoMap.set(up.mid, up);
    }
  }

  console.log("[WatchStats UI] Retrieved stats:", stats);
  const todayKey = getRecentDays(1)[0];
  const last7Days = getRecentDays(7);
  const total7Days = last7Days.reduce((sum, day) => sum + (stats.dailySeconds[day] ?? 0), 0);

  // 更新统计卡片
  const totalEl = document.getElementById("stat-total");
  const todayEl = document.getElementById("stat-today");
  const sevenEl = document.getElementById("stat-7days");
  const updateEl = document.getElementById("stat-update");

  if (totalEl) totalEl.textContent = formatSeconds(stats.totalSeconds);
  if (todayEl) todayEl.textContent = formatSeconds(stats.dailySeconds[todayKey] ?? 0);
  if (sevenEl) sevenEl.textContent = formatSeconds(total7Days);
  if (updateEl) updateEl.textContent = formatTime(stats.lastUpdate || null);

  // 渲染热力图和折线图
  renderHeatmap(stats.dailySeconds);
  renderLineChart(stats.dailySeconds);

  // 渲染标签列表
  await renderTagList(stats);

  // 渲染UP列表
  renderUPList(stats, upInfoMap);

  // 渲染视频列表
  renderVideoList(stats);

  // 显示原始数据（调试用）
  const rawEl = document.getElementById("raw-stats");
  if (rawEl) {
    rawEl.textContent = JSON.stringify(stats, null, 2);
  }
  
  return stats;
}

/**
 * 初始化观看统计页面
 */
async function initWatchStats(): Promise<void> {
  // 初始加载数据
  const stats = await refreshStats();

  // 只在有数据时初始化搜索功能
  if (stats) {
    initVideoSearch(stats);
    await initTagSearch(stats);
  }
}

// 页面加载时初始化
if (typeof document !== "undefined") {
  void initWatchStats();
}
