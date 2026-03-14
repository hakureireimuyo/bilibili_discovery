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
export const DB_VERSION = 1;

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
  [STORE_NAMES.CREATORS]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'name', keyPath: 'name', options: { unique: false } },
    { name: 'isFollowing', keyPath: 'isFollowing', options: { unique: false } },
    { name: 'followTime', keyPath: 'followTime', options: { unique: false } }
  ],

  [STORE_NAMES.VIDEOS]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } },
    { name: 'publishTime', keyPath: 'publishTime', options: { unique: false } },
    { name: 'tags', keyPath: 'tags', options: { unique: false, multiEntry: true } }
  ],

  [STORE_NAMES.WATCH_EVENTS]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } },
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } },
    { name: 'watchTime', keyPath: 'watchTime', options: { unique: false } }
  ],

  [STORE_NAMES.INTERACTION_EVENTS]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } },
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } },
    { name: 'type', keyPath: 'type', options: { unique: false } },
    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
  ],

  [STORE_NAMES.SEARCH_EVENTS]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'query', keyPath: 'query', options: { unique: false } },
    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
  ],

  [STORE_NAMES.TAGS]: [
    { name: 'name', keyPath: 'name', options: { unique: false } },
    { name: 'source', keyPath: 'source', options: { unique: false } }
  ],

  [STORE_NAMES.TAG_ALIASES]: [
    { name: 'alias', keyPath: 'alias', options: { unique: true } },
    { name: 'targetTagId', keyPath: 'targetTagId', options: { unique: false } },
    { name: 'mappingType', keyPath: 'mappingType', options: { unique: false } }
  ],

  [STORE_NAMES.TAG_EMBEDDINGS]: [
    { name: 'modelName', keyPath: 'modelName', options: { unique: false } }
  ],

  [STORE_NAMES.CATEGORIES]: [
    { name: 'name', keyPath: 'name', options: { unique: false } },
    { name: 'parentId', keyPath: 'parentId', options: { unique: false } },
    { name: 'order', keyPath: 'order', options: { unique: false } }
  ],

  [STORE_NAMES.VIDEO_NOTES]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } },
    { name: 'type', keyPath: 'type', options: { unique: false } },
    { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    { name: 'tagIds', keyPath: 'tagIds', options: { unique: false, multiEntry: true } }
  ],

  [STORE_NAMES.NOTE_SEGMENTS]: [
    { name: 'noteId', keyPath: 'noteId', options: { unique: false } },
    { name: 'order', keyPath: 'order', options: { unique: false } }
  ],

  [STORE_NAMES.NOTE_RELATIONS]: [
    { name: 'sourceNoteId', keyPath: 'sourceNoteId', options: { unique: false } },
    { name: 'targetNoteId', keyPath: 'targetNoteId', options: { unique: false } },
    { name: 'relationType', keyPath: 'relationType', options: { unique: false } }
  ],

  [STORE_NAMES.KNOWLEDGE_ENTRIES]: [
    { name: 'noteId', keyPath: 'noteId', options: { unique: false } },
    { name: 'createdAt', keyPath: 'createdAt', options: { unique: false } },
    { name: 'tagIds', keyPath: 'tagIds', options: { unique: false, multiEntry: true } }
  ],

  [STORE_NAMES.COLLECTIONS]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'name', keyPath: 'name', options: { unique: false } },
    { name: 'lastUpdate', keyPath: 'lastUpdate', options: { unique: false } }
  ],

  [STORE_NAMES.COLLECTION_ITEMS]: [
    { name: 'collectionId', keyPath: 'collectionId', options: { unique: false } },
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } },
    { name: 'addedAt', keyPath: 'addedAt', options: { unique: false } }
  ],

  [STORE_NAMES.INTEREST_SCORES]: [
    { name: 'score', keyPath: 'score', options: { unique: false } },
    { name: 'shortTermScore', keyPath: 'shortTermScore', options: { unique: false } },
    { name: 'longTermScore', keyPath: 'longTermScore', options: { unique: false } }
  ],

  [STORE_NAMES.INTEREST_NODES]: [
    { name: 'parentId', keyPath: 'parentId', options: { unique: false } },
    { name: 'weight', keyPath: 'weight', options: { unique: false } }
  ],

  [STORE_NAMES.INTEREST_HISTORIES]: [
    { name: 'tagId', keyPath: 'tagId', options: { unique: false } },
    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
  ],

  [STORE_NAMES.CREATOR_RANKS]: [
    { name: 'score', keyPath: 'score', options: { unique: false } },
    { name: 'rank', keyPath: 'rank', options: { unique: false } }
  ],

  [STORE_NAMES.WATCH_TIME_STATS]: [
    { name: 'hour', keyPath: 'hour', options: { unique: false } },
    { name: 'dayType', keyPath: 'dayType', options: { unique: false } }
  ],

  [STORE_NAMES.WATCH_TIME_DISTRIBUTIONS]: [
    { name: 'date', keyPath: 'date', options: { unique: true } }
  ],

  [STORE_NAMES.USER_INTEREST_PROFILES]: [
    { name: 'lastUpdate', keyPath: 'lastUpdate', options: { unique: false } }
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
