/**
 * Video 数据结构定义
 * 定义视频相关的数据模型
 */

import { Platform, Timestamp, ID } from './base';

/**
 * 视频基础信息
 * 记录视频的元数据，不缓存完整视频内容
 */
export interface Video {
  /**
   * 视频唯一ID
   * 在平台内唯一，结合platform使用
   */
  videoId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 创作者ID
   */
  creatorId: ID;
  /**
   * 视频标题
   */
  title: string;
  /**
   * 视频描述
   */
  description: string;
  /**
   * 视频时长（秒）
   */
  duration: number;
  /**
   * 视频发布时间
   */
  publishTime: Timestamp;
  /**
   * 视频标签列表
   * 存储标签ID
   */
  tags: ID[];
  /**
   * 记录创建时间
   */
  createdAt: Timestamp;
  /**
   * 封面图片URL
   */
  coverUrl?: string;
  /**
   * 视频URL
   */
  videoUrl?: string;
}

/**
 * 视频统计信息
 * 用于分析视频相关的用户行为数据
 */
export interface VideoStats {
  /**
   * 视频ID
   */
  videoId: ID;
  /**
   * 总观看次数
   */
  totalWatchCount: number;
  /**
   * 总观看时长（秒）
   */
  totalWatchTime: number;
  /**
   * 平均观看进度
   * 0-1之间的数值
   */
  averageProgress: number;
  /**
   * 完整观看次数
   * 观看进度超过90%的次数
   */
  completeWatchCount: number;
  /**
   * 互动次数
   */
  interactionCount: number;
  /**
   * 最后观看时间
   */
  lastWatchTime: Timestamp;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
}

/**
 * 视频热度信息
 * 用于推荐系统
 */
export interface VideoHotness {
  /**
   * 视频ID
   */
  videoId: ID;
  /**
   * 平台热度分数
   * 来自平台官方的热度数据
   */
  platformHotness: number;
  /**
   * 用户热度分数
   * 基于用户行为计算的热度
   */
  userHotness: number;
  /**
   * 综合热度分数
   * 综合平台热度和用户热度
   */
  combinedHotness: number;
  /**
   * 热度趋势
   * 1: 上升, 0: 平稳, -1: 下降
   */
  trend: number;
  /**
   * 最后更新时间
   */
  lastUpdate: Timestamp;
}
