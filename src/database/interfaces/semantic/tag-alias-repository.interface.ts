/**
 * TagAlias Repository 接口规范
 * 定义标签别名映射相关的数据库操作接口
 */

import { TagAlias } from '../../types/semantic';

/**
 * TagAlias 数据库接口
 * 职责：管理标签别名映射数据
 */
export interface ITagAliasRepository {
  /**
   * 添加标签别名映射
   * 
   * @param alias - 别名信息
   * @returns Promise<string> - 别名ID
   * 
   * 职责：
   * - 创建新的标签别名映射
   * - 自动生成aliasId
   * 
   * 能力边界：
   * - 不验证targetTagId是否存在
   * - 不检查重复映射
   */
  addAlias(alias: Omit<TagAlias, 'aliasId'>): Promise<string>;

  /**
   * 批量添加标签别名映射
   * 
   * @param aliases - 别名信息列表
   * @returns Promise<string[]> - 别名ID列表
   * 
   * 职责：
   * - 批量创建标签别名映射
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  addAliases(aliases: Omit<TagAlias, 'aliasId'>[]): Promise<string[]>;

  /**
   * 查询标签别名
   * 
   * @param alias - 别名文本
   * @returns Promise<TagAlias | null> - 别名映射，不存在则返回null
   * 
   * 职责：
   * - 根据别名文本查询映射
   * - 返回完整的映射信息
   * 
   * 能力边界：
   * - 仅返回单个映射
   * - 不验证targetTagId是否存在
   */
  getAlias(alias: string): Promise<TagAlias | null>;

  /**
   * 获取目标标签的所有别名
   * 
   * @param targetTagId - 目标标签ID
   * @returns Promise<TagAlias[]> - 别名列表
   * 
   * 职责：
   * - 查询映射到指定标签的所有别名
   * 
   * 能力边界：
   * - 不包含反向映射
   */
  getAliasesByTargetTag(targetTagId: string): Promise<TagAlias[]>;

  /**
   * 获取所有别名映射
   * 
   * @param mappingType - 映射类型（可选）
   * @returns Promise<TagAlias[]> - 别名映射列表
   * 
   * 职责：
   * - 查询所有别名映射
   * - 支持按类型过滤
   * 
   * 能力边界：
   * - 不支持分页
   */
  getAllAliases(mappingType?: TagAlias['mappingType']): Promise<TagAlias[]>;

  /**
   * 删除标签别名
   * 
   * @param aliasId - 别名ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除别名映射
   * 
   * 能力边界：
   * - 不影响标签本身
   */
  deleteAlias(aliasId: string): Promise<void>;

  /**
   * 批量删除标签别名
   * 
   * @param aliasIds - 别名ID列表
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量删除别名映射
   * 
   * 能力边界：
   * - 最多处理1000条记录
   */
  deleteAliases(aliasIds: string[]): Promise<void>;

  /**
   * 删除目标标签的所有别名
   * 
   * @param targetTagId - 目标标签ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除映射到指定标签的所有别名
   * 
   * 能力边界：
   * - 不删除标签本身
   */
  deleteAliasesByTargetTag(targetTagId: string): Promise<void>;

  /**
   * 检查别名是否存在
   * 
   * @param alias - 别名文本
   * @returns Promise<boolean> - 是否存在
   * 
   * 职责：
   * - 检查别名是否已映射
   * 
   * 能力边界：
   * - 不返回映射详情
   */
  aliasExists(alias: string): Promise<boolean>;
}
