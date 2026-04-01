/**
 * 实现层统一入口 - 直接访问底层存储
 * 
 * 用途：
 * 1. 提供对底层存储的直接访问，满足批量操作和性能需求
 * 2. 绕过缓存层，直接操作数据库，适用于大量数据的批量操作
 * 3. 为系统其他模块提供直接的数据访问能力
 * 
 * 与Repository层的区别：
 * - Repository层：基于缓存和策略的复杂查询，适合UI交互场景
 * - 实现层：直接访问底层存储，适合批量操作和系统内部需求
 */

// Semantic 实现
export { TagRepositoryImpl } from './tag-repository.impl.js';
export { CategoryRepositoryImpl } from './category-repository.impl.js';

// Creator 实现
export { CreatorRepositoryImpl } from './creator-repository.impl.js';

// Video 实现
export { VideoRepositoryImpl } from './video-repository.impl.js';

// Behavior 实现
export { WatchEventRepositoryImpl } from './watch-event-repository.impl.js';

// UP主交互实现
export { UPInteractionRepositoryImpl } from './up-interaction-repository.impl.js';

// 每日观看统计实现
export { DailyWatchStatsRepositoryImpl } from './daily-watch-stats-repository.impl.js';

// Collection 实现
export { CollectionRepositoryImpl } from './collection-repository.impl.js';
export { CollectionItemRepositoryImpl } from './collection-item-repository.impl.js';

// Settings 实现
export { getValue, setValue, deleteValue } from './settings-repository.impl.js';
export type { AppSettings } from './settings-repository.impl.js';
