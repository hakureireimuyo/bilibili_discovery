
/**
 * 收藏夹索引缓存实现
 * 使用LRU策略管理收藏夹索引缓存
 */

import { LRUCache } from '../lru-cache.js';
import type { CollectionIndex, CollectionQuery } from './types.js';
import type { ID } from '../../database/types/base.js';
import type { CacheStats } from '../types.js';

/**
 * 收藏夹索引缓存类
 * 使用LRU策略管理收藏夹索引缓存
 */
export class CollectionIndexCache {
  private cache: LRUCache<ID, CollectionIndex>;
  private tagIndex: Map<ID, ID[]> = new Map(); // tagId -> collectionIds

  constructor(maxSize: number = 500) {
    this.cache = new LRUCache<ID, CollectionIndex>(maxSize);
  }

  /**
   * 获取收藏夹索引
   */
  get(collectionId: ID): CollectionIndex | undefined {
    return this.cache.get(collectionId);
  }

  /**
   * 设置收藏夹索引
   */
  set(collectionIndex: CollectionIndex): void {
    // 更新主缓存
    this.cache.set(collectionIndex.collectionId, collectionIndex);

    // 更新标签索引
    this.updateTagIndex(collectionIndex);
  }

  /**
   * 批量设置收藏夹索引
   */
  setBatch(collectionIndexes: CollectionIndex[]): void {
    collectionIndexes.forEach(index => this.set(index));
  }

  /**
   * 检查收藏夹索引是否存在
   */
  has(collectionId: ID): boolean {
    return this.cache.has(collectionId);
  }

  /**
   * 删除收藏夹索引
   */
  delete(collectionId: ID): boolean {
    const collectionIndex = this.cache.get(collectionId);
    if (!collectionIndex) {
      return false;
    }

    // 从标签索引中移除
    collectionIndex.tags.forEach(tagId => {
      this.removeFromTagIndex(tagId, collectionId);
    });

    // 从主缓存中移除
    return this.cache.delete(collectionId);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
  }

  /**
   * 根据标签获取收藏夹ID
   */
  getByTags(tags: ID[]): ID[] {
    if (tags.length === 0) {
      return this.cache.keys();
    }

    // 获取第一个标签的收藏夹ID
    const firstTagCollections = this.tagIndex.get(tags[0]) || [];

    // 如果只有一个标签,直接返回
    if (tags.length === 1) {
      return [...firstTagCollections];
    }

    // 多个标签,取交集
    return firstTagCollections.filter(collectionId => {
      return tags.slice(1).every(tagId => {
        const collections = this.tagIndex.get(tagId);
        return collections && collections.includes(collectionId);
      });
    });
  }

  /**
   * 查询收藏夹索引
   */
  query(query: CollectionQuery): CollectionIndex[] {
    let results: CollectionIndex[] = [];

    // 根据查询条件获取候选收藏夹ID
    let candidateIds: ID[] | undefined;

    if (query.tags && query.tags.length > 0) {
      // 标签过滤
      candidateIds = this.getByTags(query.tags);
    } else {
      // 获取所有收藏夹ID
      candidateIds = this.cache.keys();
    }

    // 获取候选收藏夹索引
    if (candidateIds) {
      results = candidateIds
        .map(id => this.cache.get(id))
        .filter((index): index is CollectionIndex => index !== undefined);
    }

    // 关键词搜索
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(index =>
        index.name.toLowerCase().includes(keyword)
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
        const aValue = a[query.sortBy!] as number;
        const bValue = b[query.sortBy!] as number;
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
    tagIndexSize: number;
  } {
    const stats = this.cache.getStats();
    return {
      ...stats,
      tagIndexSize: this.tagIndex.size
    };
  }

  /**
   * 更新标签索引
   */
  private updateTagIndex(collectionIndex: CollectionIndex): void {
    const { tags, collectionId } = collectionIndex;
    tags.forEach(tagId => {
      if (!this.tagIndex.has(tagId)) {
        this.tagIndex.set(tagId, []);
      }
      const collectionIds = this.tagIndex.get(tagId)!;
      if (!collectionIds.includes(collectionId)) {
        collectionIds.push(collectionId);
      }
    });
  }

  /**
   * 从标签索引中移除
   */
  private removeFromTagIndex(tagId: ID, collectionId: ID): void {
    const collectionIds = this.tagIndex.get(tagId);
    if (collectionIds) {
      const index = collectionIds.indexOf(collectionId);
      if (index !== -1) {
        collectionIds.splice(index, 1);
      }
    }
  }
}
