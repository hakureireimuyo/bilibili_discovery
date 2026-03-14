/**
 * WatchTimeStats Repository 接口规范
 * 定义观看时间统计相关的数据库操作接口
 */

import { WatchTimeStats, WatchTimeDistribution } from '../../types/analytics';

/**
 * WatchTimeStats 数据库接口
 * 职责：管理观看时间统计数据
 */
export interface IWatchTimeStatsRepository {
  /**
   * 更新观看时间统计
   * 
   * @param stats - 统计信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 创建或更新观看时间统计
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证小时是否合法
   * - 不自动聚合数据
   */
  updateWatchTimeStats(stats: Omit<WatchTimeStats, 'lastUpdate'>): Promise<void>;

  /**
   * 批量更新观看时间统计
   * 
   * @param statsList - 统计信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量更新观看时间统计
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  updateWatchTimeStatsBatch(statsList: Omit<WatchTimeStats, 'lastUpdate'>[]): Promise<void>;

  /**
   * 获取观看时间统计
   * 
   * @param hour - 小时（0-23）
   * @param dayType - 工作日/周末
   * @returns Promise<WatchTimeStats | null> - 统计信息，不存在则返回null
   * 
   * 职责：
   * - 查询指定时间段的统计
   * - 返回完整的统计信息
   * 
   * 能力边界：
   * - 仅返回单个时间段的统计
   */
  getWatchTimeStats(hour: number, dayType: 'weekday' | 'weekend'): Promise<WatchTimeStats | null>;

  /**
   * 批量获取观看时间统计
   * 
   * @param hours - 小时列表
   * @param dayType - 工作日/周末
   * @returns Promise<WatchTimeStats[]> - 统计信息列表
   * 
   * 职责：
   * - 批量查询多个时间段的统计
   * 
   * 能力边界：
   * - 最多查询24个小时
   */
  getWatchTimeStatsBatch(hours: number[], dayType: 'weekday' | 'weekend'): Promise<WatchTimeStats[]>;

  /**
   * 获取所有观看时间统计
   * 
   * @param dayType - 工作日/周末（可选）
   * @returns Promise<WatchTimeStats[]> - 统计信息列表
   * 
   * 职责：
   * - 查询所有时间段的统计
   * - 支持按dayType过滤
   * 
   * 能力边界：
   * - 不支持分页
   */
  getAllWatchTimeStats(dayType?: 'weekday' | 'weekend'): Promise<WatchTimeStats[]>;

  /**
   * 删除观看时间统计
   * 
   * @param statsId - 统计ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除观看时间统计记录
   */
  deleteWatchTimeStats(statsId: string): Promise<void>;

  /**
   * 清空所有观看时间统计
   * 
   * @param dayType - 工作日/周末（可选）
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除所有观看时间统计
   * - 支持按dayType过滤
   */
  clearWatchTimeStats(dayType?: 'weekday' | 'weekend'): Promise<void>;

  /**
   * 获取观看时间分布
   * 
   * @param date - 日期
   * @returns Promise<WatchTimeDistribution | null> - 分布信息，不存在则返回null
   * 
   * 职责：
   * - 查询指定日期的观看时间分布
   * - 返回完整的分布信息
   * 
   * 能力边界：
   * - 仅返回单个日期的分布
   */
  getWatchTimeDistribution(date: string): Promise<WatchTimeDistribution | null>;

  /**
   * 保存观看时间分布
   * 
   * @param distribution - 分布信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 创建或更新观看时间分布
   * 
   * 能力边界：
   * - 不验证日期格式
   */
  saveWatchTimeDistribution(distribution: Omit<WatchTimeDistribution, 'createdAt'>): Promise<void>;

  /**
   * 批量保存观看时间分布
   * 
   * @param distributions - 分布信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量保存观看时间分布
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理365条记录
   * - 失败时回滚所有操作
   */
  saveWatchTimeDistributionBatch(distributions: Omit<WatchTimeDistribution, 'createdAt'>[]): Promise<void>;

  /**
   * 获取日期范围内的观看时间分布
   * 
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns Promise<WatchTimeDistribution[]> - 分布信息列表
   * 
   * 职责：
   * - 查询指定日期范围内的分布
   * - 按日期升序排序
   * 
   * 能力边界：
   * - 日期范围不超过1年
   */
  getWatchTimeDistributions(startDate: string, endDate: string): Promise<WatchTimeDistribution[]>;

  /**
   * 删除观看时间分布
   * 
   * @param date - 日期
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定日期的观看时间分布
   */
  deleteWatchTimeDistribution(date: string): Promise<void>;

  /**
   * 删除日期范围内的观看时间分布
   * 
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定日期范围内的分布
   * 
   * 能力边界：
   * - 日期范围不超过1年
   */
  deleteWatchTimeDistributions(startDate: string, endDate: string): Promise<void>;

  /**
   * 获取观看时间热力图数据
   * 
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns Promise<Array<{date: string, hour: number, count: number}>> - 热力图数据
   * 
   * 职责：
   * - 返回日期和小时的观看次数矩阵
   * - 用于生成热力图
   * 
   * 能力边界：
   * - 日期范围不超过1年
   */
  getWatchTimeHeatmap(startDate: string, endDate: string): Promise<Array<{
    date: string;
    hour: number;
    count: number;
  }>>;

  /**
   * 获取观看时间统计汇总
   * 
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns Promise<{totalWatchTime: number, totalWatchCount: number, avgDailyWatchTime: number}> - 汇总信息
   * 
   * 职责：
   * - 返回指定日期范围内的观看统计汇总
   * - 包含总观看时长、总观看次数、平均每日观看时长
   * 
   * 能力边界：
   * - 日期范围不超过1年
   */
  getWatchTimeSummary(startDate: string, endDate: string): Promise<{
    totalWatchTime: number;
    totalWatchCount: number;
    avgDailyWatchTime: number;
  }>;
}
