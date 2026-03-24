import type { Collection } from "../../database/types/collection.js";
import type { Video } from "../../database/types/video.js";

/**
 * 聚合收藏夹视频
 * 用于在收藏夹页面显示视频信息
 */
export interface AggregatedCollectionVideo {
  /** 视频ID */
  videoId: string;
  /** 视频标题 */
  title: string;
  /** 视频描述 */
  description: string;
  /** 视频时长（秒） */
  duration: number;
  /** 创作者ID */
  creatorId: string;
  /** 创作者名称 */
  creatorName: string;
  /** 标签ID列表 */
  tags: string[];
  /** 添加到收藏夹的时间 */
  addedAt: number;
  /** 封面图片（base64格式） */
  picture?: string;
  /** 封面图片URL */
  coverUrl?: string;
}

// Chrome消息响应类型
export interface ChromeMessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FavoritesState {
  collections: Collection[];
  currentCollectionId: string | null;
  currentCollectionType: 'user' | 'subscription';
  aggregatedVideos: AggregatedCollectionVideo[];
  filteredVideos: AggregatedCollectionVideo[];
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  shouldStopSync: boolean;
  filters: VideoFilters;
  total: number; // 总记录数，用于分页
}

export interface VideoFilters {
  keyword: string;
  tagId: string;
  creatorId: string;
  includeTags: string[];
  excludeTags: string[];
}

export interface FilterState {
  includeTags: string[];
  excludeTags: string[];
}


