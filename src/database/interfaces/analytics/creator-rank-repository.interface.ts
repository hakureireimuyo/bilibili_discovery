/**
 * CreatorRank Repository 接口规范
 * 定义创作者排名相关的数据库操作接口
 */

import { CreatorRank } from '../../types/analytics';
import { Platform, PaginationParams, PaginationResult } from '../../types/base';

/**
 * CreatorRank 数据库接口
 * 职责：管理创作者排名数据
 */
export interface ICreatorRankRepository {
  /**
   * 更新创作者排名
   * 
   * @param rank - 排名信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 创建或更新创作者排名
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证创作者是否存在
   * - 不自动计算排名
   */
  updateCreatorRank(rank: Omit<CreatorRank, 'lastUpdate'>): Promise<void>;

  /**
   * 批量更新创作者排名
   * 
   * @param ranks - 排名信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量更新创作者排名
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  updateCreatorRanks(ranks: Omit<CreatorRank, 'lastUpdate'>[]): Promise<void>;

  /**
   * 获取创作者排名
   * 
   * @param creatorId - 创作者ID
   * @returns Promise<CreatorRank | null> - 排名信息，不存在则返回null
   * 
   * 职责：
   * - 根据创作者ID查询排名
   * - 返回完整的排名信息
   * 
   * 能力边界：
   * - 仅返回单个创作者的排名
   */
  getCreatorRank(creatorId: string): Promise<CreatorRank | null>;

  /**
   * 批量获取创作者排名
   * 
   * @param creatorIds - 创作者ID列表
   * @returns Promise<CreatorRank[]> - 排名信息列表
   * 
   * 职责：
   * - 批量查询创作者排名
   * - 返回存在的排名信息
   * 
   * 能力边界：
   * - 最多查询100个创作者
   * - 不保证返回顺序与输入顺序一致
   */
  getCreatorRanks(creatorIds: string[]): Promise<CreatorRank[]>;

  /**
   * 获取创作者排名列表
   * 
   * @param platform - 平台类型
   * @param limit - 返回数量限制
   * @returns Promise<CreatorRank[]> - 排名列表
   * 
   * 职责：
   * - 返回排名前列的创作者
   * - 按rank升序排序
   * 
   * 能力边界：
   * - 最多返回100个创作者
   * - 不支持分页
   */
  getCreatorRanking(platform: Platform, limit?: number): Promise<CreatorRank[]>;

  /**
   * 获取分页的创作者排名
   * 
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<CreatorRank>> - 分页结果
   * 
   * 职责：
   * - 返回分页的创作者排名
   * - 按rank升序排序
   * 
   * 能力边界：
   * - 支持分页
   */
  getCreatorRankingPaginated(platform: Platform, pagination: PaginationParams): Promise<PaginationResult<CreatorRank>>;

  /**
   * 删除创作者排名
   * 
   * @param creatorId - 创作者ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除创作者排名记录
   * 
   * 能力边界：
   * - 不删除创作者本身
   */
  deleteCreatorRank(creatorId: string): Promise<void>;

  /**
   * 批量删除创作者排名
   * 
   * @param creatorIds - 创作者ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除创作者排名
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 不删除创作者本身
   */
  deleteCreatorRanks(creatorIds: string[]): Promise<void>;

  /**
   * 清空所有创作者排名
   * 
   * @param platform - 平台类型
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定平台的所有创作者排名
   * 
   * 能力边界：
   * - 不删除创作者本身
   */
  clearCreatorRanks(platform: Platform): Promise<void>;

  /**
   * 重新计算排名
   * 
   * @param platform - 平台类型
   * @returns Promise<void>
   * 
   * 职责：
   * - 根据score重新计算所有创作者的rank
   * - 按score降序分配rank
   * 
   * 能力边界：
   * - 仅更新rank字段
   * - 不重新计算score
   */
  recalculateRanks(platform: Platform): Promise<void>;

  /**
   * 获取排名统计
   * 
   * @param platform - 平台类型
   * @returns Promise<{total: number, avgScore: number, avgWatchTime: number}> - 统计信息
   * 
   * 职责：
   * - 返回创作者排名的统计信息
   * - 包含总数、平均分、平均观看时长
   * 
   * 能力边界：
   * - 不返回具体排名数据
   */
  getRankStats(platform: Platform): Promise<{
    total: number;
    avgScore: number;
    avgWatchTime: number;
  }>;

  /**
   * 获取排名变化
   * 
   * @param creatorId - 创作者ID
   * @param days - 天数
   * @returns Promise<{currentRank: number, previousRank: number, change: number}> - 排名变化
   * 
   * 职责：
   * - 返回创作者的排名变化
   * - 正数表示上升，负数表示下降
   * 
   * 能力边界：
   * - days不超过90天
   */
  getRankChange(creatorId: string, days: number): Promise<{
    currentRank: number;
    previousRank: number;
    change: number;
  }>;
}
