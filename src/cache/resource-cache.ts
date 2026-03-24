/**
 * 资源缓存基类
 * 实现特定资源的缓存管理
 */

import type { ICache, CacheStats } from './types.js';

/**
 * 资源缓存类
 * 实现特定资源的缓存管理
 */
export class ResourceCache<K extends string | number, V> implements ICache<K, V> {
  private cache = new Map<K, V>();
  private stats: CacheStats = {
    size: 0,
    hits: 0,
    misses: 0,
    hitRate: 0
  };

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存值
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    this.updateHitRate();
    return value;
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   */
  set(key: K, value: V): void {
    this.cache.set(key, value);
    this.stats.size = this.cache.size;
  }

  /**
   * 批量设置缓存
   * @param entries 缓存项数组
   */
  setBatch(entries: Array<[K, V]>): void {
    entries.forEach(([key, value]) => this.set(key, value));
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   * @returns 是否删除成功
   */
  delete(key: K): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.hitRate = 0;
  }

  /**
   * 获取缓存统计
   * @returns 统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取所有键
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取所有值
   */
  values(): V[] {
    return Array.from(this.cache.values());
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}
