/**
 * UP主交互数据结构定义
 * 定义用户与UP主的交互相关数据模型
 */

import { Platform, Timestamp, ID } from './base.js';

/**
 * 用户与UP主的交互统计
 * 记录用户对某个UP主的综合互动数据
 */
export interface UPInteraction {
  /**
   * 交互记录唯一ID
   */
  interactionId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * UP主ID
   */
  creatorId: ID;
  /**
   * 总观看时长（秒）
   */
  totalWatchDuration: number;
  /**
   * 总观看视频次数
   */
  totalWatchCount: number;
  /**
   * 点赞次数
   */
  likeCount: number;
  /**
   * 投币次数
   */
  coinCount: number;
  /**
   * 收藏次数
   */
  favoriteCount: number;
  /**
   * 评论次数
   */
  commentCount: number;
  /**
   * 上次观看该UP视频的时间
   */
  lastWatchTime: Timestamp;
  /**
   * 首次观看该UP视频的时间
   */
  firstWatchTime: Timestamp;
  /**
   * 最后更新时间
   */
  updateTime: Timestamp;
}

/**
 * UP主交互更新参数
 * 用于增量更新UP主交互数据
 */
export interface UPInteractionUpdate {
  /**
   * UP主ID
   */
  creatorId: ID;
  /**
   * 观看时长增量（秒）
   */
  watchDurationDelta?: number;
  /**
   * 观看次数增量
   */
  watchCountDelta?: number;
  /**
   * 点赞次数增量
   */
  likeDelta?: number;
  /**
   * 投币次数增量
   */
  coinDelta?: number;
  /**
   * 收藏次数增量
   */
  favoriteDelta?: number;
  /**
   * 评论次数增量
   */
  commentDelta?: number;
  /**
   * 更新观看时间
   */
  watchTime?: Timestamp;
}

/**
 * UP主统计数据
 * 用于UI展示的UP主统计信息
 */
export interface UPStatSummary {
  /**
   * UP主ID
   */
  creatorId: ID;
  /**
   * 总观看时长（秒）
   */
  totalWatchDuration: number;
  /**
   * 总观看视频次数
   */
  totalWatchCount: number;
  /**
   * 点赞次数
   */
  likeCount: number;
  /**
   * 投币次数
   */
  coinCount: number;
  /**
   * 收藏次数
   */
  favoriteCount: number;
  /**
   * 评论次数
   */
  commentCount: number;
  /**
   * 上次观看时间
   */
  lastWatchTime: Timestamp;
  /**
   * 首次观看时间
   */
  firstWatchTime: Timestamp;
  /**
   * 互动率（点赞+投币+收藏）/观看次数
   */
  interactionRate?: number;
  /**
   * 平均观看时长（秒）
   */
  avgWatchDuration?: number;
}
