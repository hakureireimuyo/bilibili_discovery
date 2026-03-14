/**
 * SearchEvent Repository 接口规范
 * 定义搜索事件相关的数据库操作接口
 */

import { SearchEvent } from '../../types/behavior';
import { Platform, PaginationParams, PaginationResult, TimeRange } from '../../types/base';

/**
 * SearchEvent 数据库接口
 * 职责：管理搜索事件数据的增删改查
 */
export interface ISearchEventRepository {
  /**
   * 记录搜索事件
   * 
   * @param event - 搜索事件
   * @returns Promise<void>
   * 
   * 职责：
   * - 保存搜索事件
   * - 自动设置eventId和timestamp
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不更新统计数据
   * - 不验证视频是否存在
   */
  recordSearchEvent(event: Omit<SearchEvent, 'eventId'>): Promise<void>;

  /**
   * 批量记录搜索事件
   * 
   * @param events - 搜索事件列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量保存搜索事件
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  recordSearchEvents(events: Omit<SearchEvent, 'eventId'>[]): Promise<void>;

  /**
   * 获取搜索事件
   * 
   * @param eventId - 事件ID
   * @returns Promise<SearchEvent | null> - 搜索事件，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询搜索事件
   * - 返回完整的事件信息
   * 
   * 能力边界：
   * - 仅返回单个事件
   */
  getSearchEvent(eventId: string): Promise<SearchEvent | null>;

  /**
   * 获取搜索历史
   * 
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<SearchEvent>> - 搜索历史列表
   * 
   * 职责：
   * - 查询搜索历史
   * - 按timestamp降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含点击的视频详情
   */
  getSearchHistory(platform: Platform, pagination: PaginationParams): Promise<PaginationResult<SearchEvent>>;

  /**
   * 按时间范围获取搜索记录
   * 
   * @param timeRange - 时间范围
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<SearchEvent>> - 搜索记录列表
   * 
   * 职责：
   * - 查询指定时间范围内的搜索记录
   * - 按timestamp降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 时间范围不超过1年
   */
  getSearchEventsByTimeRange(
    timeRange: TimeRange,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<SearchEvent>>;

  /**
   * 获取热门搜索关键词
   * 
   * @param platform - 平台类型
   * @param timeRange - 时间范围
   * @param limit - 返回数量限制
   * @returns Promise<{query: string, count: number}[]> - 热门搜索关键词列表
   * 
   * 职责：
   * - 统计指定时间范围内的搜索关键词
   * - 按搜索次数排序
   * - 返回热门关键词
   * 
   * 能力边界：
   * - 最多返回100个关键词
   * - 时间范围不超过1年
   */
  getHotSearchQueries(
    platform: Platform,
    timeRange: TimeRange,
    limit?: number
  ): Promise<{query: string, count: number}[]>;

  /**
   * 获取搜索统计
   * 
   * @param platform - 平台类型
   * @param timeRange - 时间范围
   * @returns Promise<{total: number, uniqueQueries: number, avgResults: number}> - 搜索统计
   * 
   * 职责：
   * - 统计指定时间范围内的搜索数据
   * - 返回汇总统计信息
   * 
   * 能力边界：
   * - 时间范围不超过1年
   */
  getSearchStats(
    platform: Platform,
    timeRange: TimeRange
  ): Promise<{
    total: number;
    uniqueQueries: number;
    avgResults: number;
  }>;

  /**
   * 获取搜索建议
   * 
   * @param platform - 平台类型
   * @param prefix - 搜索词前缀
   * @param limit - 返回数量限制
   * @returns Promise<string[]> - 搜索建议列表
   * 
   * 职责：
   * - 根据搜索词前缀提供搜索建议
   * - 按搜索频率排序
   * 
   * 能力边界：
   * - 最多返回20个建议
   * - 基于历史搜索记录
   */
  getSearchSuggestions(platform: Platform, prefix: string, limit?: number): Promise<string[]>;
}
