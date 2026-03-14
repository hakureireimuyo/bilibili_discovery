/**
 * WatchEvent Repository 接口规范
 * 定义观看事件相关的数据库操作接口
 */

import { WatchEvent, BehaviorSummary } from '../../types/behavior';
import { Platform, PaginationParams, PaginationResult, TimeRange } from '../../types/base';

/**
 * WatchEvent 数据库接口
 * 职责：管理观看事件数据的增删改查
 */
export interface IWatchEventRepository {
  /**
   * 记录观看事件
   * 
   * @param event - 观看事件
   * @returns Promise<void>
   * 
   * 职责：
   * - 保存观看事件
   * - 自动设置eventId和timestamp
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不更新统计数据
   * - 不验证视频或创作者是否存在
   */
  recordWatchEvent(event: Omit<WatchEvent, 'eventId'>): Promise<void>;

  /**
   * 批量记录观看事件
   * 
   * @param events - 观看事件列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量保存观看事件
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  recordWatchEvents(events: Omit<WatchEvent, 'eventId'>[]): Promise<void>;

  /**
   * 获取观看事件
   * 
   * @param eventId - 事件ID
   * @returns Promise<WatchEvent | null> - 观看事件，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询观看事件
   * - 返回完整的事件信息
   * 
   * 能力边界：
   * - 仅返回单个事件
   */
  getWatchEvent(eventId: string): Promise<WatchEvent | null>;

  /**
   * 获取视频的观看记录
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<WatchEvent>> - 观看记录列表
   * 
   * 职责：
   * - 查询指定视频的所有观看记录
   * - 按watchTime降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含统计数据
   * - 不包含互动记录
   */
  getVideoWatchEvents(videoId: string, platform: Platform, pagination: PaginationParams): Promise<PaginationResult<WatchEvent>>;

  /**
   * 获取创作者的观看记录
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<WatchEvent>> - 观看记录列表
   * 
   * 职责：
   * - 查询指定创作者的所有观看记录
   * - 按watchTime降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含统计数据
   * - 不包含互动记录
   */
  getCreatorWatchEvents(creatorId: string, platform: Platform, pagination: PaginationParams): Promise<PaginationResult<WatchEvent>>;

  /**
   * 按时间范围获取观看记录
   * 
   * @param timeRange - 时间范围
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<WatchEvent>> - 观看记录列表
   * 
   * 职责：
   * - 查询指定时间范围内的观看记录
   * - 按watchTime降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 时间范围不超过1年
   * - 不包含统计数据
   */
  getWatchEventsByTimeRange(timeRange: TimeRange, platform: Platform, pagination: PaginationParams): Promise<PaginationResult<WatchEvent>>;

  /**
   * 获取观看统计汇总
   * 
   * @param timeRange - 时间范围
   * @param platform - 平台类型
   * @returns Promise<BehaviorSummary> - 统计汇总
   * 
   * 职责：
   * - 计算指定时间范围内的观看统计
   * - 返回汇总数据
   * 
   * 能力边界：
   * - 时间范围不超过1年
   * - 不返回详细记录
   */
  getWatchSummary(timeRange: TimeRange, platform: Platform): Promise<BehaviorSummary>;
}
