/**
 * NoteRelation Repository 接口规范
 * 定义笔记关联关系相关的数据库操作接口
 */

import { NoteRelation } from '../../types/note';

/**
 * NoteRelation 数据库接口
 * 职责：管理笔记关联关系数据
 */
export interface INoteRelationRepository {
  /**
   * 创建关联
   * 
   * @param relation - 关联信息
   * @returns Promise<string> - 关联ID
   * 
   * 职责：
   * - 创建新的笔记关联
   * - 自动生成relationId
   * 
   * 能力边界：
   * - 不验证笔记是否存在
   * - 不检查循环引用
   */
  createRelation(relation: Omit<NoteRelation, 'relationId'>): Promise<string>;

  /**
   * 批量创建关联
   * 
   * @param relations - 关联信息列表
   * @returns Promise<string[]> - 关联ID列表
   * 
   * 职责：
   * - 批量创建笔记关联
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  createRelations(relations: Omit<NoteRelation, 'relationId'>[]): Promise<string[]>;

  /**
   * 获取关联
   * 
   * @param relationId - 关联ID
   * @returns Promise<NoteRelation | null> - 关联信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询关联
   * - 返回完整的关联信息
   * 
   * 能力边界：
   * - 仅返回单个关联
   */
  getRelation(relationId: string): Promise<NoteRelation | null>;

  /**
   * 获取笔记的所有关联
   * 
   * @param noteId - 笔记ID
   * @param relationType - 关联类型（可选）
   * @returns Promise<NoteRelation[]> - 关联列表
   * 
   * 职责：
   * - 查询指定笔记的关联
   * - 支持按类型过滤
   * 
   * 能力边界：
   * - 仅返回源笔记为noteId的关联
   */
  getNoteRelations(noteId: string, relationType?: string): Promise<NoteRelation[]>;

  /**
   * 获取笔记的所有关联（包括反向关联）
   * 
   * @param noteId - 笔记ID
   * @param relationType - 关联类型（可选）
   * @returns Promise<NoteRelation[]> - 关联列表
   * 
   * 职责：
   * - 查询指定笔记的所有关联
   * - 包括源笔记和目标笔记为noteId的关联
   * - 支持按类型过滤
   * 
   * 能力边界：
   * - 不区分关联方向
   */
  getAllNoteRelations(noteId: string, relationType?: string): Promise<NoteRelation[]>;

  /**
   * 检查笔记是否有关联
   * 
   * @param sourceNoteId - 源笔记ID
   * @param targetNoteId - 目标笔记ID
   * @param relationType - 关联类型（可选）
   * @returns Promise<boolean> - 是否存在关联
   * 
   * 职责：
   * - 检查两个笔记之间是否存在关联
   * - 支持按类型过滤
   * 
   * 能力边界：
   * - 不返回关联详情
   */
  hasRelation(
    sourceNoteId: string,
    targetNoteId: string,
    relationType?: string
  ): Promise<boolean>;

  /**
   * 删除关联
   * 
   * @param relationId - 关联ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除关联记录
   * 
   * 能力边界：
   * - 不删除笔记
   */
  deleteRelation(relationId: string): Promise<void>;

  /**
   * 删除笔记的所有关联
   * 
   * @param noteId - 笔记ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除指定笔记的所有关联
   * 
   * 能力边界：
   * - 不删除笔记本身
   */
  deleteNoteRelations(noteId: string): Promise<void>;

  /**
   * 删除笔记之间的关联
   * 
   * @param sourceNoteId - 源笔记ID
   * @param targetNoteId - 目标笔记ID
   * @param relationType - 关联类型（可选）
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除两个笔记之间的关联
   * - 支持按类型过滤
   * 
   * 能力边界：
   * - 不删除笔记本身
   */
  deleteRelationBetweenNotes(
    sourceNoteId: string,
    targetNoteId: string,
    relationType?: string
  ): Promise<void>;

  /**
   * 获取关联图
   * 
   * @param noteId - 起始笔记ID
   * @param maxDepth - 最大深度
   * @returns Promise<{nodes: string[], edges: NoteRelation[]}> - 关联图
   * 
   * 职责：
   * - 获取笔记的关联图
   * - 包含所有相关的笔记和关联
   * 
   * 能力边界：
   * - maxDepth不超过5
   */
  getRelationGraph(noteId: string, maxDepth?: number): Promise<{
    nodes: string[];
    edges: NoteRelation[];
  }>;

  /**
   * 获取关联统计
   * 
   * @param noteId - 笔记ID
   * @returns Promise<{total: number, byType: Record<string, number>}> - 统计信息
   * 
   * 职责：
   * - 返回笔记的关联统计
   * - 包含总数和按类型分组
   * 
   * 能力边界：
   * - 仅返回统计信息
   */
  getRelationStats(noteId: string): Promise<{
    total: number;
    byType: Record<string, number>;
  }>;
}
