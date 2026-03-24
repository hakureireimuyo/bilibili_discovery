/**
 * FIFO缓存实现
 * 使用先进先出策略管理缓存
 */

import { ResourceCache } from './resource-cache.js';
import type { ICache, CacheStats } from './types.js';

/**
 * FIFO缓存实现
 * 使用先进先出策略管理缓存
 */
export class FIFOCache<K extends string | number, V> extends ResourceCache<K, V> {
  private maxSize: number;
  private insertionOrder: K[] = [];

  constructor(maxSize: number = 100) {
    super();
    this.maxSize = maxSize;
  }

  override set(key: K, value: V): void {
    if (!this.has(key)) {
      this.insertionOrder.push(key);
    }
    super.set(key, value);
    this.evictIfNeeded();
  }

  override delete(key: K): boolean {
    const result = super.delete(key);
    if (result) {
      const index = this.insertionOrder.indexOf(key);
      if (index !== -1) {
        this.insertionOrder.splice(index, 1);
      }
    }
    return result;
  }

  override clear(): void {
    super.clear();
    this.insertionOrder = [];
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
   * 获取所有键
   */
  override keys(): K[] {
    return [...this.insertionOrder];
  }

  private evictIfNeeded(): void {
    while (this.insertionOrder.length > this.maxSize) {
      const keyToRemove = this.insertionOrder.shift();
      if (keyToRemove !== undefined) {
        super.delete(keyToRemove);
      }
    }
  }
}
