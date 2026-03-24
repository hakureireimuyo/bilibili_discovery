/**
 * 视频排序器
 * 提供视频数据的排序功能
 */

import type { VideoIndex, SortCondition } from '../types.js';

/**
 * 视频排序器
 * 提供视频数据的排序功能
 */
export class VideoSorter {
  /**
   * 根据单个条件排序
   * @param videos 视频索引列表
   * @param field 排序字段
   * @param direction 排序方向
   * @returns 排序后的视频列表
   */
  sortByField(
    videos: VideoIndex[],
    field: keyof VideoIndex,
    direction: 'asc' | 'desc' = 'asc'
  ): VideoIndex[] {
    const sorted = [...videos];
    sorted.sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return direction === 'desc' ? -comparison : comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'desc' 
          ? bValue - aValue 
          : aValue - bValue;
      }

      return 0;
    });

    return sorted;
  }

  /**
   * 根据标题排序
   * @param videos 视频索引列表
   * @param direction 排序方向
   * @returns 排序后的视频列表
   */
  sortByTitle(videos: VideoIndex[], direction: 'asc' | 'desc' = 'asc'): VideoIndex[] {
    return this.sortByField(videos, 'title', direction);
  }

  /**
   * 根据创建时间排序
   * @param videos 视频索引列表
   * @param direction 排序方向
   * @returns 排序后的视频列表
   */
  sortByCreatedAt(videos: VideoIndex[], direction: 'asc' | 'desc' = 'desc'): VideoIndex[] {
    return this.sortByField(videos, 'createdAt', direction);
  }

  /**
   * 根据创作者名称排序
   * @param videos 视频索引列表
   * @param direction 排序方向
   * @returns 排序后的视频列表
   */
  sortByCreatorName(videos: VideoIndex[], direction: 'asc' | 'desc' = 'asc'): VideoIndex[] {
    return this.sortByField(videos, 'creatorName', direction);
  }

  /**
   * 根据标签数量排序
   * @param videos 视频索引列表
   * @param direction 排序方向
   * @returns 排序后的视频列表
   */
  sortByTagCount(videos: VideoIndex[], direction: 'asc' | 'desc' = 'desc'): VideoIndex[] {
    const sorted = [...videos];
    sorted.sort((a, b) => {
      const aCount = a.tags.length;
      const bCount = b.tags.length;
      return direction === 'desc' ? bCount - aCount : aCount - bCount;
    });

    return sorted;
  }

  /**
   * 应用多个排序条件
   * @param videos 视频索引列表
   * @param sortConditions 排序条件数组
   * @returns 排序后的视频列表
   */
  applySort(videos: VideoIndex[], sortConditions: SortCondition[]): VideoIndex[] {
    if (!sortConditions || sortConditions.length === 0) {
      return videos;
    }

    let sorted = [...videos];

    // 按照排序条件的顺序依次排序
    // 注意:由于JavaScript的sort是稳定的,后面的排序条件不会影响前面的排序结果
    for (const condition of sortConditions) {
      sorted = this.sortByField(sorted, condition.field as keyof VideoIndex, condition.direction);
    }

    return sorted;
  }
}

// 导出单例实例
export const videoSorter = new VideoSorter();
