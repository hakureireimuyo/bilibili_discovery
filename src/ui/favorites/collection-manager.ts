import type { Collection } from "../../database/types/collection.js";
import type { FavoritesState, ChromeMessageResponse } from "./types.js";

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

  renderCollectionTabs(state, (id) => switchCollection(state, id, refresh));
  await refresh();
}

export async function loadCollectionData(state: FavoritesState): Promise<void> {
  if (!state.currentCollectionId) {
    state.aggregatedVideos = [];
    state.filteredVideos = [];
    return;
  }

  try {
    const videosResponse = await chrome.runtime.sendMessage({
      type: 'get_collection_videos',
      payload: {
        collectionId: state.currentCollectionId
      }
    }) as unknown as { success: boolean; videos?: import("../../database/implementations/collection-data-access.impl.js").AggregatedCollectionVideo[]; error?: string };

    if (!videosResponse?.success) {
      console.warn('[Favorites] Failed to load collection videos:', videosResponse?.error);
      state.aggregatedVideos = [];
      state.filteredVideos = [];
      return;
    }

    state.aggregatedVideos = videosResponse.videos || [];
    state.filteredVideos = [...state.aggregatedVideos];
  } catch (error) {
    console.error('[Favorites] Error loading collection data:', error);
    state.aggregatedVideos = [];
    state.filteredVideos = [];
  }
}
