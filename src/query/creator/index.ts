/**
 * 创作者查询模块统一导出
 */

// 类型定义
export type {
  QueryResult,
  QueryOptions,
  CreatorQueryParams
} from '../types.js';

// 查询实现
export {
  searchCreators,
  getCreator,
  getCreatorsByIds,
  getAvatarUrl,
  updateTagWeights,
  getFollowedCount,
  getUnfollowedCount,
  getTagUsageCounts,
  clearCreatorCache
} from './creator-query.js';

// 调试工具
export {
  debugCreatorData,
  debugAllCreators,
  debugSearchCreators,
  debugTagUsage,
  runFullDiagnostics
} from './debug.js';
