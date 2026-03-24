
/**
 * 视频数据缓存实现
 * 使用LRU策略管理视频数据缓存
 */

import { LRUCache } from '../lru-cache.js';
import type { VideoData, DataLoadOptions, DataCacheConfig } from './types.js';
import type { ID } from '../../database/types/base.js';
import type { CacheStats } from '../types.js';

/**
 * 视频数据加载器接口
 * 定义从数据库加载视频数据的方法
 */
export interface IVideoDataLoader {
  /**
   * 加载单个视频数据
   */
  loadVideoData(videoId: ID, options?: DataLoadOptions): Promise<VideoData | undefined>;

  /**
   * 批量加载视频数据
   */
  loadVideoDataBatch(videoIds: ID[], options?: DataLoadOptions): Promise<Map<ID, VideoData>>;
}

/**
 * 视频数据缓存类
 * 使用LRU策略管理视频数据缓存
 */
export class VideoDataCache {
  private cache: LRUCache<ID, VideoData>;
  private loader: IVideoDataLoader;
  private config: DataCacheConfig;

  constructor(loader: IVideoDataLoader, config?: Partial<DataCacheConfig>) {
    this.loader = loader;
    this.config = {
      maxSize: config?.maxSize || 500,
      preloadConfig: config?.preloadConfig || {
        enabled: true,
        count: 10
      }
    };
    this.cache = new LRUCache<ID, VideoData>(this.config.maxSize);
  }

  /**
   * 获取视频数据
   * 如果缓存未命中,从数据库加载
   */
  async get(videoId: ID, options?: DataLoadOptions): Promise<VideoData | undefined> {
    // 尝试从缓存获取
    const cached = this.cache.get(videoId);
    if (cached) {
      return cached;
    }

    // 从数据库加载
    const data = await this.loader.loadVideoData(videoId, options);
    if (data) {
      this.set(data);
    }
    return data;
  }

  /**
   * 批量获取视频数据
   * 如果缓存未命中,从数据库加载
   */
  async getBatch(videoIds: ID[], options?: DataLoadOptions): Promise<Map<ID, VideoData>> {
    const result = new Map<ID, VideoData>();
    const missingIds: ID[] = [];

    // 从缓存获取
    for (const videoId of videoIds) {
      const cached = this.cache.get(videoId);
      if (cached) {
        result.set(videoId, cached);
      } else {
        missingIds.push(videoId);
      }
    }

    // 从数据库加载缺失的数据
    if (missingIds.length > 0) {
      const loaded = await this.loader.loadVideoDataBatch(missingIds, options);
      loaded.forEach((data, id) => {
        this.set(data);
        result.set(id, data);
      });
    }

    // 预加载下一页数据
    if (options?.preloadNext && this.config.preloadConfig.enabled) {
      this.preloadNext(videoIds, options);
    }

    return result;
  }

  /**
   * 设置视频数据
   */
  set(data: VideoData): void {
    this.cache.set(data.video.videoId, data);
  }

  /**
   * 批量设置视频数据
   */
  setBatch(dataList: VideoData[]): void {
    dataList.forEach(data => this.set(data));
  }

  /**
   * 检查视频数据是否存在
   */
  has(videoId: ID): boolean {
    return this.cache.has(videoId);
  }

  /**
   * 删除视频数据
   */
  delete(videoId: ID): boolean {
    return this.cache.delete(videoId);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 预加载下一页数据
   */
  private async preloadNext(videoIds: ID[], options: DataLoadOptions): Promise<void> {
    // 获取最后几个视频ID
    const preloadCount = options.preloadCount || this.config.preloadConfig.count;
    const lastIds = videoIds.slice(-preloadCount);

    // 检查是否需要预加载
    const needPreload = lastIds.filter(id => !this.cache.has(id));
    if (needPreload.length === 0) {
      return;
    }

    // 异步预加载,不等待结果
    this.loader.loadVideoDataBatch(needPreload, options).then(loaded => {
      loaded.forEach((data, id) => {
        this.set(data);
      });
    }).catch(error => {
      console.error('[VideoDataCache] Preload error:', error);
    });
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats & {
    maxSize: number;
  } {
    return this.cache.getStats() as CacheStats & { maxSize: number };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DataCacheConfig>): void {
    if (config.maxSize !== undefined) {
      this.config.maxSize = config.maxSize;
      // 需要重建缓存以应用新的maxSize
      const oldCache = this.cache;
      this.cache = new LRUCache<ID, VideoData>(this.config.maxSize);
      // 迁移现有数据
      oldCache.keys().forEach(key => {
        const value = oldCache.get(key);
        if (value) {
          this.cache.set(key, value);
        }
      });
    }
    if (config.preloadConfig !== undefined) {
      this.config.preloadConfig = {
        ...this.config.preloadConfig,
        ...config.preloadConfig
      };
    }
  }
}
