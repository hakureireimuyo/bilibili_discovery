/**
 * Collection 数据结构定义
 * 定义视频收藏相关的数据模型
 */

import { Platform, Timestamp, ID } from './base.js';

/**
 * 收藏夹（Collection）
 * 用户创建的视频收藏列表
 */
/**
 * 收藏夹类型
 */
export type CollectionType = 'user' | 'subscription';

/**
 * 收藏夹（Collection）
 * 用户创建的视频收藏列表或订阅的合集
 */
export interface Collection {
  /**
   * 收藏夹唯一ID
   */
  collectionId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 收藏夹名称
   */
  name: string;
  /**
   * 收藏夹描述
   */
  description?: string;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
  /**
   * 是否公开
   */
  isPublic?: boolean;
  /**
   * 排序方式
   * default: 默认排序
   * time: 按收藏时间
   * duration: 按视频时长
   */
  sortOrder?: 'default' | 'time' | 'duration';
  /**
   * 收藏夹标签
   * 用于收藏夹分类
   */
  tags?: ID[];
  /**
   * 收藏夹类型
   * user: 用户自己创建的收藏夹
   * subscription: 订阅的合集（别人创建的）
   */
  type?: CollectionType;
  /**
   * 视频数量
   * 缓存的收藏夹内视频数量，用于快速获取统计信息
   * 需要在添加/删除收藏项时自动维护
   */
  videoCount?: number;
  /**
   * 最后添加时间
   * 缓存的收藏夹内最后添加视频的时间
   * 需要在添加收藏项时自动维护
   */
  lastAddedAt?: number;
}

/**
 * 收藏记录（CollectionItem）
 * 记录视频被添加到收藏夹的详细信息
 */
export interface CollectionItem {
  /**
   * 记录ID
   */
  itemId: ID;
  /**
   * 收藏夹ID
   */
  collectionId: ID;
  /**
   * 视频ID
   */
  videoId: ID;
  /**
   * 添加时间
   */
  addedAt: Timestamp;
  /**
   * 添加备注
   */
  note?: string;
  /**
   * 排序权重
   * 用于自定义排序
   */
  order?: number;
}
