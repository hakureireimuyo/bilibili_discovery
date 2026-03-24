
/**
 * 索引缓存类型定义
 */

import type { ID, Timestamp } from '../../database/types/base.js';

/**
 * 视频索引信息
 * 只存储视频的关键索引字段,用于快速搜索和过滤
 */
export interface VideoIndex {
  /** 视频ID */
  videoId: ID;
  /** 标题 */
  title: string;
  /** 创作者ID */
  creatorId: ID;
  /** 创作者名称 */
  creatorName: string;
  /** 标签列表 */
  tags: ID[];
  /** 收藏夹ID列表 */
  collectionIds: ID[];
  /** 创建时间 */
  createdAt: Timestamp;
  /** 更新时间 */
  updatedAt: Timestamp;
}

/**
 * 收藏夹索引信息
 * 只存储收藏夹的关键索引字段
 */
export interface CollectionIndex {
  /** 收藏夹ID */
  collectionId: ID;
  /** 名称 */
  name: string;
  /** 标签列表 */
  tags: ID[];
  /** 视频数量 */
  videoCount: number;
  /** 最后添加时间 */
  lastAddedAt?: Timestamp;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 更新时间 */
  updatedAt: Timestamp;
}

/**
 * 索引查询条件
 */
export interface IndexQuery {
  /** 标签过滤 */
  tags?: ID[];
  /** 创作者过滤 */
  creatorId?: ID;
  /** 收藏夹过滤 */
  collectionId?: ID;
  /** 时间范围 */
  timeRange?: {
    startTime: Timestamp;
    endTime: Timestamp;
  };
  /** 关键词搜索 */
  keyword?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 收藏夹查询条件
 */
export interface CollectionQuery {
  /** 标签过滤 */
  tags?: ID[];
  /** 时间范围 */
  timeRange?: {
    startTime: Timestamp;
    endTime: Timestamp;
  };
  /** 关键词搜索 */
  keyword?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'lastAddedAt';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}
