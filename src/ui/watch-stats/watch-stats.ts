import { getAggregatedWatchStats, loadUPList } from "../../database/implementations/index.js";
import { formatSeconds, formatTime, getRecentDays } from "./utils.js";
import { renderHeatmap } from "./heatmap.js";
import { renderLineChart } from "./line-chart.js";
import { renderTagList, renderUPList, renderVideoList } from "./list-renderer.js";
import { initVideoSearch, initTagSearch } from "./search.js";
import type { WatchStats } from "../../background/modules/types.js";
import type { UP } from "../../database/implementations/index.js";

async function refreshStats(): Promise<WatchStats | null> {
  console.log("[WatchStats UI] Loading stats...");
  const stats = await getAggregatedWatchStats() as WatchStats | null;
  console.log("[WatchStats UI] Retrieved stats:", stats);

  if (!stats) {
    console.log("[WatchStats UI] No stats found");
    return null;
  }

  const upCache = await loadUPList();
  const upInfoMap = new Map<number, UP>();
  if (upCache?.upList) {
    for (const up of upCache.upList) {
      upInfoMap.set(up.mid, up);
    }
  }

  const todayKey = getRecentDays(1)[0];
  const last7Days = getRecentDays(7);
  const total7Days = last7Days.reduce((sum, day) => sum + (stats.dailySeconds[day] ?? 0), 0);

  const totalEl = document.getElementById("stat-total");
  const todayEl = document.getElementById("stat-today");
  const sevenEl = document.getElementById("stat-7days");
  const updateEl = document.getElementById("stat-update");

  if (totalEl) totalEl.textContent = formatSeconds(stats.totalSeconds);
  if (todayEl) todayEl.textContent = formatSeconds(stats.dailySeconds[todayKey] ?? 0);
  if (sevenEl) sevenEl.textContent = formatSeconds(total7Days);
  if (updateEl) updateEl.textContent = formatTime(stats.lastUpdate || null);

  renderHeatmap(stats.dailySeconds);
  renderLineChart(stats.dailySeconds);
  await renderTagList(stats);
  renderUPList(stats, upInfoMap);
  renderVideoList(stats);

  const rawEl = document.getElementById("raw-stats");
  if (rawEl) {
    rawEl.textContent = JSON.stringify(stats, null, 2);
  }

  return stats;
}

async function initWatchStats(): Promise<void> {
  const stats = await refreshStats();
  if (stats) {
    await initTagSearch(stats);
    initVideoSearch(stats);
  }
}

if (typeof document !== "undefined") {
  void initWatchStats();
}
