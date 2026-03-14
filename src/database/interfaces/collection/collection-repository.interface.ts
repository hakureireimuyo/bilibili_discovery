/**
 * Collection Repository 接口规范
 * 定义收藏夹相关的数据库操作接口
 */

import { Collection } from '../../types/collection';
import { Platform, PaginationParams, PaginationResult } from '../../types/base';

/**
 * Collection 数据库接口
 * 职责：管理收藏夹数据的增删改查
 */
export interface ICollectionRepository {
  /**
   * 创建收藏夹
   * 
   * @param collection - 收藏夹信息
   * @returns Promise<string> - 收藏夹ID
   * 
   * 职责：
   * - 创建新收藏夹
   * - 自动生成collectionId
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不验证视频是否存在
   * - 不验证标签是否存在
   */
  createCollection(collection: Omit<Collection, 'collectionId'>): Promise<string>;

  /**
   * 获取收藏夹
   * 
   * @param collectionId - 收藏夹ID
   * @returns Promise<Collection | null> - 收藏夹信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询收藏夹
   * - 返回完整的收藏夹信息
   * 
   * 能力边界：
   * - 仅返回单个收藏夹
   */
  getCollection(collectionId: string): Promise<Collection | null>;

  /**
   * 获取所有收藏夹
   * 
   * @param platform - 平台类型
   * @returns Promise<Collection[]> - 收藏夹列表
   * 
   * 职责：
   * - 查询所有收藏夹
   * - 按lastUpdate降序排序
   * 
   * 能力边界：
   * - 不支持分页
   * - 不包含视频详情
   */
  getAllCollections(platform: Platform): Promise<Collection[]>;

  /**
   * 更新收藏夹
   * 
   * @param collectionId - 收藏夹ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新收藏夹信息
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不更新collectionId
   * - 不验证视频是否存在
   */
  updateCollection(collectionId: string, updates: Partial<Omit<Collection, 'collectionId' | 'createdAt'>>): Promise<void>;

  /**
   * 删除收藏夹
   * 
   * @param collectionId - 收藏夹ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除收藏夹记录
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除视频本身
   */
  deleteCollection(collectionId: string): Promise<void>;

  /**
   * 搜索收藏夹
   * 
   * @param platform - 平台类型
   * @param keyword - 搜索关键词
   * @returns Promise<Collection[]> - 收藏夹列表
   * 
   * 职责：
   * - 按名称搜索收藏夹
   * - 支持模糊匹配
   * 
   * 能力边界：
   * - 仅搜索name字段
   * - 不支持复杂查询条件
   */
  searchCollections(platform: Platform, keyword: string): Promise<Collection[]>;

  /**
   * 获取收藏夹统计信息
   * 
   * @param collectionId - 收藏夹ID
   * @returns Promise<CollectionStats | null> - 统计信息，不存在则返回null
   * 
   * 职责：
   * - 返回收藏夹的统计数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 仅返回统计数据
   * - 不包含收藏夹基本信息
   */
  getCollectionStats(collectionId: string): Promise<CollectionStats | null>;

  /**
   * 检查收藏夹名称是否已存在
   * 
   * @param platform - 平台类型
   * @param name - 收藏夹名称
   * @param excludeId - 排除的收藏夹ID（可选）
   * @returns Promise<boolean> - 是否存在
   * 
   * 职责：
   * - 检查收藏夹名称是否已使用
   * - 支持排除指定收藏夹
   * 
   * 能力边界：
   * - 不返回收藏夹详情
   */
  collectionNameExists(platform: Platform, name: string, excludeId?: string): Promise<boolean>;
}
