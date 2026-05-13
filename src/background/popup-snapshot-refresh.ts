import { DailyWatchStatsRepositoryImpl, CreatorRepositoryImpl, getValue } from "../database/implementations/index.js";
import { dbManager } from "../database/indexeddb/index.js";
import { DBUtils, STORE_NAMES } from "../database/indexeddb/index.js";
import { Platform } from "../database/types/base.js";
import { createEmptyPopupSnapshot, writePopupSnapshot, type PopupSnapshot } from "../ui/popup/popup-snapshot-store.js";

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function refreshPopupSnapshotFromDatabase(): Promise<PopupSnapshot> {
  await dbManager.init();

  const dailyStatsRepo = new DailyWatchStatsRepositoryImpl();
  const creatorRepo = new CreatorRepositoryImpl();

  const [settings, recentStats, followingCreators, favoriteCount, tagCount, watchRecordCount] = await Promise.all([
    getValue<{ userId?: number | null }>("settings"),
    dailyStatsRepo.getRecentStats(Platform.BILIBILI, 7),
    creatorRepo.getFollowingCreators(Platform.BILIBILI),
    DBUtils.count(STORE_NAMES.COLLECTION_ITEMS),
    DBUtils.count(STORE_NAMES.TAGS),
    DBUtils.count(STORE_NAMES.WATCH_EVENTS)
  ]);

  const now = Date.now();
  const todayKey = getDateKey(now);
  const dailyWatchDurations = Object.fromEntries(
    recentStats.map((item) => [item.dateKey, item.totalWatchDuration])
  );
  const lastUpdateTime = recentStats.reduce<number | null>((latest, item) => {
    if (!latest || item.updateTime > latest) {
      return item.updateTime;
    }
    return latest;
  }, null);

  const focusCreators = [...followingCreators]
    .sort((left, right) => (right.followTime || 0) - (left.followTime || 0))
    .slice(0, 3)
    .map((item) => item.name)
    .filter(Boolean);

  const snapshot: PopupSnapshot = {
    ...createEmptyPopupSnapshot(),
    userId: settings?.userId ?? null,
    todayWatchDuration: dailyWatchDurations[todayKey] ?? 0,
    weeklyWatchDuration: recentStats.reduce((sum, item) => sum + item.totalWatchDuration, 0),
    followingCount: followingCreators.length,
    favoriteCount,
    tagCount,
    watchRecordCount,
    lastUpdateTime,
    recentActiveDays: recentStats.filter((item) => item.totalWatchCount > 0).length,
    focusCreators,
    dailyWatchDurations,
    generatedAt: now
  };

  await writePopupSnapshot(snapshot);
  return snapshot;
}

export function refreshPopupSnapshotInBackground(reason: string): void {
  void refreshPopupSnapshotFromDatabase().catch((error) => {
    console.warn(`[Background] Popup snapshot refresh failed (${reason}):`, error);
  });
}
