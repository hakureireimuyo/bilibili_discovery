/**
 * IndexedDB 配置
 * 定义数据库名称、版本和对象存储结构
 */

/**
 * 数据库名称
 */
export const DB_NAME = 'BilibiliDiscoveryDB';

/**
 * 数据库版本
 * 每次修改数据库结构时需要递增此版本号
 */
export const DB_VERSION = 2;

/**
 * 对象存储名称定义
 */
export const STORE_NAMES = {
  // Content Layer
  CREATORS: 'creators',
  VIDEOS: 'videos',

  // Behavior Layer
  WATCH_EVENTS: 'watch_events',
  INTERACTION_EVENTS: 'interaction_events',
  SEARCH_EVENTS: 'search_events',

  // Semantic Layer
  TAGS: 'tags',
  TAG_ALIASES: 'tag_aliases',
  TAG_EMBEDDINGS: 'tag_embeddings',
  CATEGORIES: 'categories',

  // Notes Layer
  VIDEO_NOTES: 'video_notes',
  NOTE_SEGMENTS: 'note_segments',
  NOTE_RELATIONS: 'note_relations',
  KNOWLEDGE_ENTRIES: 'knowledge_entries',

  // Collection Layer
  COLLECTIONS: 'collections',
  COLLECTION_ITEMS: 'collection_items',

  // Analytics Layer
  INTEREST_SCORES: 'interest_scores',
  INTEREST_NODES: 'interest_nodes',
  INTEREST_HISTORIES: 'interest_histories',
  CREATOR_RANKS: 'creator_ranks',
  WATCH_TIME_STATS: 'watch_time_stats',
  WATCH_TIME_DISTRIBUTIONS: 'watch_time_distributions',
  USER_INTEREST_PROFILES: 'user_interest_profiles'
} as const;

/**
 * 索引定义
 * 定义每个对象存储的索引
 */
export const INDEX_DEFINITIONS = {
  // Content Layer - 只保留最常用的查询索引
  [STORE_NAMES.CREATORS]: [
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } },
    { name: 'isFollowing', keyPath: 'isFollowing', options: { unique: false } }
  ],
  [STORE_NAMES.VIDEOS]: [
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } }
  ],

  // Behavior Layer - 保留事件相关的关键索引
  [STORE_NAMES.WATCH_EVENTS]: [
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } }
  ],
  [STORE_NAMES.INTERACTION_EVENTS]: [
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } }
  ],

  // Semantic Layer - 保留标签和分类的基本索引
  [STORE_NAMES.TAGS]: [
    { name: 'name', keyPath: 'name', options: { unique: false } }
  ],
  [STORE_NAMES.TAG_ALIASES]: [
    { name: 'alias', keyPath: 'alias', options: { unique: true } }
  ],
  [STORE_NAMES.CATEGORIES]: [
    { name: 'parentId', keyPath: 'parentId', options: { unique: false } }
  ],

  // Notes Layer - 保留笔记关联的关键索引
  [STORE_NAMES.VIDEO_NOTES]: [
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } }
  ],
  [STORE_NAMES.NOTE_SEGMENTS]: [
    { name: 'noteId', keyPath: 'noteId', options: { unique: false } }
  ],
  [STORE_NAMES.NOTE_RELATIONS]: [
    { name: 'sourceNoteId', keyPath: 'sourceNoteId', options: { unique: false } }
  ],

  // Collection Layer - 保留收藏集的基本索引
  [STORE_NAMES.COLLECTIONS]: [
    { name: 'name', keyPath: 'name', options: { unique: false } }
  ],
  [STORE_NAMES.COLLECTION_ITEMS]: [
    { name: 'collectionId', keyPath: 'collectionId', options: { unique: false } }
  ],

  // Analytics Layer - 保留兴趣相关的核心索引
  [STORE_NAMES.INTEREST_SCORES]: [
    { name: 'score', keyPath: 'score', options: { unique: false } }
  ],
  [STORE_NAMES.INTEREST_NODES]: [
    { name: 'parentId', keyPath: 'parentId', options: { unique: false } }
  ]
} as const;

/**
 * 主键路径定义
 * 定义每个对象存储的主键路径
 */
export const KEY_PATHS = {
  [STORE_NAMES.CREATORS]: 'creatorId',
  [STORE_NAMES.VIDEOS]: 'videoId',
  [STORE_NAMES.WATCH_EVENTS]: 'eventId',
  [STORE_NAMES.INTERACTION_EVENTS]: 'eventId',
  [STORE_NAMES.SEARCH_EVENTS]: 'eventId',
  [STORE_NAMES.TAGS]: 'tagId',
  [STORE_NAMES.TAG_ALIASES]: 'aliasId',
  [STORE_NAMES.TAG_EMBEDDINGS]: 'tagId',
  [STORE_NAMES.CATEGORIES]: 'id',
  [STORE_NAMES.VIDEO_NOTES]: 'noteId',
  [STORE_NAMES.NOTE_SEGMENTS]: 'segmentId',
  [STORE_NAMES.NOTE_RELATIONS]: 'relationId',
  [STORE_NAMES.KNOWLEDGE_ENTRIES]: 'entryId',
  [STORE_NAMES.COLLECTIONS]: 'collectionId',
  [STORE_NAMES.COLLECTION_ITEMS]: 'itemId',
  [STORE_NAMES.INTEREST_SCORES]: 'tagId',
  [STORE_NAMES.INTEREST_NODES]: 'nodeId',
  [STORE_NAMES.INTEREST_HISTORIES]: 'recordId',
  [STORE_NAMES.CREATOR_RANKS]: 'creatorId',
  [STORE_NAMES.WATCH_TIME_STATS]: 'statsId',
  [STORE_NAMES.WATCH_TIME_DISTRIBUTIONS]: 'date',
  [STORE_NAMES.USER_INTEREST_PROFILES]: 'profileId'
} as const;
