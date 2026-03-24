/**
 * 应用模块统一导出
 */

export type {
  FavoritesState,
  VideoFilters,
  FilterState,
  AggregatedCollectionVideo,
  ChromeMessageResponse
} from './types.js';

export {
  createInitialState,
  setText,
  getInputValue,
  colorFromTag,
  removeFromList,
  resetFilters,
  formatDuration,
  setLoading,
  showError,
  updatePagination
} from './helpers.js';

export { createLink } from './dom.js';

export {
  loadCollections,
  renderCollectionTabs,
  showEmptyCollections,
  switchCollection,
  switchCollectionType,
  loadCollectionData
} from './collection-manager.js';

export {
  applyFilters,
  updateFilterOptions,
  renderFilterTags,
  clearFilters,
  setupDragAndDrop
} from './filter-manager.js';

export {
  createVideoCard,
  renderVideos,
  changePage
} from './video-list.js';

export {
  handleSync,
  handleStopSync,
  showStopSyncButton,
  bindPageActions
} from './page-actions.js';

export { initFavorites } from './favorites.js';
