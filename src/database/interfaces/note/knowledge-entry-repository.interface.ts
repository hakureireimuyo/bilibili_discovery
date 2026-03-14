/**
 * KnowledgeEntry Repository 接口规范
 * 定义知识条目相关的数据库操作接口
 */

import { KnowledgeEntry } from '../../types/note';
import { PaginationParams, PaginationResult } from '../../types/base';

/**
 * KnowledgeEntry 数据库接口
 * 职责：管理知识条目数据
 */
export interface IKnowledgeEntryRepository {
  /**
   * 创建知识条目
   * 
   * @param entry - 知识条目信息
   * @returns Promise<string> - 知识条目ID
   * 
   * 职责：
   * - 创建新知识条目
   * - 自动生成entryId
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不验证笔记是否存在
   * - 不生成embedding
   */
  createEntry(entry: Omit<KnowledgeEntry, 'entryId'>): Promise<string>;

  /**
   * 批量创建知识条目
   * 
   * @param entries - 知识条目信息列表
   * @returns Promise<string[]> - 知识条目ID列表
   * 
   * 职责：
   * - 批量创建知识条目
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  createEntries(entries: Omit<KnowledgeEntry, 'entryId'>[]): Promise<string[]>;

  /**
   * 获取知识条目
   * 
   * @param entryId - 知识条目ID
   * @returns Promise<KnowledgeEntry | null> - 知识条目信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询知识条目
   * - 返回完整的知识条目信息
   * 
   * 能力边界：
   * - 仅返回单个知识条目
   */
  getEntry(entryId: string): Promise<KnowledgeEntry | null>;

  /**
   * 获取笔记的知识条目
   * 
   * @param noteId - 笔记ID
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<KnowledgeEntry>> - 知识条目列表
   * 
   * 职责：
   * - 查询指定笔记的知识条目
   * - 按createdAt降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含笔记信息
   */
  getNoteEntries(noteId: string, pagination: PaginationParams): Promise<PaginationResult<KnowledgeEntry>>;

  /**
   * 按标签查询知识条目
   * 
   * @param tagIds - 标签ID列表
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<KnowledgeEntry>> - 知识条目列表
   * 
   * 职责：
   * - 查询包含任一标签的知识条目
   * - 按createdAt降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 最多查询10个标签
   */
  getEntriesByTags(tagIds: string[], pagination: PaginationParams): Promise<PaginationResult<KnowledgeEntry>>;

  /**
   * 搜索知识条目
   * 
   * @param keyword - 搜索关键词
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<KnowledgeEntry>> - 搜索结果
   * 
   * 职责：
   * - 搜索标题和内容
   * - 支持模糊匹配
   * - 返回分页结果
   * 
   * 能力边界：
   * - 仅搜索title和content字段
   * - 不支持复杂查询条件
   */
  searchEntries(keyword: string, pagination: PaginationParams): Promise<PaginationResult<KnowledgeEntry>>;

  /**
   * 更新知识条目
   * 
   * @param entryId - 知识条目ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新知识条目信息
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不更新entryId
   * - 不更新embedding
   */
  updateEntry(entryId: string, updates: Partial<Omit<KnowledgeEntry, 'entryId' | 'createdAt'>>): Promise<void>;

  /**
   * 更新知识条目embedding
   * 
   * @param entryId - 知识条目ID
   * @param embedding - 向量数据
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新知识条目的向量
   * 
   * 能力边界：
   * - 不验证向量维度
   */
  updateEntryEmbedding(entryId: string, embedding: number[]): Promise<void>;

  /**
   * 删除知识条目
   * 
   * @param entryId - 知识条目ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除知识条目记录
   * 
   * 能力边界：
   * - 不删除笔记
   */
  deleteEntry(entryId: string): Promise<void>;

  /**
   * 删除笔记的所有知识条目
   * 
   * @param noteId - 笔记ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定笔记的所有知识条目
   * 
   * 能力边界：
   * - 不删除笔记本身
   */
  deleteNoteEntries(noteId: string): Promise<void>;

  /**
   * 批量删除知识条目
   * 
   * @param entryIds - 知识条目ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除知识条目
   * 
   * 能力边界：
   * - 最多处理1000条记录
   */
  deleteEntries(entryIds: string[]): Promise<void>;

  /**
   * 获取知识条目数量
   * 
   * @param noteId - 笔记ID
   * @returns Promise<number> - 知识条目数量
   * 
   * 职责：
   * - 统计指定笔记的知识条目数量
   * 
   * 能力边界：
   * - 仅返回计数
   */
  countEntries(noteId: string): Promise<number>;

  /**
   * 获取所有知识条目
   * 
   * @param pagination - 分页参数
   * @param type - 知识类型（可选）
   * @returns Promise<PaginationResult<KnowledgeEntry>> - 知识条目列表
   * 
   * 职责：
   * - 查询所有知识条目
   * - 支持按类型过滤
   * - 按createdAt降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含笔记信息
   */
  getAllEntries(pagination: PaginationParams, type?: KnowledgeEntry['type']): Promise<PaginationResult<KnowledgeEntry>>;

  /**
   * 按标签获取相关知识条目
   * 
   * @param tagIds - 标签ID列表
   * @param excludeEntryId - 排除的知识条目ID
   * @param limit - 返回数量限制
   * @returns Promise<KnowledgeEntry[]> - 相关知识条目列表
   * 
   * 职责：
   * - 获取与指定标签相关的知识条目
   * - 排除指定的知识条目
   * - 按相关性排序
   * 
   * 能力边界：
   * - 最多返回50个知识条目
   */
  getRelatedEntries(tagIds: string[], excludeEntryId?: string, limit?: number): Promise<KnowledgeEntry[]>;
}
