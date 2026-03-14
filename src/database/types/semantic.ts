/**
 * Semantic 数据结构定义
 * 定义标签和语义相关的数据模型
 */

import { Timestamp, ID, TagSource } from './base';

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
   * 标签来源
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
  /**
   * 标签颜色
   * 用于UI展示
   */
  color?: string;
  /**
   * 标签图标
   * 用于UI展示
   */
  icon?: string;
}

/**
 * 标签别名映射（TagAlias）
 * 用于标签合并，解决语义相同但名称不同的问题
 * 例如：AI、人工智能、machine learning
 */
export interface TagAlias {
  /**
   * 别名ID
   */
  aliasId: ID;
  /**
   * 别名文本
   * 可以是同义词、缩写等
   */
  alias: string;
  /**
   * 目标标签ID
   * 映射到的标准标签
   */
  targetTagId: ID;
  /**
   * 映射类型
   * rule: 规则映射，用户手动设置
   * embedding: 向量相似度映射
   * auto: 自动映射
   */
  mappingType: 'rule' | 'embedding' | 'auto';
  /**
   * 相似度分数
   * 用于embedding类型的映射
   * 0-1之间的数值
   */
  similarity?: number;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
}

/**
 * 标签向量（TagEmbedding）
 * 用于语义计算和标签相似度计算
 */
export interface TagEmbedding {
  /**
   * 标签ID
   */
  tagId: ID;
  /**
   * 向量数据
   * 浮点数数组
   */
  vector: number[];
  /**
   * 向量维度
   */
  dimension: number;
  /**
   * 模型名称
   * 生成向量的模型
   */
  modelName: string;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
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
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 父分区ID
   * 支持分区层级结构
   */
  parentId?: ID;
  /**
   * 分区颜色
   * 用于UI展示
   */
  color?: string;
  /**
   * 排序权重
   * 用于分区显示排序
   */
  order?: number;
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
