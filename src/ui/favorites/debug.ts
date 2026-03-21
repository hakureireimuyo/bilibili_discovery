
/**
 * 收藏页面调试工具
 * 用于诊断CollectionItem不显示的问题
 */

import { DBUtils, STORE_NAMES } from "../../database/indexeddb/index.js";
import type { Collection } from "../../database/types/collection.js";
import type { CollectionItem } from "../../database/types/collection.js";

/**
 * 检查数据库中的数据
 */
export async function debugCollectionData(collectionId: string): Promise<void> {
  console.log(`[Debug] Checking collection data for ${collectionId}`);

  // 检查Collection
  const collection = await DBUtils.get<Collection>(STORE_NAMES.COLLECTIONS, collectionId);
  console.log('[Debug] Collection:', collection);

  // 检查CollectionItems
  const items = await DBUtils.getByIndex<CollectionItem>(STORE_NAMES.COLLECTION_ITEMS, 'collectionId', collectionId);
  console.log(`[Debug] CollectionItems count: ${items.length}`);
  console.log('[Debug] CollectionItems:', items);

  // 检查Videos
  if (items.length > 0) {
    const videoIds = items.map(item => item.videoId);
    console.log('[Debug] Video IDs:', videoIds);

    for (const videoId of videoIds) {
      const video = await DBUtils.get(STORE_NAMES.VIDEOS, videoId);
      console.log(`[Debug] Video ${videoId}:`, video);
    }
  }
}

/**
 * 检查所有Collection和CollectionItem
 */
export async function debugAllCollections(): Promise<void> {
  console.log('[Debug] Checking all collections...');

  // 获取所有Collection
  const allCollections = await DBUtils.getAll<Collection>(STORE_NAMES.COLLECTIONS);
  console.log(`[Debug] Total collections: ${allCollections.length}`);

  // 检查每个Collection的Items
  for (const collection of allCollections) {
    await debugCollectionData(collection.collectionId);
  }
}

/**
 * 检查所有Videos
 */
export async function debugAllVideos(): Promise<void> {
  console.log('[Debug] Checking all videos...');

  const allVideos = await DBUtils.getAll(STORE_NAMES.VIDEOS);
  console.log(`[Debug] Total videos: ${allVideos.length}`);
  console.log('[Debug] Videos:', allVideos);
}

/**
 * 运行完整诊断
 */
export async function runFullDiagnostics(): Promise<void> {
  console.log('[Debug] ===== Starting diagnostics =====');

  await debugAllCollections();
  await debugAllVideos();

  console.log('[Debug] ===== Diagnostics complete =====');
}

// 暴露到window对象以便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).debugFavorites = {
    debugCollectionData,
    debugAllCollections,
    debugAllVideos,
    runFullDiagnostics
  };
  console.log('[Debug] Debug tools available at window.debugFavorites');
}
