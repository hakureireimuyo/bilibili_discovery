/**
 * Analytics 数据结构定义
 * 定义兴趣分析和用户行为分析相关的数据模型
 */

import { Timestamp, ID } from './base';

/**
 * 兴趣分数（InterestScore）
 * 记录用户对不同标签的兴趣权重
 */
export interface InterestScore {
  /**
   * 标签ID
   */
  tagId: ID;
  /**
   * 综合兴趣分数
   */
  score: number;
  /**
   * 短期兴趣分数
   * 基于近期行为计算
   */
  shortTermScore: number;
  /**
   * 长期兴趣分数
   * 基于历史行为计算
   */
  longTermScore: number;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
  /**
   * 分数趋势
   * 1: 上升, 0: 平稳, -1: 下降
   */
  trend?: number;
}

/**
 * 兴趣节点（InterestNode）
 * 用于构建兴趣星球图
 */
export interface InterestNode {
  /**
   * 节点ID
   */
  nodeId: ID;
  /**
   * 父节点ID
   * 用于构建层级结构
   */
  parentId?: ID;
  /**
   * 节点名称
   */
  name: string;
  /**
   * 节点权重
   * 表示用户对该兴趣领域的兴趣程度
   */
  weight: number;
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
   * 节点颜色
   * 用于可视化展示
   */
  color?: string;
  /**
   * 节点图标
   * 用于可视化展示
   */
  icon?: string;
}

/**
 * 兴趣历史记录（InterestHistory）
 * 记录兴趣随时间的变化
 */
export interface InterestHistory {
  /**
   * 记录ID
   */
  recordId: ID;
  /**
   * 标签ID
   */
  tagId: ID;
  /**
   * 记录时间
   */
  timestamp: Timestamp;
  /**
   * 当时的兴趣分数
   */
  score: number;
  /**
   * 短期兴趣分数
   */
  shortTermScore: number;
  /**
   * 长期兴趣分数
   */
  longTermScore: number;
}

/**
 * 创作者排名（CreatorRank）
 * 记录用户对创作者的偏好排名
 */
export interface CreatorRank {
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
   * 综合评分
   * 基于观看时长、互动行为等计算
   */
  score: number;
  /**
   * 排名
   */
  rank: number;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
  /**
   * 互动次数
   */
  interactionCount: number;
  /**
   * 观看视频数
   */
  videoCount: number;
}

/**
 * 观看时间统计（WatchTimeStats）
 * 统计用户在不同时间段的观看习惯
 */
export interface WatchTimeStats {
  /**
   * 统计ID
   */
  statsId: ID;
  /**
   * 小时（0-23）
   */
  hour: number;
  /**
   * 观看次数
   */
  watchCount: number;
  /**
   * 总观看时长（秒）
   */
  totalWatchTime: number;
  /**
   * 工作日/周末标记
   * weekday: 工作日
   * weekend: 周末
   */
  dayType: 'weekday' | 'weekend';
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
}

/**
 * 观看时间分布（WatchTimeDistribution）
 * 按天统计的观看时间分布
 */
export interface WatchTimeDistribution {
  /**
   * 日期
   */
  date: string;
  /**
   * 总观看次数
   */
  totalWatchCount: number;
  /**
   * 总观看时长（秒）
   */
  totalWatchTime: number;
  /**
   * 每小时观看统计
   */
  hourlyStats: {
    hour: number;
    count: number;
    duration: number;
  }[];
  /**
   * 创建时间
   */
  createdAt: Timestamp;
}

/**
 * 用户兴趣画像（UserInterestProfile）
 * 综合的用户兴趣模型
 */
export interface UserInterestProfile {
  /**
   * 画像ID
   */
  profileId: ID;
  /**
   * 创建时间
   */
  createdAt: Timestamp;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
  /**
   * 主要兴趣标签
   * Top N兴趣标签
   */
  topInterests: {
    tagId: ID;
    score: number;
  }[];
  /**
   * 兴趣分布
   * 按大分区统计的兴趣分布
   */
  interestDistribution: {
    categoryId: ID;
    score: number;
  }[];
  /**
   * 兴趣变化趋势
   */
  interestTrend: 'rising' | 'stable' | 'declining';
  /**
   * 活跃度
   * 基于近期行为统计
   */
  activityLevel: number;
}
