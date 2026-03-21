
/**
 * 收藏同步模块默认配置
 */

import type { FavoriteSyncConfig } from "./types.js";

/**
 * 默认配置
 */
export const DEFAULT_FAVORITE_SYNC_CONFIG: FavoriteSyncConfig = {
  defaultCollectionId: "bilibili_favorites",
  defaultCollectionName: "B站收藏夹",
  defaultCollectionDescription: "从B站同步的收藏视频",
  batchSize: 10,
  createMultipleCollections: true
};
