/**
 * TagEmbedding Repository 接口规范
 * 定义标签向量相关的数据库操作接口
 */

import { TagEmbedding } from '../../types/semantic';

/**
 * TagEmbedding 数据库接口
 * 职责：管理标签向量数据
 */
export interface ITagEmbeddingRepository {
  /**
   * 保存标签向量
   * 
   * @param embedding - 向量信息
   * @returns Promise<void>
   * 
   * 职责：
   * - 保存或更新标签向量
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证向量维度
   * - 不验证模型名称
   */
  saveEmbedding(embedding: Omit<TagEmbedding, 'createdAt' | 'lastUpdate'>): Promise<void>;

  /**
   * 批量保存标签向量
   * 
   * @param embeddings - 向量信息列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量保存标签向量
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  saveEmbeddings(embeddings: Omit<TagEmbedding, 'createdAt' | 'lastUpdate'>[]): Promise<void>;

  /**
   * 获取标签向量
   * 
   * @param tagId - 标签ID
   * @returns Promise<TagEmbedding | null> - 向量信息，不存在则返回null
   * 
   * 职责：
   * - 查询标签向量
   * - 返回完整的向量信息
   * 
   * 能力边界：
   * - 仅返回单个向量
   */
  getEmbedding(tagId: string): Promise<TagEmbedding | null>;

  /**
   * 批量获取标签向量
   * 
   * @param tagIds - 标签ID列表
   * @returns Promise<TagEmbedding[]> - 向量信息列表
   * 
   * 职责：
   * - 批量查询标签向量
   * - 返回存在的向量信息
   * 
   * 能力边界：
   * - 最多查询100个标签
   * - 不保证返回顺序与输入顺序一致
   */
  getEmbeddings(tagIds: string[]): Promise<TagEmbedding[]>;

  /**
   * 获取所有标签向量
   * 
   * @param modelName - 模型名称（可选）
   * @returns Promise<TagEmbedding[]> - 向量信息列表
   * 
   * 职责：
   * - 查询所有标签向量
   * - 支持按模型名称过滤
   * 
   * 能力边界：
   * - 不支持分页
   */
  getAllEmbeddings(modelName?: string): Promise<TagEmbedding[]>;

  /**
   * 删除标签向量
   * 
   * @param tagId - 标签ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除标签向量
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  deleteEmbedding(tagId: string): Promise<void>;

  /**
   * 批量删除标签向量
   * 
   * @param tagIds - 标签ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除标签向量
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 不删除标签本身
   */
  deleteEmbeddings(tagIds: string[]): Promise<void>;

  /**
   * 按模型名称删除所有向量
   * 
   * @param modelName - 模型名称
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定模型的所有向量
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  deleteEmbeddingsByModel(modelName: string): Promise<void>;

  /**
   * 检查标签向量是否存在
   * 
   * @param tagId - 标签ID
   * @returns Promise<boolean> - 是否存在
   * 
   * 职责：
   * - 检查标签是否有向量数据
   * 
   * 能力边界：
   * - 不返回向量详情
   */
  embeddingExists(tagId: string): Promise<boolean>;

  /**
   * 获取向量统计信息
   * 
   * @param modelName - 模型名称（可选）
   * @returns Promise<{total: number, dimension: number, models: string[]}> - 统计信息
   * 
   * 职责：
   * - 返回向量统计信息
   * - 包含总数、维度、使用的模型
   * 
   * 能力边界：
   * - 不返回具体向量数据
   */
  getEmbeddingStats(modelName?: string): Promise<{
    total: number;
    dimension: number;
    models: string[];
  }>;
}
