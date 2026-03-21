import type { Collection } from "../../database/types/collection.js";
import type { AggregatedCollectionVideo } from "../../database/implementations/collection-data-access.impl.js";

// Chrome消息响应类型
export interface ChromeMessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FavoritesState {
  collections: Collection[];
  currentCollectionId: string | null;
  aggregatedVideos: AggregatedCollectionVideo[];
  filteredVideos: AggregatedCollectionVideo[];
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  shouldStopSync: boolean;
  filters: VideoFilters;
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
