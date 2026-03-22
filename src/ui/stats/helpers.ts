import type { Category, FilterState, StatsState } from "./types.js";

export function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

export function countVideoTotals(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, value) => total + (value ?? 0), 0);
}

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

export function getInputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
}

export function updateToggleLabel(showFollowedOnly: boolean): void {
  const toggleLabel = document.querySelector(".toggle-label");
  if (toggleLabel) {
    toggleLabel.textContent = showFollowedOnly ? "已关注" : "未关注";
  }
}

export function createInitialState(): StatsState {
  return {
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
    upTagCache: {},
    upManualTagsMap: {},
    upAutoTags: {},
    tagLibrary: {},
    upDataCache: {}
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
