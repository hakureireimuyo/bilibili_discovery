import type { Collection } from "../../database/types/collection.js";
import type { FavoritesState, ChromeMessageResponse } from "./types.js";
import { updateFilterOptions } from "./filter-manager.js";

type RefreshFn = () => void;

export async function loadCollections(state: FavoritesState): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'get_collections',
      payload: {}
    }) as unknown as { success: boolean; collections?: Collection[]; error?: string };

    if (response?.success) {
      state.collections = response.collections || [];
    } else {
      console.warn('[Favorites] Failed to load collections:', response?.error);
      state.collections = [];
    }
  } catch (error) {
    console.error('[Favorites] Error loading collections:', error);
    state.collections = [];
  }
}

export function renderCollectionTabs(state: FavoritesState, onSwitch: (collectionId: string) => void): void {
  const collectionTabs = document.getElementById('collectionTabs');
  if (!collectionTabs) return;

  collectionTabs.innerHTML = '';

  if (state.collections.length === 0) {
    showEmptyCollections();
    return;
  }

  // 添加"全部"选项
  const allTab = document.createElement('div');
  allTab.className = `collection-tab ${state.currentCollectionId === 'all' ? 'active' : ''}`;
  allTab.dataset.collectionId = 'all';
  allTab.textContent = '全部';
  allTab.addEventListener('click', () => {
    onSwitch('all');
  });
  collectionTabs.appendChild(allTab);

  state.collections.forEach(collection => {
    const tab = document.createElement('div');
    tab.className = `collection-tab ${collection.collectionId === state.currentCollectionId ? 'active' : ''}`;
    tab.dataset.collectionId = collection.collectionId;
    tab.textContent = collection.name;
    tab.addEventListener('click', () => {
      if (collection.collectionId) {
        onSwitch(collection.collectionId);
      }
    });
    collectionTabs.appendChild(tab);
  });
}

export function showEmptyCollections(): void {
  const collectionTabs = document.getElementById('collectionTabs');
  if (collectionTabs) {
    collectionTabs.innerHTML = '<p class="empty-collections">暂无收藏夹</p>';
  }
}

export async function switchCollection(state: FavoritesState, collectionId: string, refresh: RefreshFn): Promise<void> {
  if (state.currentCollectionId === collectionId) return;

  state.currentCollectionId = collectionId;
  state.currentPage = 0;

  // 清除标签过滤
  state.filters.includeTags = [];
  state.filters.excludeTags = [];

  // 加载新收藏夹的数据
  await loadCollectionData(state);

  // 更新标签列表
  await updateFilterOptions(state);

  renderCollectionTabs(state, async (id) => {
    await switchCollection(state, id, refresh);
  });
  await refresh();
}

export async function loadCollectionData(state: FavoritesState): Promise<void> {
  if (!state.currentCollectionId) {
    console.warn('[Favorites] No current collection ID');
    state.aggregatedVideos = [];
    state.filteredVideos = [];
    return;
  }

  console.log('[Favorites] Loading collection data for:', state.currentCollectionId);

  try {
    // 如果选择的是"全部"，加载所有收藏夹的视频
    if (state.currentCollectionId === 'all') {
      const allVideosResponse = await chrome.runtime.sendMessage({
        type: 'get_all_collection_videos',
        payload: {}
      }) as unknown as { success: boolean; videos?: import("../../database/implementations/collection-data-access.impl.js").AggregatedCollectionVideo[]; error?: string };

      console.log('[Favorites] All videos response:', allVideosResponse);

      if (!allVideosResponse?.success) {
        console.warn('[Favorites] Failed to load all collection videos:', allVideosResponse?.error);
        state.aggregatedVideos = [];
        state.filteredVideos = [];
        return;
      }

      state.aggregatedVideos = allVideosResponse.videos || [];
      state.filteredVideos = [...state.aggregatedVideos];

      console.log('[Favorites] Loaded all videos:', state.aggregatedVideos.length);
      console.log('[Favorites] Aggregated videos:', state.aggregatedVideos);
      return;
    }

    const videosResponse = await chrome.runtime.sendMessage({
      type: 'get_collection_videos',
      payload: {
        collectionId: state.currentCollectionId
      }
    }) as unknown as { success: boolean; videos?: import("../../database/implementations/collection-data-access.impl.js").AggregatedCollectionVideo[]; error?: string };

    console.log('[Favorites] Videos response:', videosResponse);

    if (!videosResponse?.success) {
      console.warn('[Favorites] Failed to load collection videos:', videosResponse?.error);
      state.aggregatedVideos = [];
      state.filteredVideos = [];
      return;
    }

    state.aggregatedVideos = videosResponse.videos || [];
    state.filteredVideos = [...state.aggregatedVideos];

    console.log('[Favorites] Loaded videos:', state.aggregatedVideos.length);
    console.log('[Favorites] Aggregated videos:', state.aggregatedVideos);
  } catch (error) {
    console.error('[Favorites] Error loading collection data:', error);
    state.aggregatedVideos = [];
    state.filteredVideos = [];
  }
}
