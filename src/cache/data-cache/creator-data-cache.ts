/**
 * 创作者数据缓存实现
 * 使用LRU策略管理创作者数据缓存
 */

import { LRUCache } from '../lru-cache.js';
import type { Creator } from '../../database/types/creator.js';
import type { CacheStats } from '../types.js';

/**
 * 创作者缓存数据
 */
export interface CreatorCacheData {
  /** 创作者数据 */
  creator: Creator;
  /** 缓存时间 */
  cachedAt: number;
  /** 最后访问时间 */
  lastAccessTime: number;
}

/**
 * 创作者数据缓存类
 * 使用LRU策略管理创作者数据缓存
 */
export class CreatorDataCache {
  private cache: LRUCache<string, CreatorCacheData>;
  private maxAge: number; // 最大缓存时间(毫秒)

  constructor(maxSize: number = 500, maxAge: number = 30 * 60 * 1000) {
    this.cache = new LRUCache<string, CreatorCacheData>(maxSize);
    this.maxAge = maxAge;
  }

  /**
   * 获取创作者数据
   */
  get(creatorId: string): Creator | undefined {
    const cached = this.cache.get(creatorId);
    if (!cached) {
      return undefined;
    }

    // 检查是否过期
    if (Date.now() - cached.cachedAt > this.maxAge) {
      this.cache.delete(creatorId);
      return undefined;
    }

    // 更新访问时间
    cached.lastAccessTime = Date.now();
    return cached.creator;
  }

  /**
   * 设置创作者数据
   */
  set(creator: Creator): void {
    const now = Date.now();
    const cacheData: CreatorCacheData = {
      creator,
      cachedAt: now,
      lastAccessTime: now
    };
    this.cache.set(creator.creatorId, cacheData);
  }

  /**
   * 批量设置创作者数据
   */
  setBatch(creators: Creator[]): void {
    creators.forEach(creator => this.set(creator));
  }

  /**
   * 检查创作者数据是否存在
   */
  has(creatorId: string): boolean {
    return this.cache.has(creatorId) && this.get(creatorId) !== undefined;
  }

  /**
   * 删除创作者数据
   */
  delete(creatorId: string): boolean {
    return this.cache.delete(creatorId);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats & { maxAge: number } {
    const stats = this.cache.getStats();
    return {
      ...stats,
      maxAge: this.maxAge
    };
  }

  /**
   * 清理过期数据
   */
  cleanupExpired(): number {
    const now = Date.now();
    const expiredIds: string[] = [];

    this.cache.keys().forEach(key => {
      const cached = this.cache.get(key);
      if (cached && now - cached.cachedAt > this.maxAge) {
        expiredIds.push(key);
      }
    });

    expiredIds.forEach(id => this.cache.delete(id));
    return expiredIds.length;
  }
}

// 导出单例实例
export const creatorDataCache = new CreatorDataCache();
