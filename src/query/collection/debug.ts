/**
 * 收藏夹查询模块调试工具
 * 用于诊断收藏夹查询相关的问题
 * 使用Repository实现层访问数据
 */

import type { Collection } from '../../database/types/collection.js';
import type { CollectionItem } from '../../database/types/collection.js';
import type { Video } from '../../database/types/video.js';
import { Platform } from '../../database/types/base.js';
import { CollectionRepository } from '../../database/implementations/collection-repository.impl.js';
import { CollectionItemRepository } from '../../database/implementations/collection-item-repository.impl.js';
import { VideoRepository } from '../../database/implementations/video-repository.impl.js';
import { CollectionIndexCache } from '../../cache/index-cache/collection-index-cache.js';

// 创建Repository实例
const collectionRepository = new CollectionRepository();
const collectionItemRepository = new CollectionItemRepository();
const videoRepository = new VideoRepository();

// 创建收藏夹索引缓存实例
const collectionIndexCache = new CollectionIndexCache(100);

/**
 * 检查收藏夹数据
 */
export async function debugCollectionData(collectionId: string): Promise<void> {
  console.log(`[Debug] Checking collection data for ${collectionId}`);

  // 检查Collection
  const collection = await collectionRepository.getCollection(collectionId);
  console.log('[Debug] Collection:', collection);

  // 检查CollectionItems
  const items = await collectionItemRepository.getItemsByCollection(collectionId);
  console.log(`[Debug] CollectionItems count: ${items.length}`);
  console.log('[Debug] CollectionItems:', items);

  // 检查Videos
  if (items.length > 0) {
    const videoIds = items.map(item => item.videoId);
    console.log('[Debug] Video IDs:', videoIds);

    const videos = await videoRepository.getVideos(videoIds, Platform.BILIBILI);
    console.log('[Debug] Videos:', videos);
  }
}

/**
 * 检查所有收藏夹
 */
export async function debugAllCollections(): Promise<void> {
  console.log('[Debug] Checking all collections...');

  // 获取所有Collection
  const allCollections = await collectionRepository.getAllCollections();
  console.log(`[Debug] Total collections: ${allCollections.length}`);

  // 检查每个Collection的Items
  for (const collection of allCollections) {
    await debugCollectionData(collection.collectionId);
  }
}

/**
 * 检查收藏夹索引缓存
 */
export async function debugCollectionIndexCache(): Promise<void> {
  console.log('[Debug] Checking collection index cache...');

  const stats = collectionIndexCache.getStats();
  console.log('[Debug] Cache stats:', stats);
}

/**
 * 运行完整诊断
 */
export async function runFullDiagnostics(): Promise<void> {
  console.log('[Debug] ===== Starting diagnostics =====');

  await debugAllCollections();
  await debugCollectionIndexCache();

  console.log('[Debug] ===== Diagnostics complete =====');
}

// 暴露到window对象以便在控制台调用
if (typeof window !== 'undefined') {
  (window as any).debugCollectionQuery = {
    debugCollectionData,
    debugAllCollections,
    debugCollectionIndexCache,
    runFullDiagnostics
  };
  console.log('[Debug] Debug tools available at window.debugCollectionQuery');
}
