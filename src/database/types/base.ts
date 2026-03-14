/**
 * 基础类型定义
 * 定义系统中通用的基础类型
 */

/**
 * 平台类型
 * 用于区分不同视频平台
 */
export enum Platform {
  BILIBILI = 'bilibili',
  YOUTUBE = 'youtube'
}

/**
 * 标签来源类型
 * user: 用户手动添加的标签，可编辑
 * system: 系统自动添加的标签，带有计数器
 */
export enum TagSource {
  USER = 'user',
  SYSTEM = 'system'
}

/**
 * 视频来源类型
 * 记录用户从哪个入口进入观看视频
 */
export enum VideoSource {
  RECOMMEND = 'recommend',
  SEARCH = 'search',
  FOLLOW = 'follow',
  HOT = 'hot',
  COLLECTION = 'collection',
  DIRECT = 'direct',
  OTHER = 'other'
}

/**
 * 互动行为类型
 */
export enum InteractionType {
  LIKE = 'like',
  COMMENT = 'comment',
  FAVORITE = 'favorite',
  SHARE = 'share'
}

/**
 * 笔记类型
 */
export enum NoteType {
  SUMMARY = 'summary',
  MANUAL = 'manual',
  QA = 'qa'
}

/**
 * 时间戳类型
 * 使用毫秒级时间戳
 */
export type Timestamp = number;

/**
 * ID类型
 * 用于标识唯一实体
 */
export type ID = string;

/**
 * 分页参数
 */
export interface PaginationParams {
  /**
   * 页码，从0开始
   */
  page: number;
  /**
   * 每页数量
   */
  pageSize: number;
}

/**
 * 分页结果
 */
export interface PaginationResult<T> {
  /**
   * 数据列表
   */
  items: T[];
  /**
   * 总数量
   */
  total: number;
  /**
   * 当前页码
   */
  page: number;
  /**
   * 每页数量
   */
  pageSize: number;
  /**
   * 总页数
   */
  totalPages: number;
}

/**
 * 时间范围参数
 */
export interface TimeRange {
  /**
   * 开始时间
   */
  startTime: Timestamp;
  /**
   * 结束时间
   */
  endTime: Timestamp;
}
