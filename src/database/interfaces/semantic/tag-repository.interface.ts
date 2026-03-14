/**
 * Tag Repository 接口规范
 * 定义标签相关的数据库操作接口
 */

import { Tag, TagStats } from '../../types/semantic';
import { PaginationParams, PaginationResult } from '../../types/base';

/**
 * Tag 数据库接口
 * 职责：管理标签数据的增删改查
 */
export interface ITagRepository {
  /**
   * 创建标签
   * 
   * @param tag - 标签信息
   * @returns Promise<string> - 标签ID
   * 
   * 职责：
   * - 创建新标签
   * - 自动生成tagId
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不验证标签名称唯一性
   * - 不处理标签关联
   */
  createTag(tag: Omit<Tag, 'tagId'>): Promise<string>;

  /**
   * 批量创建标签
   * 
   * @param tags - 标签信息列表
   * @returns Promise<string[]> - 标签ID列表
   * 
   * 职责：
   * - 批量创建标签
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  createTags(tags: Omit<Tag, 'tagId'>[]): Promise<string[]>;

  /**
   * 获取标签
   * 
   * @param tagId - 标签ID
   * @returns Promise<Tag | null> - 标签信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询标签
   * - 返回完整的标签信息
   * 
   * 能力边界：
   * - 仅返回单个标签
   */
  getTag(tagId: string): Promise<Tag | null>;

  /**
   * 批量获取标签
   * 
   * @param tagIds - 标签ID列表
   * @returns Promise<Tag[]> - 标签信息列表
   * 
   * 职责：
   * - 批量查询标签
   * - 返回存在的标签信息
   * 
   * 能力边界：
   * - 最多查询100个标签
   * - 不保证返回顺序与输入顺序一致
   */
  getTags(tagIds: string[]): Promise<Tag[]>;

  /**
   * 搜索标签
   * 
   * @param keyword - 搜索关键词
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<Tag>> - 搜索结果
   * 
   * 职责：
   * - 按名称搜索标签
   * - 支持模糊匹配
   * - 返回分页结果
   * 
   * 能力边界：
   * - 仅搜索name字段
   * - 不支持复杂查询条件
   */
  searchTags(keyword: string, pagination: PaginationParams): Promise<PaginationResult<Tag>>;

  /**
   * 获取所有标签
   * 
   * @param source - 标签来源（可选）
   * @returns Promise<Tag[]> - 标签列表
   * 
   * 职责：
   * - 查询所有标签
   * - 支持按来源过滤
   * 
   * 能力边界：
   * - 不支持分页
   */
  getAllTags(source?: Tag['source']): Promise<Tag[]>;

  /**
   * 更新标签
   * 
   * @param tagId - 标签ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新标签信息
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不更新tagId
   * - 不处理标签关联
   */
  updateTag(tagId: string, updates: Partial<Omit<Tag, 'tagId' | 'createdAt'>>): Promise<void>;

  /**
   * 删除标签
   * 
   * @param tagId - 标签ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除标签记录
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除使用该标签的视频
   * - 不删除使用该标签的笔记
   */
  deleteTag(tagId: string): Promise<void>;

  /**
   * 获取标签统计信息
   * 
   * @param tagId - 标签ID
   * @returns Promise<TagStats | null> - 统计信息，不存在则返回null
   * 
   * 职责：
   * - 返回标签的统计数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 仅返回统计数据
   * - 不包含标签基本信息
   */
  getTagStats(tagId: string): Promise<TagStats | null>;

  /**
   * 批量获取标签统计信息
   * 
   * @param tagIds - 标签ID列表
   * @returns Promise<TagStats[]> - 统计信息列表
   * 
   * 职责：
   * - 批量获取标签统计数据
   * - 自动计算或更新过期数据
   * 
   * 能力边界：
   * - 最多查询100个标签
   * - 不保证返回顺序与输入顺序一致
   */
  getTagsStats(tagIds: string[]): Promise<TagStats[]>;

  /**
   * 获取热门标签
   * 
   * @param limit - 返回数量限制
   * @param source - 标签来源（可选）
   * @returns Promise<Tag[]> - 热门标签列表
   * 
   * 职责：
   * - 按使用频率排序
   * - 返回热门标签
   * 
   * 能力边界：
   * - 最多返回100个标签
   * - 不支持分页
   */
  getHotTags(limit?: number, source?: Tag['source']): Promise<Tag[]>;
}
