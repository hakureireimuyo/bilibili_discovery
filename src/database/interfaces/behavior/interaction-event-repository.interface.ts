/**
 * InteractionEvent Repository 接口规范
 * 定义互动事件相关的数据库操作接口
 */

import { InteractionEvent } from '../../types/behavior';
import { Platform, PaginationParams, PaginationResult, TimeRange } from '../../types/base';

/**
 * InteractionEvent 数据库接口
 * 职责：管理互动事件数据的增删改查
 */
export interface IInteractionEventRepository {
  /**
   * 记录互动事件
   * 
   * @param event - 互动事件
   * @returns Promise<void>
   * 
   * 职责：
   * - 保存互动事件
   * - 自动设置eventId和timestamp
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不更新统计数据
   * - 不验证视频或创作者是否存在
   */
  recordInteractionEvent(event: Omit<InteractionEvent, 'eventId'>): Promise<void>;

  /**
   * 批量记录互动事件
   * 
   * @param events - 互动事件列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量保存互动事件
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  recordInteractionEvents(events: Omit<InteractionEvent, 'eventId'>[]): Promise<void>;

  /**
   * 获取互动事件
   * 
   * @param eventId - 事件ID
   * @returns Promise<InteractionEvent | null> - 互动事件，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询互动事件
   * - 返回完整的事件信息
   * 
   * 能力边界：
   * - 仅返回单个事件
   */
  getInteractionEvent(eventId: string): Promise<InteractionEvent | null>;

  /**
   * 获取视频的互动记录
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @param type - 互动类型（可选）
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<InteractionEvent>> - 互动记录列表
   * 
   * 职责：
   * - 查询指定视频的互动记录
   * - 支持按类型过滤
   * - 按timestamp降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含观看记录
   */
  getVideoInteractionEvents(
    videoId: string,
    platform: Platform,
    type?: InteractionEvent['type'],
    pagination?: PaginationParams
  ): Promise<PaginationResult<InteractionEvent>>;

  /**
   * 获取创作者的互动记录
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @param type - 互动类型（可选）
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<InteractionEvent>> - 互动记录列表
   * 
   * 职责：
   * - 查询指定创作者的互动记录
   * - 支持按类型过滤
   * - 按timestamp降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含观看记录
   */
  getCreatorInteractionEvents(
    creatorId: string,
    platform: Platform,
    type?: InteractionEvent['type'],
    pagination?: PaginationParams
  ): Promise<PaginationResult<InteractionEvent>>;

  /**
   * 按时间范围获取互动记录
   * 
   * @param timeRange - 时间范围
   * @param platform - 平台类型
   * @param type - 互动类型（可选）
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<InteractionEvent>> - 互动记录列表
   * 
   * 职责：
   * - 查询指定时间范围内的互动记录
   * - 支持按类型过滤
   * - 按timestamp降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 时间范围不超过1年
   */
  getInteractionEventsByTimeRange(
    timeRange: TimeRange,
    platform: Platform,
    type?: InteractionEvent['type'],
    pagination?: PaginationParams
  ): Promise<PaginationResult<InteractionEvent>>;

  /**
   * 统计互动次数
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @param type - 互动类型（可选）
   * @returns Promise<number> - 互动次数
   * 
   * 职责：
   * - 统计指定视频的互动次数
   * - 支持按类型过滤
   * 
   * 能力边界：
   * - 仅返回计数
   */
  countInteractions(videoId: string, platform: Platform, type?: InteractionEvent['type']): Promise<number>;

  /**
   * 统计创作者互动次数
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @param timeRange - 时间范围（可选）
   * @returns Promise<number> - 互动次数
   * 
   * 职责：
   * - 统计指定创作者的互动次数
   * - 支持按时间范围过滤
   * 
   * 能力边界：
   * - 仅返回计数
   */
  countCreatorInteractions(
    creatorId: string,
    platform: Platform,
    timeRange?: TimeRange
  ): Promise<number>;
}
