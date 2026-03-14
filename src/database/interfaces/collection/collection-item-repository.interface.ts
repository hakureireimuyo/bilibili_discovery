/**
 * CollectionItem Repository 接口规范
 * 定义收藏项相关的数据库操作接口
 */

import { CollectionItem, Collection } from '../../types/collection';
import { PaginationParams, PaginationResult } from '../../types/base';

/**
 * CollectionItem 数据库接口
 * 职责：管理收藏项数据
 */
export interface ICollectionItemRepository {
  /**
   * 向收藏夹添加视频
   * 
   * @param collectionId - 收藏夹ID
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @param note - 添加备注（可选）
   * @returns Promise<string> - 收藏项ID
   * 
   * 职责：
   * - 添加视频到收藏夹
   * - 创建收藏记录
   * - 更新收藏夹的lastUpdate时间
   * 
   * 能力边界：
   * - 不验证视频是否存在
   * - 不去重
   */
  addVideoToCollection(
    collectionId: string,
    videoId: string,
    platform: string,
    note?: string
  ): Promise<string>;

  /**
   * 批量添加视频到收藏夹
   * 
   * @param collectionId - 收藏夹ID
   * @param videoIds - 视频ID列表
   * @param platform - 平台类型
   * @returns Promise<string[]> - 收藏项ID列表
   * 
   * 职责：
   * - 批量添加视频到收藏夹
   * - 优化数据库操作性能
   * - 更新收藏夹的lastUpdate时间
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   * - 不去重
   */
  addVideosToCollection(
    collectionId: string,
    videoIds: string[],
    platform: string
  ): Promise<string[]>;

  /**
   * 从收藏夹移除视频
   * 
   * @param collectionId - 收藏夹ID
   * @param videoId - 视频ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 从收藏夹移除视频
   * - 删除收藏记录
   * - 更新收藏夹的lastUpdate时间
   * 
   * 能力边界：
   * - 不删除视频本身
   */
  removeVideoFromCollection(collectionId: string, videoId: string): Promise<void>;

  /**
   * 批量从收藏夹移除视频
   * 
   * @param collectionId - 收藏夹ID
   * @param videoIds - 视频ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量从收藏夹移除视频
   * - 优化数据库操作性能
   * - 更新收藏夹的lastUpdate时间
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 不删除视频本身
   */
  removeVideosFromCollection(collectionId: string, videoIds: string[]): Promise<void>;

  /**
   * 获取收藏夹的视频列表
   * 
   * @param collectionId - 收藏夹ID
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<CollectionItem>> - 视频列表
   * 
   * 职责：
   * - 查询收藏夹的视频
   * - 按收藏时间降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含视频详情
   */
  getCollectionVideos(collectionId: string, pagination: PaginationParams): Promise<PaginationResult<CollectionItem>>;

  /**
   * 检查视频是否在收藏夹中
   * 
   * @param collectionId - 收藏夹ID
   * @param videoId - 视频ID
   * @returns Promise<boolean> - 是否在收藏夹中
   * 
   * 职责：
   * - 检查视频是否已添加到收藏夹
   * 
   * 能力边界：
   * - 不返回收藏详情
   */
  isVideoInCollection(collectionId: string, videoId: string): Promise<boolean>;

  /**
   * 获取视频所在的收藏夹列表
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @returns Promise<Collection[]> - 收藏夹列表
   * 
   * 职责：
   * - 查询包含指定视频的所有收藏夹
   * 
   * 能力边界：
   * - 不包含视频详情
   */
  getVideoCollections(videoId: string, platform: string): Promise<Collection[]>;

  /**
   * 更新收藏项
   * 
   * @param itemId - 收藏项ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新收藏项信息
   * - 更新收藏夹的lastUpdate时间
   * 
   * 能力边界：
   * - 不更新itemId和collectionId
   */
  updateCollectionItem(itemId: string, updates: Partial<Omit<CollectionItem, 'itemId' | 'collectionId' | 'addedAt'>>): Promise<void>;

  /**
   * 获取收藏项
   * 
   * @param itemId - 收藏项ID
   * @returns Promise<CollectionItem | null> - 收藏项信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询收藏项
   * - 返回完整的收藏项信息
   * 
   * 能力边界：
   * - 仅返回单个收藏项
   */
  getCollectionItem(itemId: string): Promise<CollectionItem | null>;

  /**
   * 获取收藏项数量
   * 
   * @param collectionId - 收藏夹ID
   * @returns Promise<number> - 收藏项数量
   * 
   * 职责：
   * - 统计收藏夹的视频数量
   * 
   * 能力边界：
   * - 仅返回计数
   */
  countCollectionItems(collectionId: string): Promise<number>;

  /**
   * 清空收藏夹
   * 
   * @param collectionId - 收藏夹ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除收藏夹的所有视频
   * - 更新收藏夹的lastUpdate时间
   * 
   * 能力边界：
   * - 不删除视频本身
   */
  clearCollection(collectionId: string): Promise<void>;

  /**
   * 重新排序收藏项
   * 
   * @param collectionId - 收藏夹ID
   * @param itemOrders - 收藏项ID和顺序的映射
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新收藏项的顺序
   * - 更新收藏夹的lastUpdate时间
   * 
   * 能力边界：
   * - 不验证收藏项是否存在
   */
  reorderCollectionItems(collectionId: string, itemOrders: Map<string, number>): Promise<void>;

  /**
   * 搜索收藏项
   * 
   * @param collectionId - 收藏夹ID
   * @param keyword - 搜索关键词
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<CollectionItem>> - 搜索结果
   * 
   * 职责：
   * - 搜索收藏项的备注
   * - 支持模糊匹配
   * - 返回分页结果
   * 
   * 能力边界：
   * - 仅搜索note字段
   */
  searchCollectionItems(
    collectionId: string,
    keyword: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<CollectionItem>>;
}
