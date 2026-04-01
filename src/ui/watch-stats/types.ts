/**
 * 观看统计页面类型定义
 */

import type { WatchEvent } from '../../database/types/behavior.js';

/**
 * 观看统计数据
 */
export interface WatchStatsData {
  /** 总观看时长（秒） */
  totalSeconds: number;
  /** 每日观看时长映射（日期 -> 秒数） */
  dailySeconds: Record<string, number>;
  /** UP主观看时长映射（UP主ID -> 秒数） */
  upSeconds: Record<string, number>;
  /** 视频观看时长映射（视频ID -> 秒数） */
  videoSeconds: Record<string, number>;
  /** 最后更新时间戳 */
  lastUpdate: number;
}

/**
 * UP主信息
 */
export interface UPInfo {
  /** UP主ID */
  mid: number;
  /** UP主名称 */
  name: string;
  /** 头像URL */
  face: string;
}

/**
 * 视频信息
 */
export interface VideoInfo {
  /** 视频ID (BV号) */
  bvid: string;
  /** 视频标题 */
  title: string;
  /** 视频时长（秒） */
  duration: number;
}

/**
 * UP主统计数据
 */
export interface UPStat {
  /** UP主ID */
  mid: number;
  /** 总观看时长（秒） */
  totalWatchDuration: number;
  /** 总观看视频次数 */
  totalWatchCount: number;
  /** 点赞次数 */
  likeCount: number;
  /** 投币次数 */
  coinCount: number;
  /** 收藏次数 */
  favoriteCount: number;
  /** 评论次数 */
  commentCount: number;
  /** 上次观看时间 */
  lastWatchTime: number;
  /** 互动率 */
  interactionRate?: number;
  /** 平均观看时长（秒） */
  avgWatchDuration?: number;
  /** UP主信息 */
  info?: UPInfo;
}

/**
 * 视频统计数据
 */
export interface VideoStat {
  /** 视频ID (BV号) */
  bvid: string;
  /** 观看时长（秒） */
  seconds: number;
  /** 视频信息 */
  info?: VideoInfo;
}
