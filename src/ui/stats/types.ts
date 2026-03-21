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
}
