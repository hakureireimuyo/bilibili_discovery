/**
 * InterestNode Repository 接口规范
 * 定义兴趣星球节点相关的数据库操作接口
 */

import { InterestNode } from '../../types/analytics';

/**
 * InterestNode 数据库接口
 * 职责：管理兴趣星球节点数据
 */
export interface IInterestNodeRepository {
  /**
   * 创建兴趣节点
   * 
   * @param node - 节点信息
   * @returns Promise<string> - 节点ID
   * 
   * 职责：
   * - 创建新节点
   * - 自动生成nodeId
   * - 验证必填字段
   * 
   * 能力边界：
   * - 不验证标签是否存在
   * - 不验证父节点是否存在
   */
  createNode(node: Omit<InterestNode, 'nodeId'>): Promise<string>;

  /**
   * 批量创建兴趣节点
   * 
   * @param nodes - 节点信息列表
   * @returns Promise<string[]> - 节点ID列表
   * 
   * 职责：
   * - 批量创建兴趣节点
   * - 优化数据库操作性能
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 失败时回滚所有操作
   */
  createNodes(nodes: Omit<InterestNode, 'nodeId'>[]): Promise<string[]>;

  /**
   * 获取兴趣节点
   * 
   * @param nodeId - 节点ID
   * @returns Promise<InterestNode | null> - 节点信息，不存在则返回null
   * 
   * 职责：
   * - 根据ID查询节点
   * - 返回完整的节点信息
   * 
   * 能力边界：
   * - 仅返回单个节点
   */
  getNode(nodeId: string): Promise<InterestNode | null>;

  /**
   * 批量获取兴趣节点
   * 
   * @param nodeIds - 节点ID列表
   * @returns Promise<InterestNode[]> - 节点列表
   * 
   * 职责：
   * - 批量查询兴趣节点
   * - 返回存在的节点信息
   * 
   * 能力边界：
   * - 最多查询100个节点
   * - 不保证返回顺序与输入顺序一致
   */
  getNodes(nodeIds: string[]): Promise<InterestNode[]>;

  /**
   * 获取所有兴趣节点
   * 
   * @param parentId - 父节点ID（可选）
   * @returns Promise<InterestNode[]> - 节点列表
   * 
   * 职责：
   * - 查询所有节点
   * - 支持按父节点过滤
   * - 按weight降序排序
   * 
   * 能力边界：
   * - 不支持分页
   */
  getAllNodes(parentId?: string): Promise<InterestNode[]>;

  /**
   * 获取节点路径
   * 
   * @param nodeId - 节点ID
   * @returns Promise<InterestNode[]> - 节点路径（从根到该节点）
   * 
   * 职责：
   * - 获取从根节点到指定节点的完整路径
   * 
   * 能力边界：
   * - 不包含子节点
   */
  getNodePath(nodeId: string): Promise<InterestNode[]>;

  /**
   * 获取子节点
   * 
   * @param nodeId - 父节点ID
   * @returns Promise<InterestNode[]> - 子节点列表
   * 
   * 职责：
   * - 获取指定节点的所有子节点
   * - 按weight降序排序
   * 
   * 能力边界：
   * - 仅返回直接子节点
   */
  getChildNodes(nodeId: string): Promise<InterestNode[]>;

  /**
   * 获取节点树
   * 
   * @param rootId - 根节点ID（可选）
   * @param maxDepth - 最大深度（可选）
   * @returns Promise<InterestNode[]> - 节点树
   * 
   * 职责：
   * - 返回完整的节点层级结构
   * - 包含所有子节点
   * 
   * 能力边界：
   * - maxDepth不超过10
   */
  getNodeTree(rootId?: string, maxDepth?: number): Promise<InterestNode[]>;

  /**
   * 更新兴趣节点
   * 
   * @param nodeId - 节点ID
   * @param updates - 更新内容
   * @returns Promise<void>
   * 
   * 职责：
   * - 更新节点信息
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不更新nodeId
   * - 不验证标签是否存在
   */
  updateNode(nodeId: string, updates: Partial<Omit<InterestNode, 'nodeId' | 'createdAt'>>): Promise<void>;

  /**
   * 批量更新兴趣节点
   * 
   * @param updates - 节点ID和更新内容的映射
   * @returns Promise<void>
   * 
   * 职责：
   * - 批量更新节点信息
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 最多处理1000条记录
   * - 不验证标签是否存在
   */
  updateNodes(updates: Map<string, Partial<Omit<InterestNode, 'nodeId' | 'createdAt'>>>): Promise<void>;

  /**
   * 删除兴趣节点
   * 
   * @param nodeId - 节点ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除节点记录
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除子节点
   * - 不删除标签
   */
  deleteNode(nodeId: string): Promise<void>;

  /**
   * 删除节点及其所有子节点
   * 
   * @param nodeId - 节点ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 删除节点及其所有子节点
   * - 清理相关数据
   * 
   * 能力边界：
   * - 不删除标签
   */
  deleteNodeTree(nodeId: string): Promise<void>;

  /**
   * 移动节点
   * 
   * @param nodeId - 节点ID
   * @param newParentId - 新父节点ID
   * @returns Promise<void>
   * 
   * 职责：
   * - 移动节点到新的父节点下
   * - 自动设置lastUpdate时间
   * 
   * 能力边界：
   * - 不验证新父节点是否存在
   * - 不检查循环引用
   */
  moveNode(nodeId: string, newParentId?: string): Promise<void>;
}
