/**
 * 缓存管理器
 * 负责管理查询层的缓存操作
 */

import { ICache, CacheStats } from '../../cache/types.js';

/**
 * 缓存管理器
 * 负责管理查询层的缓存操作
 */
export class CacheManager {
  private caches: Map<string, ICache<string, any>> = new Map();

  /**
   * 注册缓存
   * @param name 缓存名称
   * @param cache 缓存实例
   */
  registerCache(name: string, cache: ICache<string, any>): void {
    this.caches.set(name, cache);
  }

  /**
   * 获取缓存
   * @param name 缓存名称
   * @returns 缓存实例
   */
  getCache(name: string): ICache<string, any> | undefined {
    return this.caches.get(name);
  }

  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值
   */
  get<T>(key: string): T | undefined {
    for (const cache of this.caches.values()) {
      const value = cache.get(key);
      if (value !== undefined) {
        return value as T;
      }
    }
    return undefined;
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   */
  set(key: string, value: any): void {
    for (const cache of this.caches.values()) {
      cache.set(key, value);
    }
  }

  /**
   * 删除缓存值
   * @param key 缓存键
   */
  delete(key: string): void {
    for (const cache of this.caches.values()) {
      cache.delete(key);
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * 获取所有缓存统计
   * @returns 缓存统计信息
   */
  getAllStats(): Map<string, CacheStats> {
    const stats = new Map<string, CacheStats>();
    for (const [name, cache] of this.caches.entries()) {
      stats.set(name, cache.getStats());
    }
    return stats;
  }
}

// 导出单例实例
export const cacheManager = new CacheManager();
