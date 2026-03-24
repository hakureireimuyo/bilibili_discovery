
import type { Category, FilterState, StatsState, UPCacheData } from "./types.js";

export function countUpTags(upTags: Record<string, string[]>): number {
  return Object.values(upTags).reduce((total, tags) => total + (tags?.length ?? 0), 0);
}

export function colorFromTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  }
  const hue = Math.abs(hash) % 360;
  const sat = 70 + (Math.abs(hash * 7) % 21);
  const light = 85 + (Math.abs(hash * 13) % 11);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export function normalizeTag(tag: string): string {
  return tag.trim();
}

export function createInitialState(platform: string = "bilibili"): StatsState {
  return {
    platform: platform as any,
    allTagCounts: {},
    filteredTags: [],
    currentCustomTags: [],
    categories: [],
    filteredCategories: [],
    showFollowedOnly: true,
    filters: {
      includeTags: [],
      excludeTags: [],
      includeCategories: [],
      excludeCategories: []
    },
    currentUpList: [],
    currentUpTags: {},
    tagLibrary: {},
    upCache: {},
    categoryCache: {},
    tagIdToName: {},
    stats: {
      totalCreators: 0,
      followedCount: 0,
      unfollowedCount: 0,
      totalTags: 0
    }
  };
}

export function removeFromList(values: string[], target: string): string[] {
  return values.filter((value) => value !== target);
}

export function findCategory(categories: Category[], categoryId: string): Category | undefined {
  return categories.find((category) => category.id === categoryId);
}

export function resetFilters(filters: FilterState): void {
  filters.includeTags = [];
  filters.excludeTags = [];
  filters.includeCategories = [];
  filters.excludeCategories = [];
}

export function creatorToCacheData(creator: any): UPCacheData {
  return {
    creatorId: creator.creatorId,
    name: creator.name,
    avatar: creator.avatar || '',
    avatarUrl: creator.avatarUrl || '',
    description: creator.description,
    followTime: creator.followTime,
    isFollowing: creator.isFollowing === 1,
    tags: []
  };
}
