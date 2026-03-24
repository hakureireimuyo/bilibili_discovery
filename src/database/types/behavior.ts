/**
 * Behavior 数据结构定义
 * 定义用户行为相关的数据模型，包括观看、互动、搜索等行为
 */

import { Platform, Timestamp, ID, VideoSource, InteractionType } from './base.js';

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
   * 是否完整观看
   * 观看进度超过90%视为完整观看
   */
  isComplete: number;
  /**
   * 最近一次观看结束时间
   */
  endTime: Timestamp;
}
