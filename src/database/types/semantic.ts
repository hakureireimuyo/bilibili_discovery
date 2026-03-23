/**
 * Semantic 数据结构定义
 * 定义标签和语义相关的数据模型
 */

import { Timestamp, ID, TagSource } from './base.js';

/**
 * 标签（Tag）
 * 统一的标签库，用于视频分类和兴趣分析
 */
export interface Tag {
  /**
   * 标签唯一ID
   */
  tagId: ID;
  /**
   * 标签名称
   */
  name: string;
  /**
   * 标签来源,用户添加的标签可以编辑,系统添加的标签不可以编辑
   */
  source: TagSource;
  /**
   * 标签描述
   */
  description?: string;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
}

/**
 * 标签分区（Category）
 * 大分区，用于实现标签聚合和过滤
 * 可以通过大分区实现标签内的tag互相做或运算
 */
export interface Category {
  /**
   * 分区ID
   */
  id: ID;
  /**
   * 分区名称
   */
  name: string;
  /**
   * 包含的标签ID列表
   */
  tagIds: ID[];
  /**
   * 分区描述
   */
  description?: string;
}

/**
 * 标签统计信息
 */
export interface TagStats {
  /**
   * 标签ID
   */
  tagId: ID;
  /**
   * 关联的视频数量
   */
  videoCount: number;
  /**
   * 关联的创作者数量
   */
  creatorCount: number;
  /**
   * 关联的笔记数量
   */
  noteCount: number;
  /**
   * 总观看次数
   */
  totalWatchCount: number;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
}
