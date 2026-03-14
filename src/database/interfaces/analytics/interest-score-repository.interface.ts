/**
 * InterestScore Repository 接口规范
 * 定义用户兴趣权重相关的数据库操作接口
 */

import { InterestScore } from '../../types/analytics';

/**
 * InterestScore 数据库接口
 * 职责：管理用户兴趣权重数据
 */
export interface IInterestScoreRepository {
  /**
   * 更新兴趣分数
   * 
   * @param score - 兴趣分数信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 创建或更新兴趣分数
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证标签是否存在
   * - 不触发相关更新
   */
  updateInterestScore(score: Omit<InterestScore, 'lastUpdate'>): Promise<void>;

  /**
   * 批量更新兴趣分数
   * 
   * @param scores - 兴趣分数列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量更新兴趣分数
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  updateInterestScores(scores: Omit<InterestScore, 'lastUpdate'>[]): Promise<void>;

  /**
   * 获取兴趣分数
   * 
   * @param tagId - 标签ID
   * @returns Promise<InterestScore | null> - 兴趣分数，不存在则返回null
   * 
   * 职责：
   * - 根据标签ID查询兴趣分数
   * - 返回完整的分数信息
   * 
   * 能力边界：
   * - 仅返回单个标签的分数
   */
  getInterestScore(tagId: string): Promise<InterestScore | null>;

  /**
   * 批量获取兴趣分数
   * 
   * @param tagIds - 标签ID列表
   * @returns Promise<InterestScore[]> - 兴趣分数列表
   * 
   * 职责：
   * - 批量查询兴趣分数
   * - 返回存在的分数信息
   * 
   * 能力边界：
   * - 最多查询100个标签
   * - 不保证返回顺序与输入顺序一致
   */
  getInterestScores(tagIds: string[]): Promise<InterestScore[]>;

  /**
   * 获取所有兴趣分数
   * 
   * @param minScore - 最小分数阈值（可选）
   * @returns Promise<InterestScore[]> - 兴趣分数列表
   * 
   * 职责：
   * - 查询所有兴趣分数
   * - 支持按分数过滤
   * - 按score降序排序
   * 
   * 能力边界：
   * - 不支持分页
   */
  getAllInterestScores(minScore?: number): Promise<InterestScore[]>;

  /**
   * 获取Top兴趣标签
   * 
   * @param limit - 返回数量限制
   * @param scoreType - 分数类型：综合/短期/长期
   * @returns Promise<InterestScore[]> - 兴趣分数列表
   * 
   * 职责：
   * - 返回兴趣最高的标签
   * - 按指定分数类型排序
   * 
   * 能力边界：
   * - 最多返回100个标签
   */
  getTopInterests(limit?: number, scoreType?: 'score' | 'shortTermScore' | 'longTermScore'): Promise<InterestScore[]>;

  /**
   * 删除兴趣分数
   * 
   * @param tagId - 标签ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除兴趣分数记录
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  deleteInterestScore(tagId: string): Promise<void>;

  /**
   * 批量删除兴趣分数
   * 
   * @param tagIds - 标签ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除兴趣分数
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 不删除标签本身
   */
  deleteInterestScores(tagIds: string[]): Promise<void>;

  /**
   * 清空所有兴趣分数
   * 
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除所有兴趣分数记录
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  clearAllInterestScores(): Promise<void>;

  /**
   * 获取兴趣分数统计
   * 
   * @returns Promise<{total: number, avgScore: number, maxScore: number}> - 统计信息
   * 
   * 职责：
   * - 返回兴趣分数的统计信息
   * - 包含总数、平均分、最高分
   * 
   * 能力边界：
   * - 不返回具体分数
   */
  getInterestScoreStats(): Promise<{
    total: number;
    avgScore: number;
    maxScore: number;
  }>;
}
