/**
 * Video Stats Repository 接口规范
 * 定义视频统计和热度相关的数据库操作接口
 */

import { VideoStats, VideoHotness } from '../../types/video';
import { Platform } from '../../types/base';

/**
 * Video Stats 数据库接口
 * 职责：管理视频统计数据
 */
export interface IVideoStatsRepository {
  /**
   * 获取视频统计信息
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @returns Promise<VideoStats | null> - 统计信息，不存在则返回null
   * 
   * 职责：
   * - 返回视频的统计数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 仅返回统计数据
   * - 不包含视频基本信息
   */
  getVideoStats(videoId: string, platform: Platform): Promise<VideoStats | null>;

  /**
   * 获取多个视频的统计信息
   * 
   * @param videoIds - 视频ID列表
   * @param platform - 平台类型
   * @returns Promise<VideoStats[]> - 统计信息列表
   * 
   * 职责：
   * - 批量获取视频统计数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 最多查询100个视频
   * - 不保证返回顺序与输入顺序一致
   */
  getVideosStats(videoIds: string[], platform: Platform): Promise<VideoStats[]>;

  /**
   * 更新视频统计信息
   * 
   * @param stats - 统计信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新或创建视频统计记录
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证视频是否存在
   * - 不触发相关更新
   */
  updateVideoStats(stats: Omit<VideoStats, 'lastUpdate'>): Promise<void>;

  /**
   * 批量更新视频统计信息
   * 
   * @param statsList - 统计信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量更新视频统计
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  updateVideoStatsBatch(statsList: Omit<VideoStats, 'lastUpdate'>[]): Promise<void>;

  /**
   * 删除视频统计信息
   * 
   * @param videoId - 视频ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除视频统计记录
   * 
   * 能力边界：
   * - 不删除视频本身
   */
  deleteVideoStats(videoId: string): Promise<void>;
}

/**
 * Video Hotness 数据库接口
 * 职责：管理视频热度数据
 */
export interface IVideoHotnessRepository {
  /**
   * 获取视频热度信息
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @returns Promise<VideoHotness | null> - 热度信息，不存在则返回null
   * 
   * 职责：
   * - 返回视频的热度数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 仅返回热度数据
   * - 不包含视频基本信息
   */
  getVideoHotness(videoId: string, platform: Platform): Promise<VideoHotness | null>;

  /**
   * 获取多个视频的热度信息
   * 
   * @param videoIds - 视频ID列表
   * @param platform - 平台类型
   * @returns Promise<VideoHotness[]> - 热度信息列表
   * 
   * 职责：
   * - 批量获取视频热度数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 最多查询100个视频
   * - 不保证返回顺序与输入顺序一致
   */
  getVideosHotness(videoIds: string[], platform: Platform): Promise<VideoHotness[]>;

  /**
   * 更新视频热度信息
   * 
   * @param hotness - 热度信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新或创建视频热度记录
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证视频是否存在
   * - 不触发相关更新
   */
  updateVideoHotness(hotness: Omit<VideoHotness, 'lastUpdate'>): Promise<void>;

  /**
   * 批量更新视频热度信息
   * 
   * @param hotnessList - 热度信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量更新视频热度
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  updateVideoHotnessBatch(hotnessList: Omit<VideoHotness, 'lastUpdate'>[]): Promise<void>;

  /**
   * 获取热门视频
   * 
   * @param platform - 平台类型
   * @param limit - 返回数量限制
   * @returns Promise<Video[]> - 热门视频列表
   * 
   * 职责：
   * - 按综合热度排序
   * - 返回热门视频
   * 
   * 能力边界：
   * - 最多返回100个视频
   * - 不支持分页
   */
  getHotVideos(platform: Platform, limit?: number): Promise<Video[]>;

  /**
   * 删除视频热度信息
   * 
   * @param videoId - 视频ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除视频热度记录
   * 
   * 能力边界：
   * - 不删除视频本身
   */
  deleteVideoHotness(videoId: string): Promise<void>;
}
