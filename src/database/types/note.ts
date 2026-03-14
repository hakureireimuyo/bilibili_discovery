/**
 * Note 数据结构定义
 * 定义视频笔记和知识管理相关的数据模型
 */

import { Platform, Timestamp, ID, NoteType } from './base';

/**
 * 视频笔记（VideoNote）
 * 支持AI总结、用户笔记、问答等内容
 */
export interface VideoNote {
  /**
   * 笔记唯一ID
   */
  noteId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 视频ID
   */
  videoId: ID;
  /**
   * 笔记类型
   */
  type: NoteType;
  /**
   * 笔记内容
   * 可以是文本、JSON等格式
   */
  content: string;
  /**
   * 内容向量
   * 用于语义搜索
   */
  embedding?: number[];
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
  /**
   * 笔记标题
   */
  title?: string;
  /**
   * 关联的标签ID列表
   */
  tagIds?: ID[];
  /**
   * 是否公开
   */
  isPublic?: number;
  /**
   * 笔记元数据
   * 存储额外的笔记信息
   */
  metadata?: Record<string, any>;
}

/**
 * 笔记分段（NoteSegment）
 * 用于长笔记的分段管理
 */
export interface NoteSegment {
  /**
   * 分段ID
   */
  segmentId: ID;
  /**
   * 笔记ID
   */
  noteId: ID;
  /**
   * 分段内容
   */
  content: string;
  /**
   * 分段向量
   */
  embedding?: number[];
  /**
   * 视频时间戳（秒）
   * 如果笔记与视频特定时间点相关
   */
  videoTimestamp?: number;
  /**
   * 分段顺序
   */
  order: number;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
}

/**
 * 笔记关联（NoteRelation）
 * 用于建立笔记之间的关联关系
 */
export interface NoteRelation {
  /**
   * 关联ID
   */
  relationId: ID;
  /**
   * 源笔记ID
   */
  sourceNoteId: ID;
  /**
   * 目标笔记ID
   */
  targetNoteId: ID;
  /**
   * 关联类型
   * 例如：引用、补充、相关等
   */
  relationType: string;
  /**
   * 关联描述
   */
  description?: string;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
}

/**
 * 知识条目（KnowledgeEntry）
 * 从笔记中提取的知识点
 */
export interface KnowledgeEntry {
  /**
   * 知识条目ID
   */
  entryId: ID;
  /**
   * 笔记ID
   */
  noteId: ID;
  /**
   * 知识标题
   */
  title: string;
  /**
   * 知识内容
   */
  content: string;
  /**
   * 知识向量
   */
  embedding?: number[];
  /**
   * 关联的标签ID列表
   */
  tagIds: ID[];
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
  /**
   * 知识类型
   */
  type?: string;
}
