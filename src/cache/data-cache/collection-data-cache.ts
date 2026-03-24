
/**
 * 收藏夹数据缓存实现
 * 使用LRU策略管理收藏夹数据缓存
 */

import { LRUCache } from '../lru-cache.js';
import type { CollectionData, DataLoadOptions, DataCacheConfig } from './types.js';
import type { ID } from '../../database/types/base.js';
import type { CacheStats } from '../types.js';

/**
 * 收藏夹数据加载器接口
 * 定义从数据库加载收藏夹数据的方法
 */
export interface ICollectionDataLoader {
  /**
   * 加载单个收藏夹数据
   */
  loadCollectionData(collectionId: ID, options?: DataLoadOptions): Promise<CollectionData | undefined>;

  /**
   * 批量加载收藏夹数据
   */
  loadCollectionDataBatch(collectionIds: ID[], options?: DataLoadOptions): Promise<Map<ID, CollectionData>>;
}

/**
 * 收藏夹数据缓存类
 * 使用LRU策略管理收藏夹数据缓存
 */
export class CollectionDataCache {
  private cache: LRUCache<ID, CollectionData>;
  private loader: ICollectionDataLoader;
  private config: DataCacheConfig;

  constructor(loader: ICollectionDataLoader, config?: Partial<DataCacheConfig>) {
    this.loader = loader;
    this.config = {
      maxSize: config?.maxSize || 200,
      preloadConfig: config?.preloadConfig || {
        enabled: true,
        count: 5
      }
    };
    this.cache = new LRUCache<ID, CollectionData>(this.config.maxSize);
  }

  /**
   * 获取收藏夹数据
   * 如果缓存未命中,从数据库加载
   */
  async get(collectionId: ID, options?: DataLoadOptions): Promise<CollectionData | undefined> {
    // 尝试从缓存获取
    const cached = this.cache.get(collectionId);
    if (cached) {
      return cached;
    }

    // 从数据库加载
    const data = await this.loader.loadCollectionData(collectionId, options);
    if (data) {
      this.set(data);
    }
    return data;
  }

  /**
   * 批量获取收藏夹数据
   * 如果缓存未命中,从数据库加载
   */
  async getBatch(collectionIds: ID[], options?: DataLoadOptions): Promise<Map<ID, CollectionData>> {
    const result = new Map<ID, CollectionData>();
    const missingIds: ID[] = [];

    // 从缓存获取
    for (const collectionId of collectionIds) {
      const cached = this.cache.get(collectionId);
      if (cached) {
        result.set(collectionId, cached);
      } else {
        missingIds.push(collectionId);
      }
    }

    // 从数据库加载缺失的数据
    if (missingIds.length > 0) {
      const loaded = await this.loader.loadCollectionDataBatch(missingIds, options);
      loaded.forEach((data, id) => {
        this.set(data);
        result.set(id, data);
      });
    }

    return result;
  }

  /**
   * 设置收藏夹数据
   */
  set(data: CollectionData): void {
    this.cache.set(data.collection.collectionId, data);
  }

  /**
   * 批量设置收藏夹数据
   */
  setBatch(dataList: CollectionData[]): void {
    dataList.forEach(data => this.set(data));
  }

  /**
   * 检查收藏夹数据是否存在
   */
  has(collectionId: ID): boolean {
    return this.cache.has(collectionId);
  }

  /**
   * 删除收藏夹数据
   */
  delete(collectionId: ID): boolean {
    return this.cache.delete(collectionId);
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
      this.cache = new LRUCache<ID, CollectionData>(this.config.maxSize);
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
