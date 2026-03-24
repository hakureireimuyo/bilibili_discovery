/**
 * 图像缓存实现
 * 使用FIFO策略管理图像缓存
 */

import { FIFOCache } from '../fifo-cache.js';
import type { ImageData } from './types.js';
import type { CacheStats } from '../types.js';

/**
 * 图像缓存类
 * 使用FIFO策略管理图像缓存
 */
export class ImageCache {
  private cache: FIFOCache<string, ImageData>;
  private maxCount: number; // 最大缓存数量

  constructor(maxCount: number = 100) {
    this.maxCount = maxCount;
    this.cache = new FIFOCache<string, ImageData>(maxCount);
  }

  /**
   * 获取图像数据
   */
  get(key: string): Blob | undefined {
    const cached = this.cache.get(key);
    return cached?.data;
  }

  /**
   * 设置图像数据
   */
  set(key: string, data: Blob, metadata?: Omit<ImageData, 'id' | 'data'>): void {
    // 如果已存在，先移除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 添加新的，使用key作为id
    const cacheData: ImageData = {
      id: key,
      data,
      ...metadata
    };
    this.cache.set(key, cacheData);
  }

  /**
   * 批量设置图像
   */
  setBatch(entries: Array<[string, Blob, Omit<ImageData, 'id' | 'data'>?]>): void {
    entries.forEach(([key, data, metadata]) => this.set(key, data, metadata));
  }

  /**
   * 检查图像是否存在
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 删除图像
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
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
  getStats(): CacheStats & { maxCount: number } {
    const stats = this.cache.getStats();
    return {
      ...stats,
      maxCount: this.maxCount
    };
  }

}
