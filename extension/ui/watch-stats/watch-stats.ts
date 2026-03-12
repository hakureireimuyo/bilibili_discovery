import { getValue } from "../../storage/storage.js";

interface WatchStats {
  totalSeconds: number;
  dailySeconds: Record<string, number>;
  upSeconds: Record<string, number>;
  videoSeconds: Record<string, number>;
  videoTitles: Record<string, string>;
  videoTags: Record<string, string[]>;
  videoUpIds: Record<string, number>;
  lastUpdate: number;
}

function formatSeconds(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function getRecentDays(count: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    days.push(`${date.getFullYear()}-${month}-${day}`);
  }
  return days;
}

function renderList(
  containerId: string,
  rows: Array<{ label: string; value: number }>
): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (rows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    container.appendChild(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.textContent = row.label;
    const value = document.createElement("span");
    value.textContent = formatSeconds(row.value);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

function renderKeyValueList(
  containerId: string,
  rows: Array<{ label: string; value: string }>
): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (rows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    container.appendChild(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.textContent = row.label;
    const value = document.createElement("span");
    value.textContent = row.value;
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

function buildTopRows(
  data: Record<string, number>,
  labelMap?: Record<string, string>,
  limit = 10
): Array<{ label: string; value: number }> {
  return Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({
      label: labelMap?.[key] ?? key,
      value
    }));
}

async function initWatchStats(): Promise<void> {
  const stats =
    (await getValue<WatchStats>("watchStats")) ?? {
      totalSeconds: 0,
      dailySeconds: {},
      upSeconds: {},
      videoSeconds: {},
      videoTitles: {},
      videoTags: {},
      videoUpIds: {},
      lastUpdate: 0
    };

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

  const dailyRows = last7Days
    .map((day) => ({
      label: day,
      value: stats.dailySeconds[day] ?? 0
    }))
    .reverse();

  renderList("daily-list", dailyRows);
  const tagTotals: Record<string, number> = {};
  for (const [videoKey, tags] of Object.entries(stats.videoTags)) {
    const seconds = stats.videoSeconds[videoKey] ?? 0;
    for (const tag of tags || []) {
      tagTotals[tag] = (tagTotals[tag] ?? 0) + seconds;
    }
  }

  renderList("tag-list", buildTopRows(tagTotals));
  renderList("up-list", buildTopRows(stats.upSeconds));
  renderList("video-list", buildTopRows(stats.videoSeconds, stats.videoTitles));

  const rawEl = document.getElementById("raw-stats");
  if (rawEl) {
    rawEl.textContent = JSON.stringify(stats, null, 2);
  }

  const videoDetailRows = Object.keys(stats.videoSeconds)
    .sort((a, b) => (stats.videoSeconds[b] ?? 0) - (stats.videoSeconds[a] ?? 0))
    .map((key) => {
      const title = stats.videoTitles[key] ?? key;
      const upId = stats.videoUpIds[key] ?? 0;
      const tagList = (stats.videoTags[key] ?? []).join(", ");
      return {
        label: `${title} | ${key}`,
        value: `${formatSeconds(stats.videoSeconds[key] ?? 0)} | up: ${upId} | tags: ${tagList}`
      };
    });
  renderKeyValueList("video-detail", videoDetailRows);

  const upDetailRows = Object.keys(stats.upSeconds)
    .sort((a, b) => (stats.upSeconds[b] ?? 0) - (stats.upSeconds[a] ?? 0))
    .map((key) => ({
      label: `UP ${key}`,
      value: formatSeconds(stats.upSeconds[key] ?? 0)
    }));
  renderKeyValueList("up-detail", upDetailRows);
}

if (typeof document !== "undefined") {
  void initWatchStats();
}
