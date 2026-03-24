/**
 * 视频过滤器
 * 提供视频数据的过滤功能
 */

import type { VideoIndex, VideoQueryParams } from '../types.js';

/**
 * 视频过滤器
 * 提供视频数据的过滤功能
 */
export class VideoFilter {
  /**
   * 根据关键词过滤视频
   * @param videos 视频索引列表
   * @param keyword 关键词
   * @returns 过滤后的视频列表
   */
  filterByKeyword(videos: VideoIndex[], keyword: string): VideoIndex[] {
    if (!keyword || keyword.trim() === '') {
      return videos;
    }

    const lowerKeyword = keyword.toLowerCase();
    return videos.filter(video =>
      video.title.toLowerCase().includes(lowerKeyword) ||
      video.creatorName.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 根据标签过滤视频
   * @param videos 视频索引列表
   * @param includeTags 包含的标签列表
   * @param excludeTags 排除的标签列表
   * @returns 过滤后的视频列表
   */
  filterByTags(
    videos: VideoIndex[],
    includeTags: string[] = [],
    excludeTags: string[] = []
  ): VideoIndex[] {
    return videos.filter(video => {
      // 检查包含标签
      const includeMatch = includeTags.length === 0 ||
        includeTags.some(tag => video.tags.includes(tag));

      // 检查排除标签
      const excludeMatch = excludeTags.length === 0 ||
        !excludeTags.some(tag => video.tags.includes(tag));

      return includeMatch && excludeMatch;
    });
  }

  /**
   * 根据收藏夹过滤视频
   * @param videos 视频索引列表
   * @param collectionId 收藏夹ID
   * @returns 过滤后的视频列表
   */
  filterByCollection(videos: VideoIndex[], collectionId: string): VideoIndex[] {
    return videos.filter(video =>
      video.collectionIds.includes(collectionId)
    );
  }

  /**
   * 根据创作者过滤视频
   * @param videos 视频索引列表
   * @param creatorId 创作者ID
   * @returns 过滤后的视频列表
   */
  filterByCreator(videos: VideoIndex[], creatorId: string): VideoIndex[] {
    return videos.filter(video => video.creatorId === creatorId);
  }

  /**
   * 根据时间范围过滤视频
   * @param videos 视频索引列表
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 过滤后的视频列表
   */
  filterByTimeRange(
    videos: VideoIndex[],
    startTime: number,
    endTime: number
  ): VideoIndex[] {
    return videos.filter(video =>
      video.createdAt >= startTime && video.createdAt <= endTime
    );
  }

  /**
   * 应用多个过滤条件
   * @param videos 视频索引列表
   * @param params 查询参数
   * @returns 过滤后的视频列表
   */
  applyFilters(videos: VideoIndex[], params: VideoQueryParams): VideoIndex[] {
    let filtered = videos;

    // 关键词过滤
    if (params.keyword) {
      filtered = this.filterByKeyword(filtered, params.keyword);
    }

    // 标签过滤
    if (params.includeTags || params.excludeTags) {
      filtered = this.filterByTags(
        filtered,
        params.includeTags || [],
        params.excludeTags || []
      );
    }

    // 收藏夹过滤
    if (params.collectionId) {
      filtered = this.filterByCollection(filtered, params.collectionId);
    }

    // 创作者过滤
    if (params.filters) {
      const creatorFilter = params.filters.find(f => f.field === 'creatorId');
      if (creatorFilter) {
        filtered = this.filterByCreator(filtered, creatorFilter.value);
      }
    }

    // 时间范围过滤
    if (params.filters) {
      const timeFilter = params.filters.find(f => f.field === 'createdAt');
      if (timeFilter && timeFilter.operator === 'gte') {
        const endTimeFilter = params.filters.find(f => 
          f.field === 'createdAt' && f.operator === 'lte'
        );
        if (endTimeFilter) {
          filtered = this.filterByTimeRange(
            filtered,
            timeFilter.value,
            endTimeFilter.value
          );
        }
      }
    }

    return filtered;
  }
}

// 导出单例实例
export const videoFilter = new VideoFilter();
