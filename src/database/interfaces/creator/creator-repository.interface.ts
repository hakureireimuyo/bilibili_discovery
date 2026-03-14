/**
 * Creator Repository 接口规范
 * 定义创作者（UP主/Channel）相关的数据库操作接口
 */

import { Creator, CreatorStats } from '../../types/creator';
import { Platform, PaginationParams, PaginationResult } from '../../types/base';

/**
 * Creator 数据库接口
 * 职责：管理创作者数据的增删改查
 */
export interface ICreatorRepository {
  /**
   * 创建或更新创作者信息
   * 
   * @param creator - 创作者信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 如果creatorId已存在则更新，否则创建新记录
   * - 自动设置createdAt和lastUpdate时间
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不处理创作者的视频列表
   * - 不处理创作者的统计数据
   */
  upsertCreator(creator: Creator): Promise<void>;

  /**
   * 批量创建或更新创作者信息
   * 
   * @param creators - 创作者信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量处理创作者数据
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  upsertCreators(creators: Creator[]): Promise<void>;

  /**
   * 获取创作者信息
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @returns Promise<Creator | null> - 创作者信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID和平台查询创作者
   * - 返回完整的创作者信息
   * 
   * 能力边界：
   * - 仅返回单个创作者
   * - 不包含统计数据
   */
  getCreator(creatorId: string, platform: Platform): Promise<Creator | null>;

  /**
   * 获取多个创作者信息
   * 
   * @param creatorIds - 创作者ID列表
   * @param platform - 平台类型
   * @returns Promise<Creator[]> - 创作者信息列表
   * 
   * 职责：
   * - 批量查询创作者
   * - 返回存在的创作者信息
   * 
   * 能力边界：
   * - 最多查询100个创作者
   * - 不保证返回顺序与输入顺序一致
   */
  getCreators(creatorIds: string[], platform: Platform): Promise<Creator[]>;

  /**
   * 获取所有关注的创作者
   * 
   * @param platform - 平台类型
   * @returns Promise<Creator[]> - 创作者列表
   * 
   * 职责：
   * - 查询所有isFollowing=true的创作者
   * - 按followTime降序排序
   * 
   * 能力边界：
   * - 不包含未关注的创作者
   * - 不包含统计数据
   */
  getFollowingCreators(platform: Platform): Promise<Creator[]>;

  /**
   * 更新创作者关注状态
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @param isFollowing - 是否关注
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新创作者的关注状态
   * - 更新关注时间
   * 
   * 能力边界：
   * - 不处理创作者的其他信息
   * - 不触发相关数据更新
   */
  updateFollowStatus(creatorId: string, platform: Platform, isFollowing: boolean): Promise<void>;

  /**
   * 更新创作者标签权重
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @param tagWeights - 标签权重列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新创作者的标签权重
   * - 合并现有标签权重
   * 
   * 能力边界：
   * - 不验证标签是否存在
   * - 不触发相关统计更新
   */
  updateTagWeights(creatorId: string, platform: Platform, tagWeights: Creator['tagWeights']): Promise<void>;

  /**
   * 获取创作者统计信息
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @returns Promise<CreatorStats | null> - 统计信息，不存在则返回null
   * 
   * 职责：
   * - 返回创作者的统计数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 仅返回统计数据
   * - 不包含创作者基本信息
   */
  getCreatorStats(creatorId: string, platform: Platform): Promise<CreatorStats | null>;

  /**
   * 获取多个创作者的统计信息
   * 
   * @param creatorIds - 创作者ID列表
   * @param platform - 平台类型
   * @returns Promise<CreatorStats[]> - 统计信息列表
   * 
   * 职责：
   * - 批量获取创作者统计数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 最多查询100个创作者
   * - 不保证返回顺序与输入顺序一致
   */
  getCreatorsStats(creatorIds: string[], platform: Platform): Promise<CreatorStats[]>;

  /**
   * 获取创作者排名
   * 
   * @param platform - 平台类型
   * @param limit - 返回数量限制
   * @returns Promise<CreatorStats[]> - 排名列表
   * 
   * 职责：
   * - 按综合评分排序
   * - 返回排名前列的创作者
   * 
   * 能力边界：
   * - 最多返回100个创作者
   * - 不支持分页
   */
  getCreatorRanking(platform: Platform, limit?: number): Promise<CreatorStats[]>;

  /**
   * 搜索创作者
   * 
   * @param platform - 平台类型
   * @param keyword - 搜索关键词
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<Creator>> - 搜索结果
   * 
   * 职责：
   * - 按名称搜索创作者
   * - 支持模糊匹配
   * - 返回分页结果
   * 
   * 能力边界：
   * - 仅搜索名称字段
   * - 不支持复杂查询条件
   */
  searchCreators(platform: Platform, keyword: string, pagination: PaginationParams): Promise<PaginationResult<Creator>>;

  /**
   * 删除创作者
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除创作者记录
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除创作者的视频记录
   * - 不删除行为记录
   */
  deleteCreator(creatorId: string, platform: Platform): Promise<void>;

  /**
   * 标记创作者为已注销
   * 
   * @param creatorId - 创作者ID
   * @param platform - 平台类型
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新创作者注销状态
   * - 保留历史数据
   * 
   * 能力边界：
   * - 不删除任何数据
   * - 不影响已有关联数据
   */
  markCreatorAsLogout(creatorId: string, platform: Platform): Promise<void>;
}
