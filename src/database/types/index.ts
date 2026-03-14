/**
 * Database Types 统一导出
 * 导出所有数据类型定义
 */

// 基础类型
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
} from './video';

// Behavior 类型
export type {
  WatchEvent,
  InteractionEvent,
  SearchEvent,
  BehaviorSummary
} from './behavior';

// Semantic 类型
export type {
  Tag,
  TagAlias,
  TagEmbedding,
  Category,
  TagStats
} from './semantic';

// Note 类型
export type {
  VideoNote,
  NoteSegment,
  NoteRelation,
  KnowledgeEntry
} from './note';

// Collection 类型
export type {
  Collection,
  CollectionItem,
  CollectionStats
} from './collection';

// Analytics 类型
export type {
  InterestScore,
  InterestNode,
  InterestHistory,
  CreatorRank,
  WatchTimeStats,
  WatchTimeDistribution,
  UserInterestProfile
} from './analytics';
