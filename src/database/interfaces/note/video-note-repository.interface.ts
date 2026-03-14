/**
 * VideoNote Repository 接口规范
 * 定义视频笔记相关的数据库操作接口
 */

import { VideoNote } from '../../types/note';
import { Platform, PaginationParams, PaginationResult } from '../../types/base';

/**
 * VideoNote 数据库接口
 * 职责：管理视频笔记数据的增删改查
 */
export interface IVideoNoteRepository {
  /**
   * 创建笔记
   * 
   * @param note - 笔记信息
   * @returns Promise<string> - 笔记ID
   * 
   * 职责：
   * - 创建新笔记
   * - 自动生成noteId
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不验证视频是否存在
   * - 不生成embedding
   */
  createNote(note: Omit<VideoNote, 'noteId'>): Promise<string>;

  /**
   * 批量创建笔记
   * 
   * @param notes - 笔记信息列表
   * @returns Promise<string[]> - 笔记ID列表
   * 
   * 职责：
   * - 批量创建笔记
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  createNotes(notes: Omit<VideoNote, 'noteId'>[]): Promise<string[]>;

  /**
   * 获取笔记
   * 
   * @param noteId - 笔记ID
   * @returns Promise<VideoNote | null> - 笔记信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询笔记
   * - 返回完整的笔记信息
   * 
   * 能力边界：
   * - 仅返回单个笔记
   */
  getNote(noteId: string): Promise<VideoNote | null>;

  /**
   * 获取视频的所有笔记
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @param type - 笔记类型（可选）
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<VideoNote>> - 笔记列表
   * 
   * 职责：
   * - 查询指定视频的笔记
   * - 支持按类型过滤
   * - 按createdAt降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 不包含分段信息
   */
  getVideoNotes(
    videoId: string,
    platform: Platform,
    type?: VideoNote['type'],
    pagination?: PaginationParams
  ): Promise<PaginationResult<VideoNote>>;

  /**
   * 按标签查询笔记
   * 
   * @param tagIds - 标签ID列表
   * @param platform - 平台类型
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<VideoNote>> - 笔记列表
   * 
   * 职责：
   * - 查询包含任一标签的笔记
   * - 按createdAt降序排序
   * - 返回分页结果
   * 
   * 能力边界：
   * - 最多查询10个标签
   */
  getNotesByTags(
    tagIds: string[],
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<VideoNote>>;

  /**
   * 搜索笔记
   * 
   * @param platform - 平台类型
   * @param keyword - 搜索关键词
   * @param pagination - 分页参数
   * @returns Promise<PaginationResult<VideoNote>> - 搜索结果
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
  searchNotes(
    platform: Platform,
    keyword: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<VideoNote>>;

  /**
   * 更新笔记
   * 
   * @param noteId - 笔记ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新笔记信息
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不更新noteId
   * - 不更新embedding
   */
  updateNote(noteId: string, updates: Partial<Omit<VideoNote, 'noteId' | 'createdAt'>>): Promise<void>;

  /**
   * 更新笔记embedding
   * 
   * @param noteId - 笔记ID
   * @param embedding - 向量数据
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新笔记的向量
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证向量维度
   */
  updateNoteEmbedding(noteId: string, embedding: number[]): Promise<void>;

  /**
   * 删除笔记
   * 
   * @param noteId - 笔记ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除笔记记录
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除分段
   * - 不删除关联
   */
  deleteNote(noteId: string): Promise<void>;

  /**
   * 批量删除笔记
   * 
   * @param noteIds - 笔记ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除笔记
   * - 清理相关数据
   * 
   * 能力边界：
   * - 最多处理1000条记录
   */
  deleteNotes(noteIds: string[]): Promise<void>;

  /**
   * 获取笔记数量
   * 
   * @param videoId - 视频ID
   * @param platform - 平台类型
   * @param type - 笔记类型（可选）
   * @returns Promise<number> - 笔记数量
   * 
   * 职责：
   * - 统计指定视频的笔记数量
   * - 支持按类型过滤
   * 
   * 能力边界：
   * - 仅返回计数
   */
  countNotes(videoId: string, platform: Platform, type?: VideoNote['type']): Promise<number>;
}
