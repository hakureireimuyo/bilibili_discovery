import { getValue, setValue } from "../../storage/storage.js";
import type { BackgroundOptions, WatchProgressPayload, WatchStats } from "./common-types.js";

function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export async function updateWatchStats(
  payload: WatchProgressPayload,
  options: BackgroundOptions = {}
): Promise<void> {
  const getValueFn = options.getValueFn ?? ((key: string) => getValue(key));
  const setValueFn = options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));

  const stats =
    ((await getValueFn("watchStats")) as WatchStats | null) ?? {
      totalSeconds: 0,
      dailySeconds: {},
      upSeconds: {},
      videoSeconds: {},
      videoTitles: {},
      videoTags: {},
      videoUpIds: {},
      lastUpdate: 0
    };

  const delta = Math.max(0, payload.watchedSeconds || 0);
  if (delta <= 0) {
    return;
  }

  const dateKey = toLocalDateKey(payload.timestamp);
  stats.totalSeconds += delta;
  stats.dailySeconds[dateKey] = (stats.dailySeconds[dateKey] ?? 0) + delta;

  const upKey = payload.upMid ? String(payload.upMid) : "unknown";
  stats.upSeconds[upKey] = (stats.upSeconds[upKey] ?? 0) + delta;

  const videoKey = payload.bvid || payload.title || "unknown";
  stats.videoSeconds[videoKey] = (stats.videoSeconds[videoKey] ?? 0) + delta;
  if (payload.title) {
    stats.videoTitles[videoKey] = payload.title;
  }
  if (payload.tags && payload.tags.length > 0) {
    stats.videoTags[videoKey] = Array.from(new Set(payload.tags));
  }
  if (payload.upMid) {
    stats.videoUpIds[videoKey] = payload.upMid;
  }

  stats.lastUpdate = Date.now();
  await setValueFn("watchStats", stats);
}
