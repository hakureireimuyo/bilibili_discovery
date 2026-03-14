/**
 * InterestHistory Repository 接口规范
 * 定义兴趣历史记录相关的数据库操作接口
 */

import { InterestHistory } from '../../types/analytics';
import { TimeRange } from '../../types/base';

/**
 * InterestHistory 数据库接口
 * 职责：管理兴趣历史记录数据
 */
export interface IInterestHistoryRepository {
  /**
   * 记录兴趣历史
   * 
   * @param history - 历史记录信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 保存兴趣历史记录
   * - 自动生成recordId
   * 
   * 能力边界：
   * - 不验证标签是否存在
   */
  recordInterestHistory(history: Omit<InterestHistory, 'recordId'>): Promise<void>;

  /**
   * 批量记录兴趣历史
   * 
   * @param histories - 历史记录列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量保存兴趣历史记录
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  recordInterestHistories(histories: Omit<InterestHistory, 'recordId'>[]): Promise<void>;

  /**
   * 获取标签的兴趣历史
   * 
   * @param tagId - 标签ID
   * @param timeRange - 时间范围（可选）
   * @returns Promise<InterestHistory[]> - 历史记录列表
   * 
   * 职责：
   * - 查询指定标签的兴趣历史
   * - 支持按时间范围过滤
   * - 按timestamp升序排序
   * 
   * 能力边界：
   * - 不支持分页
   */
  getInterestHistory(tagId: string, timeRange?: TimeRange): Promise<InterestHistory[]>;

  /**
   * 批量获取多个标签的兴趣历史
   * 
   * @param tagIds - 标签ID列表
   * @param timeRange - 时间范围（可选）
   * @returns Promise<Map<string, InterestHistory[]>> - 标签ID到历史记录的映射
   * 
   * 职责：
   * - 批量查询多个标签的兴趣历史
   * - 支持按时间范围过滤
   * 
   * 能力边界：
   * - 最多查询100个标签
   */
  getInterestHistories(tagIds: string[], timeRange?: TimeRange): Promise<Map<string, InterestHistory[]>>;

  /**
   * 删除兴趣历史
   * 
   * @param recordId - 记录ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除历史记录
   * 
   * 能力边界：
   * - 不删除标签
   */
  deleteInterestHistory(recordId: string): Promise<void>;

  /**
   * 删除标签的所有历史记录
   * 
   * @param tagId - 标签ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定标签的所有历史记录
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  deleteTagInterestHistory(tagId: string): Promise<void>;

  /**
   * 批量删除标签的历史记录
   * 
   * @param tagIds - 标签ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除多个标签的历史记录
   * 
   * 能力边界：
   * - 最多处理1000条记录
   */
  deleteTagsInterestHistory(tagIds: string[]): Promise<void>;

  /**
   * 清空所有兴趣历史
   * 
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除所有兴趣历史记录
   * 
   * 能力边界：
   * - 不删除标签
   */
  clearAllInterestHistory(): Promise<void>;

  /**
   * 按时间范围删除历史记录
   * 
   * @param timeRange - 时间范围
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定时间范围内的历史记录
   * 
   * 能力边界：
   * - 不删除标签
   */
  deleteInterestHistoryByTimeRange(timeRange: TimeRange): Promise<void>;

  /**
   * 获取兴趣历史统计
   * 
   * @param tagId - 标签ID
   * @param timeRange - 时间范围（可选）
   * @returns Promise<{count: number, avgScore: number, maxScore: number, minScore: number}> - 统计信息
   * 
   * 职责：
   * - 返回指定标签的兴趣历史统计
   * - 包含记录数、平均分、最高分、最低分
   * 
   * 能力边界：
   * - 不返回具体历史记录
   */
  getInterestHistoryStats(tagId: string, timeRange?: TimeRange): Promise<{
    count: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
  }>;

  /**
   * 获取兴趣变化趋势
   * 
   * @param tagId - 标签ID
   * @param timeRange - 时间范围
   * @param interval - 时间间隔（天）
   * @returns Promise<{timestamp: number, score: number}[]> - 趋势数据
   * 
   * 职责：
   * - 返回指定标签的兴趣变化趋势
   * - 按指定时间间隔聚合数据
   * 
   * 能力边界：
   * - interval不超过30天
   */
  getInterestTrend(tagId: string, timeRange: TimeRange, interval: number): Promise<{
    timestamp: number;
    score: number;
  }[]>;
}
