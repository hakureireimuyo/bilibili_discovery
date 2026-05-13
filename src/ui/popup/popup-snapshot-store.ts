import type { Creator } from "../../database/types/creator.js";

export type WidgetId = "today" | "week" | "following" | "favorites" | "tags" | "records";

export interface PopupSnapshot {
  userId: number | null;
  todayWatchDuration: number;
  weeklyWatchDuration: number;
  followingCount: number;
  favoriteCount: number;
  tagCount: number;
  watchRecordCount: number;
  lastUpdateTime: number | null;
  recentActiveDays: number;
  focusCreators: string[];
  dailyWatchDurations: Record<string, number>;
  generatedAt: number | null;
  snapshotVersion: number;
}

const POPUP_SNAPSHOT_KEY = "popup:snapshot:v1";
const POPUP_SNAPSHOT_VERSION = 1;

interface ChromeStorageAreaLike {
  get: (key: string, callback: (result: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>, callback: () => void) => void;
}

interface ChromeLike {
  runtime?: {
    lastError?: {
      message?: string;
    };
  };
  storage?: {
    local?: ChromeStorageAreaLike;
  };
}

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecentDateKeys(days: number, now: number = Date.now()): Set<string> {
  const keys = new Set<string>();
  const date = new Date(now);

  for (let offset = 0; offset < days; offset += 1) {
    const item = new Date(date);
    item.setDate(date.getDate() - offset);
    keys.add(getDateKey(item.getTime()));
  }

  return keys;
}

export function createEmptyPopupSnapshot(): PopupSnapshot {
  return {
    userId: null,
    todayWatchDuration: 0,
    weeklyWatchDuration: 0,
    followingCount: 0,
    favoriteCount: 0,
    tagCount: 0,
    watchRecordCount: 0,
    lastUpdateTime: null,
    recentActiveDays: 0,
    focusCreators: [],
    dailyWatchDurations: {},
    generatedAt: null,
    snapshotVersion: POPUP_SNAPSHOT_VERSION
  };
}

function normalizeSnapshot(snapshot: Partial<PopupSnapshot> | null | undefined): PopupSnapshot {
  return {
    ...createEmptyPopupSnapshot(),
    ...snapshot,
    focusCreators: snapshot?.focusCreators?.filter(Boolean).slice(0, 3) ?? [],
    dailyWatchDurations: snapshot?.dailyWatchDurations ?? {},
    snapshotVersion: POPUP_SNAPSHOT_VERSION
  };
}

function getChrome(): ChromeLike | null {
  const candidate = (globalThis as { chrome?: ChromeLike }).chrome;
  return candidate ?? null;
}

function getStorageArea(): ChromeStorageAreaLike | null {
  const chromeApi = getChrome();
  if (!chromeApi?.storage?.local) {
    return null;
  }

  return chromeApi.storage.local;
}

async function storageGet<T>(key: string): Promise<T | null> {
  const storage = getStorageArea();
  if (!storage) {
    return null;
  }

  return new Promise((resolve) => {
    storage.get(key, (result) => {
      const chromeApi = getChrome();
      if (chromeApi?.runtime?.lastError) {
        console.warn("[popup-snapshot-store] 读取快照失败:", chromeApi.runtime.lastError.message);
        resolve(null);
        return;
      }

      resolve((result[key] as T | undefined) ?? null);
    });
  });
}

async function storageSet<T>(key: string, value: T): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    return;
  }

  await new Promise<void>((resolve) => {
    storage.set({ [key]: value }, () => {
      const chromeApi = getChrome();
      if (chromeApi?.runtime?.lastError) {
        console.warn("[popup-snapshot-store] 写入快照失败:", chromeApi.runtime.lastError.message);
      }
      resolve();
    });
  });
}

export async function readPopupSnapshot(): Promise<PopupSnapshot> {
  return normalizeSnapshot(await storageGet<Partial<PopupSnapshot>>(POPUP_SNAPSHOT_KEY));
}

export async function writePopupSnapshot(snapshot: PopupSnapshot): Promise<void> {
  await storageSet(POPUP_SNAPSHOT_KEY, normalizeSnapshot(snapshot));
}

export async function patchPopupSnapshot(
  updater: (snapshot: PopupSnapshot) => PopupSnapshot | void
): Promise<PopupSnapshot> {
  const current = await readPopupSnapshot();
  const updated = normalizeSnapshot(updater(current) ?? current);
  await writePopupSnapshot(updated);
  return updated;
}

export async function recordPopupWatchDelta(options: {
  watchDuration: number;
  watchTime?: number;
  isNewRecord: boolean;
  updateTime?: number;
}): Promise<void> {
  const updateTime = options.updateTime ?? Date.now();
  const watchTime = options.watchTime ?? updateTime;
  const dateKey = getDateKey(watchTime);
  const recentKeys = getRecentDateKeys(7, updateTime);

  await patchPopupSnapshot((snapshot) => {
    const dailyWatchDurations = { ...snapshot.dailyWatchDurations };
    dailyWatchDurations[dateKey] = (dailyWatchDurations[dateKey] ?? 0) + Math.max(0, options.watchDuration);

    for (const key of Object.keys(dailyWatchDurations)) {
      if (!recentKeys.has(key)) {
        delete dailyWatchDurations[key];
      }
    }

    const todayKey = getDateKey(updateTime);
    snapshot.dailyWatchDurations = dailyWatchDurations;
    snapshot.todayWatchDuration = dailyWatchDurations[todayKey] ?? 0;
    snapshot.weeklyWatchDuration = Array.from(recentKeys).reduce(
      (sum, key) => sum + (dailyWatchDurations[key] ?? 0),
      0
    );
    snapshot.recentActiveDays = Object.values(dailyWatchDurations).filter((duration) => duration > 0).length;
    snapshot.watchRecordCount = Math.max(0, snapshot.watchRecordCount + (options.isNewRecord ? 1 : 0));
    snapshot.lastUpdateTime = updateTime;
    snapshot.generatedAt = updateTime;
  });
}

export async function recordPopupFavoriteDelta(delta: number): Promise<void> {
  await patchPopupSnapshot((snapshot) => {
    snapshot.favoriteCount = Math.max(0, snapshot.favoriteCount + delta);
    snapshot.lastUpdateTime = Date.now();
    snapshot.generatedAt = snapshot.lastUpdateTime;
  });
}

export async function recordPopupTagDelta(delta: number): Promise<void> {
  if (delta === 0) {
    return;
  }

  await patchPopupSnapshot((snapshot) => {
    snapshot.tagCount = Math.max(0, snapshot.tagCount + delta);
    snapshot.lastUpdateTime = Date.now();
    snapshot.generatedAt = snapshot.lastUpdateTime;
  });
}

export async function recordPopupCreatorChange(previous: Creator | null, next: Creator): Promise<void> {
  const wasFollowing = previous?.isFollowing === 1;
  const isFollowing = next.isFollowing === 1;
  const creatorName = next.name?.trim();

  await patchPopupSnapshot((snapshot) => {
    if (!wasFollowing && isFollowing) {
      snapshot.followingCount += 1;
    } else if (wasFollowing && !isFollowing) {
      snapshot.followingCount = Math.max(0, snapshot.followingCount - 1);
    }

    if (creatorName) {
      const names = snapshot.focusCreators.filter((name) => name && name !== previous?.name && name !== creatorName);
      if (isFollowing) {
        snapshot.focusCreators = [creatorName, ...names].slice(0, 3);
      } else {
        snapshot.focusCreators = names.slice(0, 3);
      }
    }

    snapshot.lastUpdateTime = Date.now();
    snapshot.generatedAt = snapshot.lastUpdateTime;
  });
}
