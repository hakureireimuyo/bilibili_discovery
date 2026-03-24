
/**
 * 视频索引缓存实现
 * 使用LRU策略管理视频索引缓存
 */

import { LRUCache } from '../lru-cache.js';
import type { VideoIndex, IndexQuery } from './types.js';
import type { ID } from '../../database/types/base.js';
import type { CacheStats } from '../types.js';

/**
 * 视频索引缓存类
 * 使用LRU策略管理视频索引缓存
 */
export class VideoIndexCache {
  private cache: LRUCache<ID, VideoIndex>;
  private creatorIndex: Map<ID, ID[]> = new Map(); // creatorId -> videoIds
  private collectionIndex: Map<ID, ID[]> = new Map(); // collectionId -> videoIds
  private tagIndex: Map<ID, ID[]> = new Map(); // tagId -> videoIds

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache<ID, VideoIndex>(maxSize);
  }

  /**
   * 获取视频索引
   */
  get(videoId: ID): VideoIndex | undefined {
    return this.cache.get(videoId);
  }

  /**
   * 设置视频索引
   */
  set(videoIndex: VideoIndex): void {
    // 更新主缓存
    this.cache.set(videoIndex.videoId, videoIndex);

    // 更新创作者索引
    this.updateCreatorIndex(videoIndex);

    // 更新收藏夹索引
    this.updateCollectionIndex(videoIndex);

    // 更新标签索引
    this.updateTagIndex(videoIndex);
  }

  /**
   * 批量设置视频索引
   */
  setBatch(videoIndexes: VideoIndex[]): void {
    videoIndexes.forEach(index => this.set(index));
  }

  /**
   * 检查视频索引是否存在
   */
  has(videoId: ID): boolean {
    return this.cache.has(videoId);
  }

  /**
   * 删除视频索引
   */
  delete(videoId: ID): boolean {
    const videoIndex = this.cache.get(videoId);
    if (!videoIndex) {
      return false;
    }

    // 从创作者索引中移除
    this.removeFromCreatorIndex(videoIndex.creatorId, videoId);

    // 从收藏夹索引中移除
    videoIndex.collectionIds.forEach(collectionId => {
      this.removeFromCollectionIndex(collectionId, videoId);
    });

    // 从标签索引中移除
    videoIndex.tags.forEach(tagId => {
      this.removeFromTagIndex(tagId, videoId);
    });

    // 从主缓存中移除
    return this.cache.delete(videoId);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.creatorIndex.clear();
    this.collectionIndex.clear();
    this.tagIndex.clear();
  }

  /**
   * 查询视频索引
   */
  query(query: IndexQuery): VideoIndex[] {
    let results: VideoIndex[] = [];

    // 根据查询条件获取候选视频ID
    let candidateIds: ID[] | undefined;

    if (query.tags && query.tags.length > 0) {
      // 标签过滤
      candidateIds = this.getByTags(query.tags);
    } else if (query.creatorId) {
      // 创作者过滤
      candidateIds = this.getByCreator(query.creatorId);
    } else if (query.collectionId) {
      // 收藏夹过滤
      candidateIds = this.getByCollection(query.collectionId);
    } else {
      // 获取所有视频ID
      candidateIds = this.cache.keys();
    }

    // 获取候选视频索引
    if (candidateIds) {
      results = candidateIds
        .map(id => this.cache.get(id))
        .filter((index): index is VideoIndex => index !== undefined);
    }

    // 关键词搜索
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(index =>
        index.title.toLowerCase().includes(keyword)
      );
    }

    // 时间范围过滤
    if (query.timeRange) {
      results = results.filter(index =>
        index.createdAt >= query.timeRange!.startTime &&
        index.createdAt <= query.timeRange!.endTime
      );
    }

    // 排序
    if (query.sortBy) {
      results.sort((a, b) => {
        const aValue = a[query.sortBy!];
        const bValue = b[query.sortBy!];
        const order = query.sortOrder === 'desc' ? -1 : 1;
        return (aValue - bValue) * order;
      });
    }

    return results;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats & {
    creatorIndexSize: number;
    collectionIndexSize: number;
    tagIndexSize: number;
  } {
    const stats = this.cache.getStats();
    return {
      ...stats,
      creatorIndexSize: this.creatorIndex.size,
      collectionIndexSize: this.collectionIndex.size,
      tagIndexSize: this.tagIndex.size
    };
  }

  /**
   * 更新创作者索引
   */
  private updateCreatorIndex(videoIndex: VideoIndex): void {
    const { creatorId, videoId } = videoIndex;
    if (!this.creatorIndex.has(creatorId)) {
      this.creatorIndex.set(creatorId, []);
    }
    const videoIds = this.creatorIndex.get(creatorId)!;
    if (!videoIds.includes(videoId)) {
      videoIds.push(videoId);
    }
  }

  /**
   * 更新收藏夹索引
   */
  private updateCollectionIndex(videoIndex: VideoIndex): void {
    const { collectionIds, videoId } = videoIndex;
    collectionIds.forEach(collectionId => {
      if (!this.collectionIndex.has(collectionId)) {
        this.collectionIndex.set(collectionId, []);
      }
      const videoIds = this.collectionIndex.get(collectionId)!;
      if (!videoIds.includes(videoId)) {
        videoIds.push(videoId);
      }
    });
  }

  /**
   * 更新标签索引
   */
  private updateTagIndex(videoIndex: VideoIndex): void {
    const { tags, videoId } = videoIndex;
    tags.forEach(tagId => {
      if (!this.tagIndex.has(tagId)) {
        this.tagIndex.set(tagId, []);
      }
      const videoIds = this.tagIndex.get(tagId)!;
      if (!videoIds.includes(videoId)) {
        videoIds.push(videoId);
      }
    });
  }

  /**
   * 从创作者索引中移除
   */
  private removeFromCreatorIndex(creatorId: ID, videoId: ID): void {
    const videoIds = this.creatorIndex.get(creatorId);
    if (videoIds) {
      const index = videoIds.indexOf(videoId);
      if (index !== -1) {
        videoIds.splice(index, 1);
      }
    }
  }

  /**
   * 从收藏夹索引中移除
   */
  private removeFromCollectionIndex(collectionId: ID, videoId: ID): void {
    const videoIds = this.collectionIndex.get(collectionId);
    if (videoIds) {
      const index = videoIds.indexOf(videoId);
      if (index !== -1) {
        videoIds.splice(index, 1);
      }
    }
  }

  /**
   * 从标签索引中移除
   */
  private removeFromTagIndex(tagId: ID, videoId: ID): void {
    const videoIds = this.tagIndex.get(tagId);
    if (videoIds) {
      const index = videoIds.indexOf(videoId);
      if (index !== -1) {
        videoIds.splice(index, 1);
      }
    }
  }

  /**
   * 根据标签获取视频ID
   */
  private getByTags(tags: ID[]): ID[] {
    if (tags.length === 0) {
      return this.cache.keys();
    }

    // 获取第一个标签的视频ID
    const firstTagVideos = this.tagIndex.get(tags[0]) || [];

    // 如果只有一个标签,直接返回
    if (tags.length === 1) {
      return [...firstTagVideos];
    }

    // 多个标签,取交集
    return firstTagVideos.filter(videoId => {
      return tags.slice(1).every(tagId => {
        const videos = this.tagIndex.get(tagId);
        return videos && videos.includes(videoId);
      });
    });
  }

  /**
   * 根据创作者获取视频ID
   */
  private getByCreator(creatorId: ID): ID[] {
    return [...(this.creatorIndex.get(creatorId) || [])];
  }

  /**
   * 根据收藏夹获取视频ID
   */
  private getByCollection(collectionId: ID): ID[] {
    return [...(this.collectionIndex.get(collectionId) || [])];
  }
}
