/**
 * Database Implementations 统一导出
 * 导出所有数据库实现类
 */

// Semantic 实现
export { TagRepository } from './tag-repository.impl.js';
export { CategoryRepository } from './category-repository.impl.js';
export * from './bilibili-data-access.impl.js';
export type {
  AppSettings,
  AppCategory,
  AppTag,
  AppVideo,
  CategoryLibrary,
  ClassifyStatus,
  InterestProfile,
  TagLibrary,
  UPCache,
  UPFaceDataCacheEntry,
  UPTagCache,
  UPTagCount,
  UPTagWeight,
  UPTagWeights,
  UP,
  UserInterest,
  VideoCacheEntry
} from '../types/app.js';

// Creator 实现
export { CreatorRepository } from './creator-repository.impl.js';

// Video 实现
export { VideoRepository } from './video-repository.impl.js';

// Behavior 实现
export { WatchEventRepository } from './watch-event-repository.impl.js';
export { InteractionEventRepository } from './interaction-event-repository.impl.js';
export { SearchEventRepository } from './search-event-repository.impl.js';

// Collection 实现
export { CollectionRepository } from './collection-repository.impl.js';
export { CollectionItemRepository } from './collection-item-repository.impl.js';

// Analytics 实现
export { InterestScoreRepository } from './interest-score-repository.impl.js';

// Note 实现
export { VideoNoteRepository } from './video-note-repository.impl.js';
export { NoteSegmentRepository } from './note-segment-repository.impl.js';
export { KnowledgeEntryRepository } from './knowledge-entry-repository.impl.js';
