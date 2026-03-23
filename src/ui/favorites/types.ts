import type { Collection } from "../../database/types/collection.js";
import type { AggregatedCollectionVideo } from "../../database/implementations/collection-facade.impl.js";

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

export type AggregatedVideo = AggregatedCollectionVideo;
