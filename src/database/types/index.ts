/**
 * Database Types 统一导出
 * 导出所有数据类型定义
 */

// 基础类型
export type {
  UP,
  AppVideo,
  UPCache,
  UPFaceDataCacheEntry,
  VideoCacheEntry,
  UserInterest,
  InterestProfile,
  AppTag,
  TagLibrary,
  UPTagWeight,
  UPTagWeights,
  UPTagCount,
  UPTagCache,
  AppCategory,
  CategoryLibrary
} from './app.js';

export type {
  Platform,
  TagSource,
  VideoSource,
  InteractionType,
  NoteType,
  Timestamp,
  ID,
  PaginationParams,
  PaginationResult,
  TimeRange
} from './base.js';

// Creator 类型
export type {
  Creator,
  CreatorStats,
  CreatorTagWeight
} from './creator.js';

// Video 类型
export type {
  Video,
  VideoStats,
  VideoHotness
} from './video.js';

// Image 类型
export type {
  Image
} from './image.js';

export { ImagePurpose } from './image.js';

// Behavior 类型
export type {
  WatchEvent,
  InteractionEvent,
  SearchEvent,
  BehaviorSummary
} from './behavior.js';

// Semantic 类型
export type {
  Tag,
  TagAlias,
  TagEmbedding,
  Category,
  TagStats
} from './semantic.js';

// Note 类型
export type {
  VideoNote,
  NoteSegment,
  NoteRelation,
  KnowledgeEntry
} from './note.js';

// Collection 类型
export type {
  Collection,
  CollectionItem
} from './collection.js';

// Analytics 类型
export type {
  InterestScore,
  InterestNode,
  InterestHistory,
  CreatorRank,
  WatchTimeStats,
  WatchTimeDistribution,
  UserInterestProfile
} from './analytics.js';
