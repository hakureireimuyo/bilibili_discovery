/**
 * 缓存类型定义
 */

/**
 * 缓存接口
 * 定义缓存的基本操作
 */
export interface ICache<K, V> {
  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存值
   */
  get(key: K): V | undefined;

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param value 缓存值
   */
  set(key: K, value: V): void;

  /**
   * 批量设置缓存
   * @param entries 缓存项数组
   */
  setBatch(entries: Array<[K, V]>): void;

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  delete(key: K): boolean;

  /**
   * 清空缓存
   */
  clear(): void;

  /**
   * 获取缓存统计
   * @returns 统计信息
   */
  getStats(): CacheStats;

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: K): boolean;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 缓存大小 */
  size: number;
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 内存使用量(字节) */
  memoryUsage?: number;
}
