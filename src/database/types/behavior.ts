/**
 * Behavior 数据结构定义
 * 定义用户行为相关的数据模型，包括观看、互动、搜索等行为
 */

import { Platform, Timestamp, ID, VideoSource, InteractionType } from './base';

/**
 * 观看事件
 * 记录用户每一次观看视频的行为
 */
export interface WatchEvent {
  /**
   * 事件唯一ID
   */
  eventId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 视频ID
   */
  videoId: ID;
  /**
   * 创作者ID
   */
  creatorId: ID;
  /**
   * 观看开始时间
   */
  watchTime: Timestamp;
  /**
   * 实际观看时长（秒）
   */
  watchDuration: number;
  /**
   * 视频总时长（秒）
   */
  videoDuration: number;
  /**
   * 观看进度
   * 0-无穷之间的数值，表示观看视频的比例,视频可以观看任意多次
   */
  progress: number;
  /**
   * 视频来源
   * 记录用户从哪个入口进入观看
   */
  source: VideoSource;
  /**
   * 是否完整观看
   * 观看进度超过90%视为完整观看
   */
  isComplete: number;
  /**
   * 最近一次观看结束时间
   */
  endTime: Timestamp;
}

/**
 * 互动事件
 * 记录用户与视频的互动行为
 */
export interface InteractionEvent {
  /**
   * 事件唯一ID
   */
  eventId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 视频ID
   */
  videoId: ID;
  /**
   * 创作者ID
   */
  creatorId: ID;
  /**
   * 互动类型
   */
  type: InteractionType;
  /**
   * 互动时间
   */
  timestamp: Timestamp;
  /**
   * 互动详情
   * 存储互动相关的额外信息
   * 例如：评论内容、分享目标等
   */
  details?: Record<string, any>;
}

/**
 * 搜索事件
 * 记录用户的搜索行为
 */
export interface SearchEvent {
  /**
   * 事件唯一ID
   */
  eventId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 搜索关键词
   */
  query: string;
  /**
   * 搜索时间
   */
  timestamp: Timestamp;
  /**
   * 点击的视频ID
   * 如果用户点击了搜索结果中的视频
   */
  resultClickVideo?: ID;
  /**
   * 搜索结果数量
   */
  resultCount?: number;
  /**
   * 搜索类型
   * 例如：关键词搜索、标签搜索、UP搜索等
   */
  searchType?: string;
}

/**
 * 行为统计汇总
 * 用于统计用户在特定时间段内的行为数据
 */
export interface BehaviorSummary {
  /**
   * 统计时间范围开始
   */
  startTime: Timestamp;
  /**
   * 统计时间范围结束
   */
  endTime: Timestamp;
  /**
   * 总观看次数
   */
  totalWatchCount: number;
  /**
   * 总观看时长（秒）
   */
  totalWatchTime: number;
  /**
   * 总互动次数
   */
  totalInteractionCount: number;
  /**
   * 总搜索次数
   */
  totalSearchCount: number;
  /**
   * 完整观看次数
   */
  completeWatchCount: number;
  /**
   * 观看的UP主数量
   */
  watchedCreatorCount: number;
  /**
   * 观看的视频数量
   */
  watchedVideoCount: number;
}
