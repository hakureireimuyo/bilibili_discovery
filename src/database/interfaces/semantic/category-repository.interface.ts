/**
 * Category Repository 接口规范
 * 定义标签分区相关的数据库操作接口
 */

import { Category } from '../../types/semantic';

/**
 * Category 数据库接口
 * 职责：管理标签分区数据
 */
export interface ICategoryRepository {
  /**
   * 创建分区
   * 
   * @param category - 分区信息
   * @returns Promise<string> - 分区ID
   * 
   * 职责：
   * - 创建新分区
   * - 自动生成id
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不验证标签是否存在
   * - 不处理分区层级关系
   */
  createCategory(category: Omit<Category, 'id'>): Promise<string>;

  /**
   * 批量创建分区
   * 
   * @param categories - 分区信息列表
   * @returns Promise<string[]> - 分区ID列表
   * 
   * 职责：
   * - 批量创建分区
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  createCategories(categories: Omit<Category, 'id'>[]): Promise<string[]>;

  /**
   * 获取分区
   * 
   * @param categoryId - 分区ID
   * @returns Promise<Category | null> - 分区信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询分区
   * - 返回完整的分区信息
   * 
   * 能力边界：
   * - 仅返回单个分区
   */
  getCategory(categoryId: string): Promise<Category | null>;

  /**
   * 获取所有分区
   * 
   * @param parentId - 父分区ID（可选）
   * @returns Promise<Category[]> - 分区列表
   * 
   * 职责：
   * - 查询所有分区
   * - 支持按父分区过滤
   * - 按order排序
   * 
   * 能力边界：
   * - 不支持分页
   */
  getAllCategories(parentId?: string): Promise<Category[]>;

  /**
   * 获取分区树
   * 
   * @param rootId - 根分区ID（可选）
   * @returns Promise<Category[]> - 分区树
   * 
   * 职责：
   * - 返回完整的分区层级结构
   * - 包含所有子分区
   * 
   * 能力边界：
   * - 不支持分页
   */
  getCategoryTree(rootId?: string): Promise<Category[]>;

  /**
   * 更新分区
   * 
   * @param categoryId - 分区ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新分区信息
   * 
   * 能力边界：
   * - 不更新id
   * - 不验证标签是否存在
   */
  updateCategory(categoryId: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<void>;

  /**
   * 删除分区
   * 
   * @param categoryId - 分区ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除分区记录
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除分区内的标签
   * - 不删除子分区
   */
  deleteCategory(categoryId: string): Promise<void>;

  /**
   * 删除分区及其所有子分区
   * 
   * @param categoryId - 分区ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除分区及其所有子分区
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除分区内的标签
   */
  deleteCategoryTree(categoryId: string): Promise<void>;

  /**
   * 向分区添加标签
   * 
   * @param categoryId - 分区ID
   * @param tagIds - 标签ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 向分区添加标签
   * - 合并而非替换
   * 
   * 能力边界：
   * - 不验证标签是否存在
   * - 不去重
   */
  addTagsToCategory(categoryId: string, tagIds: string[]): Promise<void>;

  /**
   * 从分区移除标签
   * 
   * @param categoryId - 分区ID
   * @param tagIds - 标签ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 从分区移除标签
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  removeTagsFromCategory(categoryId: string, tagIds: string[]): Promise<void>;

  /**
   * 清空分区的所有标签
   * 
   * @param categoryId - 分区ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 移除分区的所有标签
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  clearCategoryTags(categoryId: string): Promise<void>;

  /**
   * 获取分区的所有标签
   * 
   * @param categoryId - 分区ID
   * @returns Promise<string[]> - 标签ID列表
   * 
   * 职责：
   * - 返回分区的所有标签ID
   * 
   * 能力边界：
   * - 不包含标签详情
   */
  getCategoryTags(categoryId: string): Promise<string[]>;

  /**
   * 检查标签是否在分区中
   * 
   * @param categoryId - 分区ID
   * @param tagId - 标签ID
   * @returns Promise<boolean> - 是否在分区中
   * 
   * 职责：
   * - 检查标签是否属于指定分区
   * 
   * 能力边界：
   * - 不返回标签详情
   */
  isTagInCategory(categoryId: string, tagId: string): Promise<boolean>;

  /**
   * 获取标签所属的所有分区
   * 
   * @param tagId - 标签ID
   * @returns Promise<Category[]> - 分区列表
   * 
   * 职责：
   * - 查询包含指定标签的所有分区
   * 
   * 能力边界：
   * - 不包含标签详情
   */
  getTagCategories(tagId: string): Promise<Category[]>;
}
