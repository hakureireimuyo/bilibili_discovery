/**
 * 收藏夹过滤器
 * 提供收藏夹数据的过滤功能
 */

import type { Collection } from '../../database/types/collection.js';

/**
 * 收藏夹过滤器
 * 提供收藏夹数据的过滤功能
 */
export class CollectionFilter {
  /**
   * 根据关键词过滤收藏夹
   * @param collections 收藏夹列表
   * @param keyword 关键词
   * @returns 过滤后的收藏夹列表
   */
  filterByKeyword(collections: Collection[], keyword: string): Collection[] {
    if (!keyword || keyword.trim() === '') {
      return collections;
    }

    const lowerKeyword = keyword.toLowerCase();
    return collections.filter(collection =>
      collection.title.toLowerCase().includes(lowerKeyword) ||
      collection.description?.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 根据类型过滤收藏夹
   * @param collections 收藏夹列表
   * @param type 收藏夹类型
   * @returns 过滤后的收藏夹列表
   */
  filterByType(collections: Collection[], type: 'user' | 'subscription'): Collection[] {
    return collections.filter(collection => collection.type === type);
  }

  /**
   * 根据创建时间范围过滤收藏夹
   * @param collections 收藏夹列表
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 过滤后的收藏夹列表
   */
  filterByTimeRange(
    collections: Collection[],
    startTime: number,
    endTime: number
  ): Collection[] {
    return collections.filter(collection =>
      collection.createdAt >= startTime && collection.createdAt <= endTime
    );
  }

  /**
   * 根据视频数量范围过滤收藏夹
   * @param collections 收藏夹列表
   * @param minCount 最小视频数量
   * @param maxCount 最大视频数量
   * @returns 过滤后的收藏夹列表
   */
  filterByVideoCount(
    collections: Collection[],
    minCount: number,
    maxCount: number
  ): Collection[] {
    return collections.filter(collection =>
      collection.mediaCount >= minCount && collection.mediaCount <= maxCount
    );
  }

  /**
   * 根据可见性过滤收藏夹
   * @param collections 收藏夹列表
   * @param isPublic 是否公开
   * @returns 过滤后的收藏夹列表
   */
  filterByVisibility(collections: Collection[], isPublic: boolean): Collection[] {
    return collections.filter(collection => collection.isPublic === isPublic);
  }

  /**
   * 应用多个过滤条件
   * @param collections 收藏夹列表
   * @param filters 过滤条件对象
   * @returns 过滤后的收藏夹列表
   */
  applyFilters(
    collections: Collection[],
    filters: {
      keyword?: string;
      type?: 'user' | 'subscription';
      startTime?: number;
      endTime?: number;
      minVideoCount?: number;
      maxVideoCount?: number;
      isPublic?: boolean;
    }
  ): Collection[] {
    let filtered = collections;

    // 关键词过滤
    if (filters.keyword) {
      filtered = this.filterByKeyword(filtered, filters.keyword);
    }

    // 类型过滤
    if (filters.type) {
      filtered = this.filterByType(filtered, filters.type);
    }

    // 时间范围过滤
    if (filters.startTime !== undefined && filters.endTime !== undefined) {
      filtered = this.filterByTimeRange(filtered, filters.startTime, filters.endTime);
    }

    // 视频数量范围过滤
    if (filters.minVideoCount !== undefined && filters.maxVideoCount !== undefined) {
      filtered = this.filterByVideoCount(
        filtered,
        filters.minVideoCount,
        filters.maxVideoCount
      );
    }

    // 可见性过滤
    if (filters.isPublic !== undefined) {
      filtered = this.filterByVisibility(filtered, filters.isPublic);
    }

    return filtered;
  }
}

// 导出单例实例
export const collectionFilter = new CollectionFilter();
