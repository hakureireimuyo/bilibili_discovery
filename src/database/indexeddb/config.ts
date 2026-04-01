/**
 * IndexedDB 配置
 * 定义数据库名称、版本和对象存储结构
 */

/**
 * 数据库名称
 */
export const DB_NAME = 'DiscoveryDB';

/**
 * 数据库版本
 * 每次修改数据库结构时需要递增此版本号
 */
export const DB_VERSION = 9;

/**
 * 对象存储名称定义
 */
export const STORE_NAMES = {
  // Content Layer
  CREATORS: 'creators',
  VIDEOS: 'videos',
  IMAGES_METADATA: 'images_metadata',
  IMAGES_DATA: 'images_data',

  // Behavior Layer
  WATCH_EVENTS: 'watch_events',
  INTERACTION_EVENTS: 'interaction_events',
  SEARCH_EVENTS: 'search_events',

  // Semantic Layer
  TAGS: 'tags',
  CATEGORIES: 'categories',

  // Collection Layer
  COLLECTIONS: 'collections',
  COLLECTION_ITEMS: 'collection_items',

  // Analytics Layer
  WATCH_TIME_STATS: 'watch_time_stats',
  WATCH_TIME_DISTRIBUTIONS: 'watch_time_distributions',
  UP_INTERACTIONS: 'up_interactions',
  DAILY_WATCH_STATS: 'daily_watch_stats',
  // App Layer
  APP_META: 'app_meta'
} as const;

/**
 * 索引定义
 * 定义每个对象存储的索引
 */
export const INDEX_DEFINITIONS = {
  // Content Layer - 只保留最常用的查询索引
  [STORE_NAMES.CREATORS]: [
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: true } },
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'isFollowing', keyPath: 'isFollowing', options: { unique: false } }
  ],
  [STORE_NAMES.VIDEOS]: [
    { name: 'videoId', keyPath: 'videoId', options: { unique: true } },
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } },
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'bv', keyPath: 'bv', options: { unique: false } }
  ],
  [STORE_NAMES.IMAGES_METADATA]: [
    { name: 'purpose', keyPath: 'purpose', options: { unique: false } },
    { name: 'lastAccessTime', keyPath: 'lastAccessTime', options: { unique: false } }
  ],
  [STORE_NAMES.IMAGES_DATA]: [
    { name: 'id', keyPath: 'id', options: { unique: true } }
  ],

  // Behavior Layer - 保留事件相关的关键索引
  [STORE_NAMES.WATCH_EVENTS]: [
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } },
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } },
    { name: 'platform', keyPath: 'platform', options: { unique: false } }
  ],
  [STORE_NAMES.INTERACTION_EVENTS]: [
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } },
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: false } },
    { name: 'platform', keyPath: 'platform', options: { unique: false } }
  ],
  [STORE_NAMES.SEARCH_EVENTS]: [
    { name: 'platform', keyPath: 'platform', options: { unique: false } }
  ],

  // Semantic Layer - 保留标签和分类的基本索引
  [STORE_NAMES.TAGS]: [
    { name: 'name', keyPath: 'name', options: { unique: true } },
    { name: 'source', keyPath: 'source', options: { unique: false } }
  ],
  [STORE_NAMES.CATEGORIES]: [
    { name: 'parentId', keyPath: 'parentId', options: { unique: false } }
  ],

  // Collection Layer - 保留收藏集的基本索引
  [STORE_NAMES.COLLECTIONS]: [
    { name: 'name', keyPath: 'name', options: { unique: false } },
    { name: 'platform', keyPath: 'platform', options: { unique: false } }
  ],
  [STORE_NAMES.COLLECTION_ITEMS]: [
    { name: 'collectionId', keyPath: 'collectionId', options: { unique: false } },
    { name: 'videoId', keyPath: 'videoId', options: { unique: false } }
  ],

  [STORE_NAMES.APP_META]: [
    { name: 'updatedAt', keyPath: 'updatedAt', options: { unique: false } }
  ],
  [STORE_NAMES.UP_INTERACTIONS]: [
    { name: 'creatorId', keyPath: 'creatorId', options: { unique: true } },
    { name: 'platform', keyPath: 'platform', options: { unique: false } },
    { name: 'totalWatchDuration', keyPath: 'totalWatchDuration', options: { unique: false } },
    { name: 'lastWatchTime', keyPath: 'lastWatchTime', options: { unique: false } }
  ],
  [STORE_NAMES.DAILY_WATCH_STATS]: [
    { name: 'statsId', keyPath: 'statsId', options: { unique: true } },
    { name: 'dateKey', keyPath: 'dateKey', options: { unique: false } },
    { name: 'platform', keyPath: 'platform', options: { unique: false } }
  ]
} as const;

/**
 * 主键路径定义
 * 定义每个对象存储的主键路径
 */
export const KEY_PATHS = {
  [STORE_NAMES.CREATORS]: 'creatorId',
  [STORE_NAMES.VIDEOS]: 'videoId',
  [STORE_NAMES.IMAGES_METADATA]: 'id',
  [STORE_NAMES.IMAGES_DATA]: 'id',
  [STORE_NAMES.WATCH_EVENTS]: 'eventId',
  [STORE_NAMES.INTERACTION_EVENTS]: 'eventId',
  [STORE_NAMES.SEARCH_EVENTS]: 'eventId',
  [STORE_NAMES.TAGS]: 'tagId',
  [STORE_NAMES.CATEGORIES]: 'id',
  [STORE_NAMES.COLLECTIONS]: 'collectionId',
  [STORE_NAMES.COLLECTION_ITEMS]: 'itemId',
  [STORE_NAMES.WATCH_TIME_STATS]: 'statsId',
  [STORE_NAMES.WATCH_TIME_DISTRIBUTIONS]: 'date',
  [STORE_NAMES.UP_INTERACTIONS]: 'interactionId',
  [STORE_NAMES.DAILY_WATCH_STATS]: 'statsId',
  [STORE_NAMES.APP_META]: 'key'
} as const;
