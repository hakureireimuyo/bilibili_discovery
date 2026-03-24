/**
 * 收藏视频页面
 * 基于Collection和CollectionItem数据结构实现
 * 风格与stats页面保持一致
 */

import {
  loadCollections,
  renderCollectionTabs,
  showEmptyCollections,
  switchCollection,
  switchCollectionType,
  loadCollectionData
} from "./collection-manager.js";
import { applyFilters, updateFilterOptions, clearFilters, renderFilterTags, setupDragAndDrop } from "./filter-manager.js";
import { createInitialState, setLoading, showError, updatePagination } from "./helpers.js";

import { renderVideos, changePage } from "./video-list.js";
import type { FavoritesState } from "./types.js";
import { clearAllCaches } from "../cache/index.js";
import { debugCollectionData, debugAllCollections, debugAllVideos, runFullDiagnostics } from "../../query/video/debug.js";

// DOM元素
const elements = {
  collectionTabs: document.getElementById('collectionTabs'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  clearFilterBtn: document.getElementById('clearFilterBtn'),
  videoList: document.getElementById('videoList'),
  loading: document.getElementById('loading'),
  empty: document.getElementById('empty'),
  error: document.getElementById('error'),
  errorMessage: document.getElementById('errorMessage'),
  pagination: document.getElementById('pagination'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageInfo: document.getElementById('pageInfo'),
  filterIncludeTags: document.getElementById('filter-include-tags'),
  filterExcludeTags: document.getElementById('filter-exclude-tags')
};

// 状态
let state: FavoritesState;

/**
 * 重新渲染页面
 */
async function rerenderPage(): Promise<void> {
  console.log('[Favorites] Rerendering page...');
  console.log('[Favorites] Current state:', {
    currentCollectionId: state.currentCollectionId,
    aggregatedVideosCount: state.aggregatedVideos.length,
    filteredVideosCount: state.filteredVideos.length,
    currentPage: state.currentPage
  });

  const setLoadingState = (loading: boolean) => {
    state.isLoading = loading;
    setLoading(loading, elements);
  };

  const showErrorState = (message: string) => showError(message, elements);

  await renderVideos(state, elements);
  renderCollectionTabs(state, (id) => switchCollection(state, id, rerenderPage), (type) => switchCollectionType(state, type, rerenderPage));
  updatePagination(state, elements);
  renderFilterTags(state, rerenderPage);
}

/**
 * 加载状态
 */
async function loadState(): Promise<void> {
  console.log('[Favorites] Loading state...');

  try {
    setLoading(true, elements);
    await loadCollections(state);

    console.log('[Favorites] Loaded collections:', state.collections.length);

    if (state.collections.length === 0) {
      console.log('[Favorites] No collections found');
      showEmptyCollections();
      state.aggregatedVideos = [];
      state.filteredVideos = [];
      return;
    }

    // 根据当前类型过滤收藏夹
    const filteredCollections = state.collections.filter(
      collection => collection.type === state.currentCollectionType ||
                    (collection.type === undefined && state.currentCollectionType === 'user')
    );

    if (!state.currentCollectionId || !filteredCollections.find(c => c.collectionId === state.currentCollectionId)) {
      state.currentCollectionId = filteredCollections.length > 0 ? filteredCollections[0].collectionId : 'all';
      console.log('[Favorites] Set current collection ID:', state.currentCollectionId);
    }

    await loadCollectionData(state);
    await updateFilterOptions(state);
    renderFilterTags(state, rerenderPage);
  } catch (error) {
    console.error('[Favorites] Error loading state:', error);
    console.error('[Favorites] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    showError('加载数据失败', elements);
    state.aggregatedVideos = [];
    state.filteredVideos = [];
  } finally {
    setLoading(false, elements);
  }
}

/**
 * 绑定输入事件
 */
function bindInputs(): void {
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  const searchBtn = document.getElementById('searchBtn');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');

  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  searchBtn?.addEventListener('click', handleSearch);

  clearFilterBtn?.addEventListener('click', async () => {
    clearFilters(state);
    await loadCollectionData(state);
    await rerenderPage();
  });

  prevPage?.addEventListener('click', async () => {
    await changePage(state, -1, async () => {
      await loadCollectionData(state);
      await rerenderPage();
    });
  });
  nextPage?.addEventListener('click', async () => {
    await changePage(state, 1, async () => {
      await loadCollectionData(state);
      await rerenderPage();
    });
  });
}

/**
 * 处理搜索
 */
async function handleSearch(): Promise<void> {
  try {
    setLoading(true, elements);
    await applyFilters(state);
    await loadCollectionData(state);
    await rerenderPage();
  } catch (error) {
    console.error('[Favorites] Error searching videos:', error);
    showError('搜索失败', elements);
  } finally {
    setLoading(false, elements);
  }
}

/**
 * 清空缓存
 */
function clearCaches(): void {
  clearAllCaches();
  console.log('[Favorites] All caches cleared');
}

/**
 * 初始化
 */
export async function initFavorites(): Promise<void> {
  console.log('[Favorites] Initializing favorites page...');

  if (typeof document === "undefined") {
    console.log('[Favorites] Document is undefined, skipping initialization');
    return;
  }

  state = createInitialState();
  console.log('[Favorites] Created initial state');

  const setLoadingState = (loading: boolean) => {
    state.isLoading = loading;
    setLoading(loading, elements);
  };

  const showErrorState = (message: string) => showError(message, elements);

  bindInputs();

  console.log('[Favorites] Loading state...');
  await loadState();

  // 默认选择"全部"
  if (state.currentCollectionId !== 'all') {
    state.currentCollectionId = 'all';
    await loadCollectionData(state);
    await updateFilterOptions(state);
  }

  setupDragAndDrop(state, rerenderPage);

  console.log('[Favorites] Initial render...');
  await rerenderPage();

  // 暴露调试工具到全局
  if (typeof window !== 'undefined') {
    (window as any).debugFavorites = {
      debugCollectionData,
      debugAllCollections,
      debugAllVideos,
      runFullDiagnostics,
      clearCaches
    };
    console.log('[Favorites] Debug tools available at window.debugFavorites');
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFavorites);
} else {
  void initFavorites();
}

// 页面关闭时清空缓存
window.addEventListener('beforeunload', () => {
  clearCaches();
});
