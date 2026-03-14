/**
 * UserInterestProfile Repository 接口规范
 * 定义用户兴趣画像相关的数据库操作接口
 */

import { UserInterestProfile } from '../../types/analytics';

/**
 * UserInterestProfile 数据库接口
 * 职责：管理用户兴趣画像数据
 */
export interface IUserInterestProfileRepository {
  /**
   * 创建或更新用户兴趣画像
   * 
   * @param profile - 画像信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 创建或更新用户兴趣画像
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证标签是否存在
   * - 不验证分区是否存在
   */
  upsertProfile(profile: Omit<UserInterestProfile, 'lastUpdate'>): Promise<void>;

  /**
   * 获取用户兴趣画像
   * 
   * @returns Promise<UserInterestProfile | null> - 画像信息，不存在则返回null
   * 
   * 职责：
   * - 查询用户兴趣画像
   * - 返回完整的画像信息
   * 
   * 能力边界：
   * - 仅返回单个画像
   */
  getProfile(): Promise<UserInterestProfile | null>;

  /**
   * 更新画像兴趣分布
   * 
   * @param interestDistribution - 兴趣分布
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新画像的兴趣分布
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证分区是否存在
   */
  updateInterestDistribution(interestDistribution: UserInterestProfile['interestDistribution']): Promise<void>;

  /**
   * 更新主要兴趣标签
   * 
   * @param topInterests - 主要兴趣标签
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新画像的主要兴趣标签
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证标签是否存在
   */
  updateTopInterests(topInterests: UserInterestProfile['topInterests']): Promise<void>;

  /**
   * 更新兴趣趋势
   * 
   * @param interestTrend - 兴趣趋势
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新画像的兴趣趋势
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证趋势值是否合法
   */
  updateInterestTrend(interestTrend: UserInterestProfile['interestTrend']): Promise<void>;

  /**
   * 更新活跃度
   * 
   * @param activityLevel - 活跃度
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新画像的活跃度
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证活跃度值是否合法
   */
  updateActivityLevel(activityLevel: number): Promise<void>;

  /**
   * 获取兴趣变化历史
   * 
   * @param days - 天数
   * @returns Promise<Array<{date: string, topInterests: Array<{tagId: string, score: number>}>> - 变化历史
   * 
   * 职责：
   * - 返回指定天数内的兴趣变化历史
   * - 包含每天的主要兴趣标签
   * 
   * 能力边界：
   * - days不超过90天
   */
  getInterestHistory(days: number): Promise<Array<{
    date: string;
    topInterests: Array<{tagId: string; score: number}>;
  }>>;

  /**
   * 重新计算画像
   * 
   * @returns Promise<void>
   * 
   * 职责：
   * - 基于当前数据重新计算用户兴趣画像
   * - 更新所有相关字段
   * 
   * 能力边界：
   * - 不依赖外部数据源
   * - 仅基于已有数据计算
   */
  recalculateProfile(): Promise<void>;

  /**
   * 导出画像
   * 
   * @returns Promise<string> - JSON格式的画像数据
   * 
   * 职责：
   * - 导出用户兴趣画像为JSON格式
   * - 包含所有画像信息
   * 
   * 能力边界：
   * - 不包含敏感信息
   */
  exportProfile(): Promise<string>;

  /**
   * 导入画像
   * 
   * @param jsonData - JSON格式的画像数据
   * @returns Promise<void>
   * 
   * 职责：
   * - 从JSON导入用户兴趣画像
   * - 验证数据格式
   * 
   * 能力边界：
   * - 不验证标签和分区是否存在
   */
  importProfile(jsonData: string): Promise<void>;

  /**
   * 获取画像快照
   * 
   * @param timestamp - 时间戳
   * @returns Promise<UserInterestProfile | null> - 画像快照，不存在则返回null
   * 
   * 职责：
   * - 获取指定时间点的画像快照
   * - 返回完整的画像信息
   * 
   * 能力边界：
   * - 仅返回单个快照
   * - 快照保留期不超过1年
   */
  getProfileSnapshot(timestamp: number): Promise<UserInterestProfile | null>;

  /**
   * 保存画像快照
   * 
   * @returns Promise<void>
   * 
   * 职责：
   * - 保存当前画像的快照
   * - 自动设置快照时间戳
   * 
   * 能力边界：
   * - 不修改当前画像
   */
  saveProfileSnapshot(): Promise<void>;

  /**
   * 删除画像快照
   * 
   * @param timestamp - 时间戳
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定时间点的画像快照
   * 
   * 能力边界：
   * - 不影响当前画像
   */
  deleteProfileSnapshot(timestamp: number): Promise<void>;

  /**
   * 清空所有画像快照
   * 
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除所有画像快照
   * 
   * 能力边界：
   * - 不影响当前画像
   */
  clearProfileSnapshots(): Promise<void>;

  /**
   * 获取画像统计
   * 
   * @returns Promise<{totalInterests: number, totalCategories: number, lastUpdate: number}> - 统计信息
   * 
   * 职责：
   * - 返回画像的统计信息
   * - 包含兴趣总数、分类总数、最后更新时间
   * 
   * 能力边界：
   * - 不返回具体画像数据
   */
  getProfileStats(): Promise<{
    totalInterests: number;
    totalCategories: number;
    lastUpdate: number;
  }>;
}
