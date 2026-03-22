/**
 * CollectionDataAccess 实现
 * 提供收藏夹相关的数据访问聚合方法
 */

import { CollectionRepository } from './collection-repository.impl.js';
import { CollectionItemRepository } from './collection-item-repository.impl.js';
import { VideoRepository } from './video-repository.impl.js';
import { CreatorRepository } from './creator-repository.impl.js';
import { Collection, CollectionItem } from '../types/collection.js';
import { Video } from '../types/video.js';
import { Platform, PaginationParams, PaginationResult } from '../types/base.js';

const collectionRepository = new CollectionRepository();
const collectionItemRepository = new CollectionItemRepository();
const videoRepository = new VideoRepository();
const creatorRepository = new CreatorRepository();
const BILIBILI = Platform.BILIBILI;

/**
 * 聚合后的收藏视频数据
 * 结合 CollectionItem 和 Video 信息
 */
export interface AggregatedCollectionVideo {
  // CollectionItem 字段
  itemId: string;
  collectionId: string;
  videoId: string;
  addedAt: number;
  note?: string;
  order?: number;
  // Video 字段
  platform: string;
  creatorId: string;
  creatorName?: string;
  title: string;
  description: string;
  duration: number;
  publishTime: number;
  tags: string[];
  createdAt: number;
  coverUrl?: string;
  picture?: string;
}

/**
 * 收藏视频过滤参数
 */
export interface CollectionVideoFilter {
  keyword?: string;
  tagId?: string;
  creatorId?: string;
  includeTags?: string[];
  excludeTags?: string[];
}

/**
 * 分页查询参数
 */
export interface PaginationQuery {
  page: number;
  pageSize: number;
}

/**
 * 获取收藏夹的聚合视频列表
 */
export async function getCollectionVideos(
  collectionId: string,
  platform: Platform = BILIBILI
): Promise<AggregatedCollectionVideo[]> {
  console.log('[CollectionDataAccess] Getting collection videos for:', collectionId);

  // 获取收藏项
  const itemsResult = await collectionItemRepository.getCollectionVideos(collectionId, {
    page: 0,
    pageSize: 10000
  });

  console.log('[CollectionDataAccess] Collection items result:', itemsResult);

  if (itemsResult.items.length === 0) {
    console.warn('[CollectionDataAccess] No collection items found');
    return [];
  }

  // 获取视频详情
  const videoIds = itemsResult.items.map(item => item.videoId);
  console.log('[CollectionDataAccess] Video IDs:', videoIds);

  const videos = await videoRepository.getVideos(videoIds, platform);
  console.log('[CollectionDataAccess] Videos:', videos);

  const videosMap = new Map(videos.map(v => [v.videoId, v]));

  // 获取所有UP主ID
  const creatorIds = new Set(videos.map(v => v.creatorId));
  console.log('[CollectionDataAccess] Creator IDs:', creatorIds);

  // 获取UP主信息
  const creators = await Promise.all(
    Array.from(creatorIds).map(async (creatorId) => {
      try {
        const creator = await creatorRepository.getCreator(creatorId, platform);
        return { creatorId, name: creator?.name || creatorId };
      } catch (error) {
        console.warn('[CollectionDataAccess] Error getting creator:', creatorId, error);
        return { creatorId, name: creatorId };
      }
    })
  );

  const creatorsMap = new Map(creators.map(c => [c.creatorId, c.name]));
  console.log('[CollectionDataAccess] Creators map:', creatorsMap);

  // 聚合 CollectionItem 和 Video 信息
  const aggregatedVideos = itemsResult.items
    .map<AggregatedCollectionVideo | null>(item => {
      const video = videosMap.get(item.videoId);
      if (!video) {
        console.warn('[CollectionDataAccess] Video not found for item:', item.videoId);
        return null;
      }

      return {
        itemId: item.itemId,
        collectionId: item.collectionId,
        videoId: item.videoId,
        addedAt: item.addedAt,
        note: item.note,
        order: item.order,
        platform: video.platform,
        creatorId: video.creatorId,
        creatorName: creatorsMap.get(video.creatorId) || video.creatorId,
        title: video.title,
        description: video.description,
        duration: video.duration,
        publishTime: video.publishTime,
        tags: video.tags,
        createdAt: video.createdAt,
        coverUrl: video.coverUrl,
        picture: video.picture
      };
    })
    .filter((v): v is AggregatedCollectionVideo => v !== null)
    .sort((a, b) => b.addedAt - a.addedAt);

  console.log('[CollectionDataAccess] Aggregated videos:', aggregatedVideos);

  return aggregatedVideos;
}

/**
 * 获取所有收藏夹的聚合视频列表
 */
export async function getAllCollectionVideos(
  platform: Platform = BILIBILI,
  collectionType?: 'user' | 'subscription'
): Promise<AggregatedCollectionVideo[]> {
  console.log('[CollectionDataAccess] Getting all collection videos', collectionType ? `for type: ${collectionType}` : '');

  // 获取所有收藏夹
  let collections = await collectionRepository.getAllCollections(platform);
  console.log('[CollectionDataAccess] Collections result:', collections);

  // 如果指定了类型，则过滤收藏夹
  if (collectionType) {
    collections = collections.filter(
      collection => collection.type === collectionType || 
                    (collection.type === undefined && collectionType === 'user')
    );
    console.log(`[CollectionDataAccess] Filtered collections for type ${collectionType}:`, collections);
  }

  if (collections.length === 0) {
    console.warn('[CollectionDataAccess] No collections found');
    return [];
  }

  // 获取所有收藏项
  const allItems = await Promise.all(
    collections.map(async (collection: Collection) => {
      const itemsResult = await collectionItemRepository.getCollectionVideos(collection.collectionId, {
        page: 0,
        pageSize: 10000
      });
      return itemsResult.items;
    })
  );

  const items = allItems.flat();
  console.log('[CollectionDataAccess] Total collection items:', items.length);

  if (items.length === 0) {
    console.warn('[CollectionDataAccess] No collection items found');
    return [];
  }

  // 获取视频详情
  const videoIds = items.map((item: CollectionItem) => item.videoId);
  console.log('[CollectionDataAccess] Video IDs:', videoIds);

  const videos = await videoRepository.getVideos(videoIds, platform);
  console.log('[CollectionDataAccess] Videos:', videos);

  const videosMap = new Map(videos.map(v => [v.videoId, v]));

  // 获取所有UP主ID
  const creatorIds = new Set(videos.map(v => v.creatorId));
  console.log('[CollectionDataAccess] Creator IDs:', creatorIds);

  // 获取UP主信息
  const creators = await Promise.all(
    Array.from(creatorIds).map(async (creatorId) => {
      try {
        const creator = await creatorRepository.getCreator(creatorId, platform);
        return { creatorId, name: creator?.name || creatorId };
      } catch (error) {
        console.warn('[CollectionDataAccess] Error getting creator:', creatorId, error);
        return { creatorId, name: creatorId };
      }
    })
  );

  const creatorsMap = new Map(creators.map(c => [c.creatorId, c.name]));
  console.log('[CollectionDataAccess] Creators map:', creatorsMap);

  // 聚合 CollectionItem 和 Video 信息
  const aggregatedVideos = items
    .map<AggregatedCollectionVideo | null>((item: CollectionItem) => {
      const video = videosMap.get(item.videoId);
      if (!video) {
        console.warn('[CollectionDataAccess] Video not found for item:', item.videoId);
        return null;
      }

      return {
        itemId: item.itemId,
        collectionId: item.collectionId,
        videoId: item.videoId,
        addedAt: item.addedAt,
        note: item.note,
        order: item.order,
        platform: video.platform,
        creatorId: video.creatorId,
        creatorName: creatorsMap.get(video.creatorId) || video.creatorId,
        title: video.title,
        description: video.description,
        duration: video.duration,
        publishTime: video.publishTime,
        tags: video.tags,
        createdAt: video.createdAt,
        coverUrl: video.coverUrl
      };
    })
    .filter((v): v is AggregatedCollectionVideo => v !== null);

  console.log('[CollectionDataAccess] Aggregated videos:', aggregatedVideos);

  return aggregatedVideos;
}

/**
 * 过滤收藏视频
 */
export function filterCollectionVideos(
  videos: AggregatedCollectionVideo[],
  filter: CollectionVideoFilter
): AggregatedCollectionVideo[] {
  return videos.filter(video => {
    // 关键词搜索
    if (filter.keyword) {
      const lowerKeyword = filter.keyword.toLowerCase();
      const titleMatch = video.title?.toLowerCase().includes(lowerKeyword);
      const descMatch = video.description?.toLowerCase().includes(lowerKeyword);
      if (!titleMatch && !descMatch) {
        return false;
      }
    }

    // 标签过滤
    if (filter.tagId && !video.tags?.includes(filter.tagId)) {
      return false;
    }

    // 创作者过滤
    if (filter.creatorId && video.creatorId !== filter.creatorId) {
      return false;
    }

    // 包含标签过滤
    if (filter.includeTags && filter.includeTags.length > 0) {
      const hasAllIncludeTags = filter.includeTags.every(tag =>
        video.tags && video.tags.includes(tag)
      );
      if (!hasAllIncludeTags) {
        return false;
      }
    }

    // 排除标签过滤
    if (filter.excludeTags && filter.excludeTags.length > 0) {
      const hasExcludeTag = filter.excludeTags.some(tag =>
        video.tags && video.tags.includes(tag)
      );
      if (hasExcludeTag) {
        return false;
      }
    }

    return true;
  });
}


/**
 * 获取收藏夹的创作者集合
 */
export function getCollectionCreators(videos: AggregatedCollectionVideo[]): Set<string> {
  const creatorsSet = new Set<string>();
  videos.forEach(video => {
    if (video.creatorId) {
      creatorsSet.add(video.creatorId);
    }
  });
  return creatorsSet;
}

/**
 * 获取收藏夹的所有标签
 */
export async function getCollectionTags(
  collectionId: string,
  platform: Platform = BILIBILI
): Promise<Set<string>> {
  const videos = await getCollectionVideos(collectionId, platform);
  return getCollectionTagsFromVideos(videos);
}

/**
 * 获取所有收藏夹的所有标签
 */
export async function getAllCollectionTags(
  platform: Platform = BILIBILI,
  collectionType?: 'user' | 'subscription'
): Promise<Set<string>> {
  const videos = await getAllCollectionVideos(platform, collectionType);
  return getCollectionTagsFromVideos(videos);
}

/**
 * 从视频列表中提取标签
 */
function getCollectionTagsFromVideos(videos: AggregatedCollectionVideo[]): Set<string> {
  const tagsSet = new Set<string>();
  videos.forEach(video => {
    if (video.tags) {
      video.tags.forEach(tag => tagsSet.add(tag));
    }
  });
  return tagsSet;
}

/**
 * 分页查询收藏夹的聚合视频列表（带筛选）
 */
export async function getCollectionVideosPaginated(
  collectionId: string,
  pagination: PaginationQuery,
  filter?: CollectionVideoFilter,
  platform: Platform = BILIBILI
): Promise<{ videos: AggregatedCollectionVideo[]; total: number }> {
  console.log('[CollectionDataAccess] Getting paginated collection videos for:', collectionId, 'with filter:', filter);

  // 获取收藏项
  const itemsResult = await collectionItemRepository.getCollectionVideos(collectionId, {
    page: 0,
    pageSize: 10000
  });

  if (itemsResult.items.length === 0) {
    return { videos: [], total: 0 };
  }

  // 获取视频详情
  const videoIds = itemsResult.items.map(item => item.videoId);
  const videos = await videoRepository.getVideos(videoIds, platform);
  const videosMap = new Map(videos.map(v => [v.videoId, v]));

  // 获取所有UP主ID
  const creatorIds = new Set(videos.map(v => v.creatorId));

  // 获取UP主信息
  const creators = await Promise.all(
    Array.from(creatorIds).map(async (creatorId) => {
      try {
        const creator = await creatorRepository.getCreator(creatorId, platform);
        return { creatorId, name: creator?.name || creatorId };
      } catch (error) {
        console.warn('[CollectionDataAccess] Error getting creator:', creatorId, error);
        return { creatorId, name: creatorId };
      }
    })
  );

  const creatorsMap = new Map(creators.map(c => [c.creatorId, c.name]));

  // 聚合 CollectionItem 和 Video 信息
  const aggregatedVideos = itemsResult.items
    .map<AggregatedCollectionVideo | null>(item => {
      const video = videosMap.get(item.videoId);
      if (!video) {
        return null;
      }

      return {
        itemId: item.itemId,
        collectionId: item.collectionId,
        videoId: item.videoId,
        addedAt: item.addedAt,
        note: item.note,
        order: item.order,
        platform: video.platform,
        creatorId: video.creatorId,
        creatorName: creatorsMap.get(video.creatorId) || video.creatorId,
        title: video.title,
        description: video.description,
        duration: video.duration,
        publishTime: video.publishTime,
        tags: video.tags,
        createdAt: video.createdAt,
        coverUrl: video.coverUrl
      };
    })
    .filter((v): v is AggregatedCollectionVideo => v !== null);

  // 应用筛选
  let filteredVideos = aggregatedVideos;
  if (filter) {
    filteredVideos = filterCollectionVideos(aggregatedVideos, filter);
  }

  // 排序
  filteredVideos.sort((a, b) => b.addedAt - a.addedAt);

  // 分页
  const total = filteredVideos.length;
  const start = pagination.page * pagination.pageSize;
  const end = start + pagination.pageSize;
  const paginatedVideos = filteredVideos.slice(start, end);

  return { videos: paginatedVideos, total };
}

/**
 * 分页查询所有收藏夹的聚合视频列表（带筛选）
 */
export async function getAllCollectionVideosPaginated(
  pagination: PaginationQuery,
  filter?: CollectionVideoFilter,
  platform: Platform = BILIBILI,
  collectionType?: 'user' | 'subscription'
): Promise<{ videos: AggregatedCollectionVideo[]; total: number }> {
  console.log('[CollectionDataAccess] Getting all paginated collection videos', collectionType ? `for type: ${collectionType}` : '', 'with filter:', filter);

  // 获取所有收藏夹
  let collections = await collectionRepository.getAllCollections(platform);

  // 如果指定了类型，则过滤收藏夹
  if (collectionType) {
    collections = collections.filter(
      collection => collection.type === collectionType ||
                    (collection.type === undefined && collectionType === 'user')
    );
  }

  if (collections.length === 0) {
    return { videos: [], total: 0 };
  }

  // 获取所有收藏项
  const allItems = await Promise.all(
    collections.map(async (collection: Collection) => {
      const itemsResult = await collectionItemRepository.getCollectionVideos(collection.collectionId, {
        page: 0,
        pageSize: 10000
      });
      return itemsResult.items;
    })
  );

  const items = allItems.flat();

  if (items.length === 0) {
    return { videos: [], total: 0 };
  }

  // 获取视频详情
  const videoIds = items.map((item: CollectionItem) => item.videoId);
  const videos = await videoRepository.getVideos(videoIds, platform);
  const videosMap = new Map(videos.map(v => [v.videoId, v]));

  // 获取所有UP主ID
  const creatorIds = new Set(videos.map(v => v.creatorId));

  // 获取UP主信息
  const creators = await Promise.all(
    Array.from(creatorIds).map(async (creatorId) => {
      try {
        const creator = await creatorRepository.getCreator(creatorId, platform);
        return { creatorId, name: creator?.name || creatorId };
      } catch (error) {
        console.warn('[CollectionDataAccess] Error getting creator:', creatorId, error);
        return { creatorId, name: creatorId };
      }
    })
  );

  const creatorsMap = new Map(creators.map(c => [c.creatorId, c.name]));

  // 聚合 CollectionItem 和 Video 信息
  const aggregatedVideos = items
    .map<AggregatedCollectionVideo | null>((item: CollectionItem) => {
      const video = videosMap.get(item.videoId);
      if (!video) {
        return null;
      }

      return {
        itemId: item.itemId,
        collectionId: item.collectionId,
        videoId: item.videoId,
        addedAt: item.addedAt,
        note: item.note,
        order: item.order,
        platform: video.platform,
        creatorId: video.creatorId,
        creatorName: creatorsMap.get(video.creatorId) || video.creatorId,
        title: video.title,
        description: video.description,
        duration: video.duration,
        publishTime: video.publishTime,
        tags: video.tags,
        createdAt: video.createdAt,
        coverUrl: video.coverUrl
      };
    })
    .filter((v): v is AggregatedCollectionVideo => v !== null);

  // 应用筛选
  let filteredVideos = aggregatedVideos;
  if (filter) {
    filteredVideos = filterCollectionVideos(aggregatedVideos, filter);
  }

  // 排序
  filteredVideos.sort((a, b) => b.addedAt - a.addedAt);

  // 分页
  const total = filteredVideos.length;
  const start = pagination.page * pagination.pageSize;
  const end = start + pagination.pageSize;
  const paginatedVideos = filteredVideos.slice(start, end);

  return { videos: paginatedVideos, total };
}
