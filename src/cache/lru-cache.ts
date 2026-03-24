/**
 * LRU缓存实现
 * 使用最近最少使用策略管理缓存
 */

import { ResourceCache } from './resource-cache.js';
import type { ICache, CacheStats } from './types.js';

/**
 * LRU缓存实现
 * 使用最近最少使用策略管理缓存
 */
export class LRUCache<K extends string | number, V> extends ResourceCache<K, V> {
  private maxSize: number;
  private accessOrder: K[] = [];

  constructor(maxSize: number = 1000) {
    super();
    this.maxSize = maxSize;
  }

  override get(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      this.updateAccessOrder(key);
    }
    return value;
  }

  override set(key: K, value: V): void {
    super.set(key, value);
    this.updateAccessOrder(key);
    this.evictIfNeeded();
  }

  override delete(key: K): boolean {
    const result = super.delete(key);
    if (result) {
      this.removeFromAccessOrder(key);
    }
    return result;
  }

  override clear(): void {
    super.clear();
    this.accessOrder = [];
  }

  /**
   * 获取缓存统计信息
   */
  override getStats(): CacheStats {
    return {
      ...super.getStats(),
      maxSize: this.maxSize
    } as CacheStats;
  }

  /**
   * 获取命中率
   */
  getHitRate(): number {
    const stats = this.getStats();
    return stats.hitRate;
  }

  /**
   * 获取所有键
   */
  override keys(): K[] {
    return [...this.accessOrder];
  }

  private updateAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictIfNeeded(): void {
    while (this.accessOrder.length > this.maxSize) {
      const keyToRemove = this.accessOrder.shift();
      if (keyToRemove !== undefined) {
        super.delete(keyToRemove);
      }
    }
  }
}
