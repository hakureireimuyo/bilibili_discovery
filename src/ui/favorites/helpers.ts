import type { FavoritesState, FilterState } from "./types.js";

export function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

export function getInputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
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

export function removeFromList(values: string[], target: string): string[] {
  return values.filter((value) => value !== target);
}

export function resetFilters(filters: FilterState): void {
  filters.includeTags = [];
  filters.excludeTags = [];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function createInitialState(): FavoritesState {
  return {
    collections: [],
    currentCollectionId: null,
    aggregatedVideos: [],
    filteredVideos: [],
    currentPage: 0,
    pageSize: 20,
    isLoading: false,
    shouldStopSync: false,
    filters: {
      keyword: '',
      tagId: '',
      creatorId: '',
      includeTags: [],
      excludeTags: []
    }
  };
}

export function setLoading(loading: boolean, elements: Record<string, HTMLElement | null>): void {
  if (elements.loading) elements.loading.style.display = loading ? 'block' : 'none';
  if (elements.syncBtn) {
    (elements.syncBtn as HTMLButtonElement).disabled = loading;
    elements.syncBtn.textContent = loading ? '同步中...' : '同步收藏';
  }
  if (elements.stopSyncBtn) (elements.stopSyncBtn as HTMLButtonElement).disabled = !loading;
}

export function showError(message: string, elements: Record<string, HTMLElement | null>): void {
  if (elements.error) elements.error.style.display = 'block';
  if (elements.errorMessage) elements.errorMessage.textContent = message;

  // 3秒后自动隐藏
  setTimeout(() => {
    if (elements.error) elements.error.style.display = 'none';
  }, 3000);
}

export function updatePagination(state: FavoritesState, elements: Record<string, HTMLElement | null>): void {
  const total = state.filteredVideos.length;
  const totalPages = Math.ceil(total / state.pageSize);

  if (totalPages <= 1) {
    if (elements.pagination) elements.pagination.style.display = 'none';
    return;
  }

  if (elements.pagination) elements.pagination.style.display = 'flex';

  // 更新页码信息
  if (elements.pageInfo) elements.pageInfo.textContent = `${state.currentPage + 1} / ${totalPages}`;

  // 更新按钮状态
  if (elements.prevPage) (elements.prevPage as HTMLButtonElement).disabled = state.currentPage === 0;
  if (elements.nextPage) (elements.nextPage as HTMLButtonElement).disabled = state.currentPage >= totalPages - 1;
}
