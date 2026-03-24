/**
 * 收藏夹查询实现
 * 基于src/cache和src/database/implementations实现
 */

import type { Collection } from '../../database/types/collection.js';
import type { CollectionItem } from '../../database/types/collection.js';
import type { Video } from '../../database/types/video.js';
import { Platform } from '../../database/types/base.js';
import type { QueryResult, QueryOptions, CategoryQueryParams } from '../types.js';
import { CollectionRepository } from '../../database/implementations/collection-repository.impl.js';
import { CollectionItemRepository } from '../../database/implementations/collection-item-repository.impl.js';
import { VideoRepository } from '../../database/implementations/video-repository.impl.js';
import { CollectionIndexCache } from '../../cache/index-cache/collection-index-cache.js';
import { QueryError } from '../types.js';

// 创建Repository实例
const collectionRepository = new CollectionRepository();
const collectionItemRepository = new CollectionItemRepository();
const videoRepository = new VideoRepository();

// 创建收藏夹索引缓存实例
const collectionIndexCache = new CollectionIndexCache(100);

/**
 * 获取所有收藏夹
 * @param options 查询选项
 * @returns 查询结果
 */
export async function getAllCollections(
  options: QueryOptions = {}
): Promise<QueryResult<Collection>> {
  try {
    // 检查缓存
    const cacheKey = 'collections:all';
    if (options.useCache !== false) {
      const cached = collectionIndexCache.get(cacheKey);
      if (cached) {
        return {
          data: cached,
          total: cached.length,
          page: 0,
          pageSize: cached.length,
          hasNext: false,
          hasPrev: false
        };
      }
    }

    // 从数据库获取数据
    const collections = await collectionRepository.getAllCollections();

    // 更新缓存
    if (options.useCache !== false) {
      collectionIndexCache.set(cacheKey, collections);
    }

    return {
      data: collections,
      total: collections.length,
      page: 0,
      pageSize: collections.length,
      hasNext: false,
      hasPrev: false
    };
  } catch (error) {
    console.error('[CollectionQuery] Error getting all collections:', error);
    throw new QueryError('获取收藏夹列表失败', error as Error);
  }
}

/**
 * 根据ID获取收藏夹
 * @param collectionId 收藏夹ID
 * @param options 查询选项
 * @returns 收藏夹对象
 */
export async function getCollectionById(
  collectionId: string,
  options: QueryOptions = {}
): Promise<Collection | undefined> {
  try {
    // 检查缓存
    const cacheKey = `collection:${collectionId}`;
    if (options.useCache !== false) {
      const cached = collectionIndexCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 从数据库获取数据
    const collection = await collectionRepository.getCollection(collectionId);

    // 更新缓存
    if (collection && options.useCache !== false) {
      collectionIndexCache.set(cacheKey, collection);
    }

    return collection;
  } catch (error) {
    console.error('[CollectionQuery] Error getting collection by id:', error);
    throw new QueryError('获取收藏夹失败', error as Error);
  }
}

/**
 * 获取收藏夹中的视频
 * @param collectionId 收藏夹ID
 * @param page 页码
 * @param pageSize 每页大小
 * @param options 查询选项
 * @returns 查询结果
 */
export async function getCollectionVideos(
  collectionId: string,
  page: number = 0,
  pageSize: number = 20,
  options: QueryOptions = {}
): Promise<QueryResult<Video>> {
  try {
    // 检查缓存
    const cacheKey = `collection:${collectionId}:videos:${page}:${pageSize}`;
    if (options.useCache !== false) {
      const cached = collectionIndexCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 从数据库获取收藏夹项
    const items = await collectionItemRepository.getItemsByCollection(collectionId);
    const videoIds = items.map(item => item.videoId);

    // 计算分页
    const total = videoIds.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageVideoIds = videoIds.slice(startIndex, endIndex);

    // 获取视频数据
    const videos = await videoRepository.getVideos(pageVideoIds, Platform.BILIBILI);

    const result: QueryResult<Video> = {
      data: videos,
      total,
      page,
      pageSize,
      hasNext: page < totalPages - 1,
      hasPrev: page > 0
    };

    // 更新缓存
    if (options.useCache !== false) {
      collectionIndexCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    console.error('[CollectionQuery] Error getting collection videos:', error);
    throw new QueryError('获取收藏夹视频失败', error as Error);
  }
}

/**
 * 创建收藏夹
 * @param collection 收藏夹数据
 * @returns 收藏夹ID
 */
export async function createCollection(collection: Omit<Collection, 'collectionId'>): Promise<string> {
  try {
    const collectionId = await collectionRepository.createCollection(collection);

    // 清空缓存
    collectionIndexCache.clear();

    return collectionId;
  } catch (error) {
    console.error('[CollectionQuery] Error creating collection:', error);
    throw new QueryError('创建收藏夹失败', error as Error);
  }
}

/**
 * 更新收藏夹
 * @param collectionId 收藏夹ID
 * @param collection 收藏夹数据
 * @returns 是否成功
 */
export async function updateCollection(
  collectionId: string,
  collection: Partial<Collection>
): Promise<boolean> {
  try {
    const success = await collectionRepository.updateCollection(collectionId, collection);

    if (success) {
      // 清空缓存
      collectionIndexCache.delete(`collection:${collectionId}`);
      collectionIndexCache.delete('collections:all');
    }

    return success;
  } catch (error) {
    console.error('[CollectionQuery] Error updating collection:', error);
    throw new QueryError('更新收藏夹失败', error as Error);
  }
}

/**
 * 删除收藏夹
 * @param collectionId 收藏夹ID
 * @returns 是否成功
 */
export async function deleteCollection(collectionId: string): Promise<boolean> {
  try {
    const success = await collectionRepository.deleteCollection(collectionId);

    if (success) {
      // 清空缓存
      collectionIndexCache.delete(`collection:${collectionId}`);
      collectionIndexCache.delete('collections:all');
    }

    return success;
  } catch (error) {
    console.error('[CollectionQuery] Error deleting collection:', error);
    throw new QueryError('删除收藏夹失败', error as Error);
  }
}

/**
 * 添加视频到收藏夹
 * @param collectionId 收藏夹ID
 * @param videoId 视频ID
 * @returns 是否成功
 */
export async function addVideoToCollection(
  collectionId: string,
  videoId: string
): Promise<boolean> {
  try {
    const success = await collectionItemRepository.addItem(collectionId, videoId);

    if (success) {
      // 清空相关缓存
      collectionIndexCache.delete(`collection:${collectionId}:videos:*`);
    }

    return success;
  } catch (error) {
    console.error('[CollectionQuery] Error adding video to collection:', error);
    throw new QueryError('添加视频到收藏夹失败', error as Error);
  }
}

/**
 * 从收藏夹移除视频
 * @param collectionId 收藏夹ID
 * @param videoId 视频ID
 * @returns 是否成功
 */
export async function removeVideoFromCollection(
  collectionId: string,
  videoId: string
): Promise<boolean> {
  try {
    const success = await collectionItemRepository.removeItem(collectionId, videoId);

    if (success) {
      // 清空相关缓存
      collectionIndexCache.delete(`collection:${collectionId}:videos:*`);
    }

    return success;
  } catch (error) {
    console.error('[CollectionQuery] Error removing video from collection:', error);
    throw new QueryError('从收藏夹移除视频失败', error as Error);
  }
}

/**
 * 清空收藏夹缓存
 */
export function clearCollectionCache(): void {
  collectionIndexCache.clear();
}
