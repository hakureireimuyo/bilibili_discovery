/**
 * Creator 数据结构定义
 * 定义创作者（UP主/Channel）相关的数据模型
 */

import { Platform, Timestamp, ID, TagSource } from './base.js';

/**
 * 创作者标签权重
 * 记录创作者的标签及其权重信息
 */
export interface CreatorTagWeight {
  /**
   * 标签ID
   */
  tagId: ID;
  /**
   * 标签来源
   * user: 用户手动添加，可编辑，权重固定为0
   * system: 系统添加，根据行为计数器增长
   */
  source: TagSource;
  /**
   * 计数器
   * 用于统计system标签的优先级
   * user标签始终为0
   * system标签随用户行为增长
   */
  count: number;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
}

/**
 * 创作者（UP主/Channel）
 * 描述视频创作者的基本信息
 */
export interface Creator {
  /**
   * 创作者唯一ID
   * 在平台内唯一，结合platform使用
   * bili是数字字符串,youtube是字母字符串,本身具备辨识度,不会混淆
   */
  creatorId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 创作者名称
   */
  name: string;
  /**
   * 头像图片数据
   * 存储头像URL或base64数据
   */
  avatar: string;
  /**
   * 是否已注销
   */
  isLogout: number;
  /**
   * 创作者简介
   */
  description: string;
  /**
   * 记录创建时间
   */
  createdAt: Timestamp;
  /**
   * 关注/订阅时间
   */
  followTime: Timestamp;
  /**
   * 是否关注/订阅
   */
  isFollowing: number;
  /**
   * 标签权重列表
   * 记录当前创作者的标签及每个标签的权重
   */
  tagWeights: CreatorTagWeight[];
}

/**
 * 创作者统计信息
 * 用于分析创作者相关的用户行为数据
 */
export interface CreatorStats {
  /**
   * 创作者ID
   */
  creatorId: ID;
  /**
   * 总观看时长（秒）
   */
  totalWatchTime: number;
  /**
   * 近期观看时长（秒）
   * 默认统计最近30天
   */
  recentWatchTime: number;
  /**
   * 观看视频数
   */
  videoCount: number;
  /**
   * 互动次数
   */
  interactionCount: number;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
}
