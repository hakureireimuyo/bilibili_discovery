/**
 * 查询层类型定义
 * 定义所有查询相关的类型和接口
 */

import type { Platform } from '../database/types/base.js';

/**
 * 查询参数
 */
export interface QueryParams {
  /** 页码 */
  page?: number;
  /** 每页大小 */
  pageSize?: number;
  /** 排序条件 */
  sort?: SortCondition[];
  /** 搜索关键词 */
  keyword?: string;
  /** 其他自定义参数 */
  [key: string]: any;
}

/**
 * 标签逻辑操作符
 */
export enum TagLogicalOperator {
  /** 与：必须包含所有指定标签 */
  AND = "and",
  /** 或：至少包含其中一个标签 */
  OR = "or",
  /** 非：不包含指定标签 */
  NOT = "not"
}

/**
 * 标签逻辑表达式
 * 支持从左到右依次执行的简单表达式
 */
export interface TagExpression {
  /** 操作符 */
  operator: TagLogicalOperator;
  /** 标签ID列表（对于OR操作符，表示标签集合） */
  tagIds: string[];
}

/**
 * 排序条件
 */
export interface SortCondition {
  /** 字段名 */
  field: string;
  /** 排序方向 */
  direction: "asc" | "desc";
}

/**
 * 查询结果
 */
export interface QueryResult<T> {
  /** 数据列表 */
  data: T[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页大小 */
  pageSize: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  /** 是否使用缓存 */
  useCache?: boolean;
  /** 是否预加载 */
  preload?: boolean;
  /** 预加载数量 */
  preloadCount?: number;
  /** 超时时间(毫秒) */
  timeout?: number;
}

/**
 * 视频索引信息
 * 用于缓存视频的关键信息，支持快速搜索和过滤
 */
export interface VideoIndex {
  /** 视频ID */
  videoId: string;
  /** 视频标题 */
  title: string;
  /** 创作者ID */
  creatorId: string;
  /** 创作者名称 */
  creatorName: string;
  /** 标签ID列表 */
  tags: string[];
  /** 收藏夹ID列表 */
  collectionIds: string[];
  /** 创建时间 */
  createdAt: number;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 匹配的视频ID列表 */
  videoIds: string[];
  /** 总数 */
  total: number;
}

/**
 * 预取配置
 */
export interface PrefetchConfig {
  /** 是否启用预取 */
  enabled: boolean;
  /** 预取的页数 */
  prefetchPages: number;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 视频索引数量 */
  videoIndexCount: number;
  /** 标签缓存数量 */
  tagCacheCount: number;
  /** 封面缓存数量 */
  coverCacheCount: number;
  /** 封面缓存大小(字节) */
  coverCacheSize: number;
}

/**
 * 视频查询参数
 */
export interface VideoQueryParams extends QueryParams {
  /** 收藏夹ID */
  collectionId?: string;
  /** 收藏夹类型 */
  collectionType?: 'user' | 'subscription';
  /** 包含的标签 */
  includeTags?: string[];
  /** 排除的标签 */
  excludeTags?: string[];
}

/**
 * 创作者查询参数
 */
export interface CreatorQueryParams extends QueryParams {
  /** 平台 */
  platform: Platform;
  /** 是否关注 */
  isFollowing?: boolean;
  /** 包含的分类 */
  includeCategories?: string[];
  /** 排除的分类 */
  excludeCategories?: string[];
  /** 标签逻辑表达式数组（从左到右依次执行） */
  tagExpressions?: TagExpression[];
}

/**
 * 标签查询参数
 */
export interface TagQueryParams extends QueryParams {
  /** 标签来源 */
  source?: 'user' | 'system';
}

/**
 * 分类查询参数
 */
export interface CategoryQueryParams extends QueryParams {
  /** 标签ID */
  tagId?: string;
}

/**
 * 统计数据
 */
export interface StatsData {
  followedCount: number;
  unfollowedCount: number;
  totalCreators: number;
  totalTags: number;
}

/**
 * 标签使用计数
 */
export type TagUsageMap = Map<string, number>;

/**
 * 查询错误类
 */
export class QueryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "QueryError";
  }
}
