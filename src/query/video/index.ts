/**
 * 视频查询模块统一导出
 */

// 类型定义
export type {
  VideoIndex,
  VideoQueryParams,
  SearchResult,
  PrefetchConfig,
  QueryResult,
  QueryOptions
} from '../types.js';

// 查询实现
export {
  buildVideoIndex,
  executeQuery,
  getVideos,
  clearQueryCache,
  getAllTags
} from './video-query.js';

// 过滤器
export { VideoFilter, videoFilter } from './video-filter.js';

// 排序器
export { VideoSorter, videoSorter } from './video-sorter.js';

// 调试工具
export {
  debugCollectionData,
  debugAllCollections,
  debugAllVideos,
  debugVideoIndexCache,
  runFullDiagnostics
} from './debug.js';
