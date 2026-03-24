/**
 * 视频查询实现
 * 基于src/cache和src/database/implementations实现
 */

import type { Video } from '../../database/types/video.js';
import type { CollectionItem, Collection } from '../../database/types/collection.js';
import type { Tag } from '../../database/types/semantic.js';
import type { Creator } from '../../database/types/creator.js';
import { Platform } from '../../database/types/base.js';
import type { VideoIndex, VideoQueryParams, SearchResult, PrefetchConfig, QueryResult, QueryOptions } from '../types.js';
import { VideoRepository } from '../../database/implementations/video-repository.impl.js';
import { CollectionRepository } from '../../database/implementations/collection-repository.impl.js';
import { CollectionItemRepository } from '../../database/implementations/collection-item-repository.impl.js';
import { TagRepository } from '../../database/implementations/tag-repository.impl.js';
import { CreatorRepository } from '../../database/implementations/creator-repository.impl.js';
import { VideoIndexCache } from '../../cache/index-cache/video-index-cache.js';
import { QueryError } from '../types.js';

// 创建Repository实例
const videoRepository = new VideoRepository();
const collectionRepository = new CollectionRepository();
const collectionItemRepository = new CollectionItemRepository();
const tagRepository = new TagRepository();
const creatorRepository = new CreatorRepository();

// 创建视频索引缓存实例
const videoIndexCache = new VideoIndexCache(1000);

/**
 * 预取配置
 */
const prefetchConfig: PrefetchConfig = {
  enabled: true,
  prefetchPages: 1 // 预取下一页
};

/**
 * 视频数据缓存
 * 缓存完整的视频数据，用于分页显示
 */
class VideoDataCache {
  private cache = new Map<string, Video>();
  private maxSize = 500; // 最多缓存500个视频

  /**
   * 批量获取视频数据
   * 优先从缓存获取，缓存未命中则从数据库加载
   */
  async getBatch(videoIds: string[]): Promise<Video[]> {
    const cachedVideos: Video[] = [];
    const uncachedIds: string[] = [];

    // 先从缓存获取
    videoIds.forEach(id => {
      const cached = this.cache.get(id);
      if (cached) {
        cachedVideos.push(cached);
      } else {
        uncachedIds.push(id);
      }
    });

    // 从数据库加载未缓存的视频
    if (uncachedIds.length > 0) {
      try {
        // 使用VideoRepository获取视频数据
        const dbVideos = await videoRepository.getVideos(uncachedIds, Platform.BILIBILI);
        dbVideos.forEach(video => {
          this.cache.set(video.videoId, video);
          cachedVideos.push(video);
        });
      } catch (error) {
        console.error('[VideoDataCache] Error loading videos from DB:', error);
      }
    }

    return cachedVideos;
  }

  /**
   * 预取视频数据
   */
  async prefetch(videoIds: string[]): Promise<void> {
    const uncachedIds = videoIds.filter(id => !this.cache.has(id));
    if (uncachedIds.length === 0) return;

    try {
      // 使用VideoRepository获取视频数据
      const dbVideos = await videoRepository.getVideos(uncachedIds, Platform.BILIBILI);
      dbVideos.forEach(video => {
        if (!this.cache.has(video.videoId)) {
          this.cache.set(video.videoId, video);
        }
      });
    } catch (error) {
      console.error('[VideoDataCache] Error prefetching videos:', error);
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }
}

const videoDataCache = new VideoDataCache();

/**
 * 构建视频索引
 * 从数据库加载所有必要数据并构建内存索引
 * 使用Repository实现层访问数据
 */
export async function buildVideoIndex(collectionId?: string, collectionType?: 'user' | 'subscription'): Promise<void> {
  try {
    // 清空现有索引
    videoIndexCache.clear();

    // 加载收藏夹项
    let collectionItems: CollectionItem[] = [];
    if (collectionId === 'all') {
      // 加载所有收藏夹的视频
      const allCollections = await collectionRepository.getAllCollections();
      const filteredCollections = collectionType
        ? allCollections.filter((c: any) => c.type === collectionType)
        : allCollections;

      for (const collection of filteredCollections) {
        const items = await collectionItemRepository.getItemsByCollection(collection.collectionId);
        collectionItems.push(...items);
      }
    } else if (collectionId) {
      // 加载指定收藏夹的视频
      collectionItems = await collectionItemRepository.getItemsByCollection(collectionId);
    }

    if (collectionItems.length === 0) {
      return;
    }

    // 批量加载视频数据
    const videoIds = collectionItems.map(item => item.videoId);
    const videos = await videoRepository.getVideos(videoIds, Platform.BILIBILI);

    // 构建视频ID到收藏夹ID的映射
    const videoToCollection = new Map<string, string>();
    collectionItems.forEach(item => {
      videoToCollection.set(item.videoId, item.collectionId);
    });

    // 批量加载创作者数据
    const creatorIds = Array.from(new Set(videos.map(v => v.creatorId)));
    const creators = await creatorRepository.getCreators(creatorIds, Platform.BILIBILI);
    const creatorMap = new Map(creators.map(c => [c.creatorId, c]));

    // 批量加载标签数据
    const allTagIds = Array.from(new Set(videos.flatMap(v => v.tags)));
    const tags = await tagRepository.getTags(allTagIds);
    const tagMap = new Map(tags.map(t => [t.tagId, t.name]));

    // 构建视频索引
    const videoIndices: VideoIndex[] = videos.map(video => {
      const creator = creatorMap.get(video.creatorId);
      return {
        videoId: video.videoId,
        title: video.title,
        creatorId: video.creatorId,
        creatorName: creator?.name || video.creatorId,
        tags: video.tags,
        collectionIds: [videoToCollection.get(video.videoId) || ''],
        createdAt: video.createdAt || 0,
        updatedAt: video.publishTime || video.createdAt || 0
      };
    });

    // 批量添加到索引缓存
    videoIndices.forEach(index => {
      videoIndexCache.set(index);
    });

    console.log('[VideoQuery] Built video index:', videoIndices.length, 'videos');
  } catch (error) {
    console.error('[VideoQuery] Error building video index:', error);
    throw new QueryError('构建视频索引失败', error as Error);
  }
}

/**
 * 执行查询
 * @param params 查询参数
 * @param options 查询选项
 * @returns 查询结果
 */
export async function executeQuery(
  params: VideoQueryParams,
  options: QueryOptions = {}
): Promise<QueryResult<Video>> {
  try {
    // 获取基础视频ID列表
    let videoIds: string[] = [];

    if (params.collectionId === 'all') {
      // 获取所有视频ID
      const allCollectionItems = await collectionItemRepository.getAllItems();
      videoIds = Array.from(new Set(
        allCollectionItems.map((item: CollectionItem) => item.videoId)
      ));
    } else if (params.collectionId) {
      // 获取指定收藏夹的视频ID
      videoIds = videoIndexCache.query({
        collectionId: params.collectionId,
        keyword: params.keyword
      }).map(v => v.videoId);
    }

    // 应用标签过滤
    if (params.includeTags && params.includeTags.length > 0 || 
        params.excludeTags && params.excludeTags.length > 0) {
      const allVideos = videoIndexCache.query({});
      const filteredVideos = allVideos.filter(video => {
        const includeMatch = !params.includeTags || params.includeTags.length === 0 ||
          params.includeTags.some(tag => video.tags.includes(tag));
        const excludeMatch = !params.excludeTags || params.excludeTags.length === 0 ||
          !params.excludeTags.some(tag => video.tags.includes(tag));
        return includeMatch && excludeMatch;
      });
      videoIds = filteredVideos.map(v => v.videoId);
    }

    // 计算分页
    const total = videoIds.length;
    const page = params.page || 0;
    const pageSize = params.pageSize || 10;
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageVideoIds = videoIds.slice(startIndex, endIndex);

    // 获取视频数据
    const videos = await videoDataCache.getBatch(pageVideoIds);

    // 预取下一页
    if (prefetchConfig.enabled && options.preload !== false) {
      const prefetchStartIndex = endIndex;
      const prefetchEndIndex = prefetchStartIndex + pageSize * prefetchConfig.prefetchPages;
      const prefetchIds = videoIds.slice(prefetchStartIndex, prefetchEndIndex);
      if (prefetchIds.length > 0) {
        void videoDataCache.prefetch(prefetchIds);
      }
    }

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: videos,
      total,
      page,
      pageSize,
      hasNext: page < totalPages - 1,
      hasPrev: page > 0
    };
  } catch (error) {
    console.error('[VideoQuery] Error executing query:', error);
    throw new QueryError('执行查询失败', error as Error);
  }
}

/**
 * 获取视频数据
 * @param videoIds 视频ID列表
 * @returns 视频数据列表
 */
export async function getVideos(videoIds: string[]): Promise<Video[]> {
  return videoDataCache.getBatch(videoIds);
}

/**
 * 清空查询缓存
 */
export function clearQueryCache(): void {
  videoIndexCache.clear();
  videoDataCache.clear();
}

/**
 * 获取所有标签
 * @param collectionId 收藏夹ID(可选)
 * @returns 标签ID列表
 */
export async function getAllTags(collectionId?: string): Promise<string[]> {
  try {
    let videoIds: string[] = [];

    if (collectionId === 'all') {
      // 获取所有视频ID
      const allCollectionItems = await collectionItemRepository.getAllItems();
      videoIds = Array.from(new Set(
        allCollectionItems.map((item: CollectionItem) => item.videoId)
      ));
    } else if (collectionId) {
      // 获取指定收藏夹的视频ID
      const videos = videoIndexCache.query({ collectionId });
      videoIds = videos.map(v => v.videoId);
    }

    // 获取所有视频
    const videos = await videoRepository.getVideos(videoIds, Platform.BILIBILI);

    // 收集所有标签ID
    const tagIds = new Set<string>();
    videos.forEach(video => {
      video.tags.forEach(tagId => tagIds.add(tagId));
    });

    return Array.from(tagIds);
  } catch (error) {
    console.error('[VideoQuery] Error getting tags:', error);
    throw new QueryError('获取标签失败', error as Error);
  }
}
