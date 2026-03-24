/**
 * 收藏夹查询模块统一导出
 */

// 类型定义
export type {
  QueryResult,
  QueryOptions,
  CategoryQueryParams
} from '../types.js';

// 查询实现
export {
  getAllCollections,
  getCollectionById,
  getCollectionVideos,
  createCollection,
  updateCollection,
  deleteCollection,
  addVideoToCollection,
  removeVideoFromCollection,
  clearCollectionCache
} from './collection-query.js';

// 过滤器
export { CollectionFilter, collectionFilter } from './collection-filter.js';

// 调试工具
export {
  debugCollectionData,
  debugAllCollections,
  debugCollectionIndexCache,
  runFullDiagnostics
} from './debug.js';
