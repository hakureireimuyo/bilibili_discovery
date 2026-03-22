import type { UP, UPTagCache } from "../../database/implementations/index.js";

export interface Category {
  id: string;
  name: string;
  tags: string[];
}

export interface FilterState {
  includeTags: string[];
  excludeTags: string[];
  includeCategories: string[];
  excludeCategories: string[];
}

export interface DragContext {
  tag: string;
  originUpMid?: number;
  categoryId?: string;
  dropped: boolean;
}

export interface StatsState {
  allTagCounts: Record<string, number>;
  filteredTags: string[];
  currentCustomTags: string[];
  categories: Category[];
  filteredCategories: Category[];
  showFollowedOnly: boolean;
  filters: FilterState;
  currentUpList: UP[];
  currentUpTags: Record<string, string[]>;
  upTagCache: UPTagCache;
  upManualTagsMap: Record<string, string[]>;
  upAutoTags: Record<string, string[]>;
  tagLibrary: Record<string, { id: string; name: string; editable?: boolean }>;
  // 缓存所有 UP 的完整数据，包括标签
  upDataCache: Record<number, {
    up: UP;
    manualTags: string[];
    autoTags: { tag: string; count: number }[];
  }>;
}
