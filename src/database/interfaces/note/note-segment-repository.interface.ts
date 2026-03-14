/**
 * NoteSegment Repository 接口规范
 * 定义笔记分段相关的数据库操作接口
 */

import { NoteSegment } from '../../types/note';

/**
 * NoteSegment 数据库接口
 * 职责：管理笔记分段数据
 */
export interface INoteSegmentRepository {
  /**
   * 创建分段
   * 
   * @param segment - 分段信息
   * @returns Promise<string> - 分段ID
   * 
   * 职责：
   * - 创建新分段
   * - 自动生成segmentId
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不验证笔记是否存在
   * - 不生成embedding
   */
  createSegment(segment: Omit<NoteSegment, 'segmentId'>): Promise<string>;

  /**
   * 批量创建分段
   * 
   * @param segments - 分段信息列表
   * @returns Promise<string[]> - 分段ID列表
   * 
   * 职责：
   * - 批量创建分段
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  createSegments(segments: Omit<NoteSegment, 'segmentId'>[]): Promise<string[]>;

  /**
   * 获取分段
   * 
   * @param segmentId - 分段ID
   * @returns Promise<NoteSegment | null> - 分段信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询分段
   * - 返回完整的分段信息
   * 
   * 能力边界：
   * - 仅返回单个分段
   */
  getSegment(segmentId: string): Promise<NoteSegment | null>;

  /**
   * 获取笔记的所有分段
   * 
   * @param noteId - 笔记ID
   * @returns Promise<NoteSegment[]> - 分段列表
   * 
   * 职责：
   * - 查询指定笔记的所有分段
   * - 按order排序
   * 
   * 能力边界：
   * - 不支持分页
   */
  getNoteSegments(noteId: string): Promise<NoteSegment[]>;

  /**
   * 更新分段
   * 
   * @param segmentId - 分段ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新分段信息
   * 
   * 能力边界：
   * - 不更新segmentId
   * - 不更新embedding
   */
  updateSegment(segmentId: string, updates: Partial<Omit<NoteSegment, 'segmentId' | 'createdAt'>>): Promise<void>;

  /**
   * 更新分段embedding
   * 
   * @param segmentId - 分段ID
   * @param embedding - 向量数据
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新分段的向量
   * 
   * 能力边界：
   * - 不验证向量维度
   */
  updateSegmentEmbedding(segmentId: string, embedding: number[]): Promise<void>;

  /**
   * 删除分段
   * 
   * @param segmentId - 分段ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除分段记录
   * 
   * 能力边界：
   * - 不删除笔记
   */
  deleteSegment(segmentId: string): Promise<void>;

  /**
   * 删除笔记的所有分段
   * 
   * @param noteId - 笔记ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定笔记的所有分段
   * 
   * 能力边界：
   * - 不删除笔记本身
   */
  deleteNoteSegments(noteId: string): Promise<void>;

  /**
   * 批量删除分段
   * 
   * @param segmentIds - 分段ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除分段
   * 
   * 能力边界：
   * - 最多处理1000条记录
   */
  deleteSegments(segmentIds: string[]): Promise<void>;

  /**
   * 获取分段数量
   * 
   * @param noteId - 笔记ID
   * @returns Promise<number> - 分段数量
   * 
   * 职责：
   * - 统计指定笔记的分段数量
   * 
   * 能力边界：
   * - 仅返回计数
   */
  countSegments(noteId: string): Promise<number>;

  /**
   * 重新排序分段
   * 
   * @param noteId - 笔记ID
   * @param segmentOrders - 分段ID和顺序的映射
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新分段的顺序
   * - 确保顺序连续
   * 
   * 能力边界：
   * - 不验证分段是否存在
   */
  reorderSegments(noteId: string, segmentOrders: Map<string, number>): Promise<void>;
}
