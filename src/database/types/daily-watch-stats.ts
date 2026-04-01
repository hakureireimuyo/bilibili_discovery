/**
 * 每日观看统计数据结构定义
 * 定义每日观看统计相关的数据模型
 * 用于避免每次查询时进行聚合运算
 */

import { Platform, Timestamp, ID } from './base.js';

/**
 * 每日观看统计
 * 记录用户每天的观看统计数据
 */
export interface DailyWatchStats {
  /**
   * 统计记录唯一ID
   */
  statsId: ID;
  /**
   * 平台类型
   */
  platform: Platform;
  /**
   * 日期键，格式为 YYYY-MM-DD
   */
  dateKey: string;
  /**
   * 当日观看总时长（秒）
   */
  totalWatchDuration: number;
  /**
   * 当日观看视频次数
   */
  totalWatchCount: number;
  /**
   * 当日观看的UP主数量
   */
  uniqueCreatorsCount: number;
  /**
   * 当日观看的视频数量
   */
  uniqueVideosCount: number;
  /**
   * 当日完整观看的视频数量
   */
  completeWatchCount: number;
  /**
   * 最后更新时间
   */
  updateTime: Timestamp;
}


