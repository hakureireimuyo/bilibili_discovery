/**
 * Video Repository 接口规范
 * 定义视频相关的数据库操作接口
 */

import { Video } from '../../types/video';
import { Platform, PaginationParams, PaginationResult, TimeRange } from '../../types/base';

/**
 * Video 数据库接口
 * 职责：管理视频数据的增删改查
 */
export interface IVideoRepository {
  /**
   * 创建或更新视频信息
   * 
   * @param video - 视频信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 如果videoId已存在则更新，否则创建新记录
   * - 自动设置createdAt和lastUpdate时间
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不处理视频的统计数据
   * - 不处理视频的观看记录
   * - 不缓存完整视频内容
   */
  upsertVideo(video: Video): Promise<void>;

  /**
   * 批量创建或更新视频信息
   * 
   * @param videos - 视频信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量处理视频数据
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  upsertVideos(videos: Video[]): Promise<void>;

  /**
   * 获取视频信息
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @returns Promise<Video | null> - 视频信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID和平台查询视频
   * - 返回完整的视频信息
   * 
   * 能力边界：
   * - 仅返回单个视频
   * - 不包含统计数据
   */
  getVideo(videoId: string, platform: Platform): Promise<Video | null>;

  /**
   * 获取多个视频信息
   * 
   * @param videoIds - 视频ID列表
   * @param platform - 平台类型
   * @returns Promise<Video[]> - 视频信息列表
   * 
   * 职责：
   * - 批量查询视频
   * - 返回存在的视频信息
   * 
   * 能力边界：
   * - 最多查询100个视频
   * - 不保证返回顺序与输入顺序一致
   */
  getVideos(videoIds: string[], platform: Platform): Promise<Video[]>;

  /**
   * 获取创作者的视频列表
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<Video>> - 视频列表
   * 
   * 职责：
   * - 查询指定创作者的视频
   * - 按publishTime降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 仅返回视频基本信息
   * - 不包含统计数据
   */
  getCreatorVideos(
    creatorId: string,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>>;

  /**
   * 按标签查询视频
   * 
   * @param tagIds - 标签ID列表
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<Video>> - 视频列表
   * 
   * 职责：
   * - 查询包含任一标签的视频
   * - 按publishTime降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 最多查询10个标签
   * - 仅返回视频基本信息
   */
  getVideosByTags(
    tagIds: string[],
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>>;

  /**
   * 按时间范围查询视频
   * 
   * @param timeRange - 时间范围
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<Video>> - 视频列表
   * 
   * 职责：
   * - 查询指定时间范围内发布的视频
   * - 按publishTime降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 时间范围不超过1年
   * - 仅返回视频基本信息
   */
  getVideosByTimeRange(
    timeRange: TimeRange,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>>;

  /**
   * 搜索视频
   * 
   * @param platform - 平台类型
   * @param keyword - 搜索关键词
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<Video>> - 搜索结果
   * 
   * 职责：
   * - 搜索标题和描述
   * - 支持模糊匹配
   * - 返回分页结果
   * 
   * 能力边界：
   * - 仅搜索title和description字段
   * - 不支持复杂查询条件
   */
  searchVideos(
    platform: Platform,
    keyword: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>>;

  /**
   * 删除视频
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除视频记录
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除视频的观看记录
   * - 不删除视频的笔记
   */
  deleteVideo(videoId: string, platform: Platform): Promise<void>;

  /**
   * 更新视频标签
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @param tags - 标签ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新视频的标签列表
   * - 替换而非合并
   * 
   * 能力边界：
   * - 不验证标签是否存在
   * - 不触发相关统计更新
   */
  updateVideoTags(videoId: string, platform: Platform, tags: string[]): Promise<void>;
}
