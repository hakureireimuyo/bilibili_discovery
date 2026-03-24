/**
 * 创作者索引缓存实现
 * 使用LRU策略管理创作者索引缓存
 */

import { LRUCache } from '../lru-cache.js';
import type { ID, Timestamp, Platform } from '../../database/types/base.js';
import type { CacheStats } from '../types.js';

/**
 * 创作者索引信息
 * 只存储创作者的关键索引字段,用于快速搜索和过滤
 */
export interface CreatorIndex {
  /** 创作者ID */
  creatorId: ID;
  /** 平台 */
  platform: Platform;
  /** 名称 */
  name: string;
  /** 标签列表 */
  tags: ID[];
  /** 分类列表 */
  categories: ID[];
  /** 是否关注 */
  isFollowing: boolean;
  /** 关注时间 */
  followTime: Timestamp;
  /** 创建时间 */
  createdAt: Timestamp;
  /** 更新时间 */
  updatedAt: Timestamp;
}

/**
 * 创作者查询条件
 */
export interface CreatorIndexQuery {
  /** 平台 */
  platform?: Platform;
  /** 分类过滤 */
  categories?: ID[];
  /** 是否关注 */
  isFollowing?: boolean;
  /** 时间范围 */
  timeRange?: {
    startTime: Timestamp;
    endTime: Timestamp;
  };
  /** 关键词搜索 */
  keyword?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'followTime' | 'name';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 创作者索引缓存类
 * 使用LRU策略管理创作者索引缓存
 */
export class CreatorIndexCache {
  private cache: LRUCache<ID, CreatorIndex>;
  private platformIndex: Map<Platform, ID[]> = new Map(); // platform -> creatorIds
  private tagIndex: Map<ID, ID[]> = new Map(); // tagId -> creatorIds
  private categoryIndex: Map<ID, ID[]> = new Map(); // categoryId -> creatorIds
  private followingIndex: Map<boolean, ID[]> = new Map(); // isFollowing -> creatorIds

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache<ID, CreatorIndex>(maxSize);
  }

  /**
   * 获取创作者索引
   */
  get(creatorId: ID): CreatorIndex | undefined {
    return this.cache.get(creatorId);
  }

  /**
   * 设置创作者索引
   */
  set(creatorIndex: CreatorIndex): void {
    // 更新主缓存
    this.cache.set(creatorIndex.creatorId, creatorIndex);

    // 更新平台索引
    this.updatePlatformIndex(creatorIndex);

    // 更新标签索引
    this.updateTagIndex(creatorIndex);

    // 更新分类索引
    this.updateCategoryIndex(creatorIndex);

    // 更新关注索引
    this.updateFollowingIndex(creatorIndex);
  }

  /**
   * 批量设置创作者索引
   */
  setBatch(creatorIndexes: CreatorIndex[]): void {
    creatorIndexes.forEach(index => this.set(index));
  }

  /**
   * 检查创作者索引是否存在
   */
  has(creatorId: ID): boolean {
    return this.cache.has(creatorId);
  }

  /**
   * 删除创作者索引
   */
  delete(creatorId: ID): boolean {
    const creatorIndex = this.cache.get(creatorId);
    if (!creatorIndex) {
      return false;
    }

    // 从平台索引中移除
    this.removeFromPlatformIndex(creatorIndex.platform, creatorId);

    // 从标签索引中移除
    creatorIndex.tags.forEach(tagId => {
      this.removeFromTagIndex(tagId, creatorId);
    });

    // 从分类索引中移除
    creatorIndex.categories.forEach(categoryId => {
      this.removeFromCategoryIndex(categoryId, creatorId);
    });

    // 从关注索引中移除
    this.removeFromFollowingIndex(creatorIndex.isFollowing, creatorId);

    // 从主缓存中移除
    return this.cache.delete(creatorId);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.platformIndex.clear();
    this.tagIndex.clear();
    this.categoryIndex.clear();
    this.followingIndex.clear();
  }

  /**
   * 查询创作者索引
   */
  query(query: CreatorIndexQuery): CreatorIndex[] {
    let results: CreatorIndex[] = [];

    // 根据查询条件获取候选创作者ID
    let candidateIds: ID[] | undefined;

    if (query.platform) {
      // 平台过滤
      candidateIds = this.getByPlatform(query.platform);
    } else if (query.categories && query.categories.length > 0) {
      // 分类过滤
      candidateIds = this.getByCategories(query.categories);
    } else if (query.isFollowing !== undefined) {
      // 关注状态过滤
      candidateIds = this.getByFollowing(query.isFollowing);
    } else {
      // 获取所有创作者ID
      candidateIds = this.cache.keys();
    }

    // 获取候选创作者索引
    if (candidateIds) {
      results = candidateIds
        .map(id => this.cache.get(id))
        .filter((index): index is CreatorIndex => index !== undefined);
    }

    // 平台过滤(如果不是主要过滤条件)
    if (query.platform && candidateIds) {
      results = results.filter(index => index.platform === query.platform);
    }

    // 关键词搜索
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      results = results.filter(index =>
        index.name.toLowerCase().includes(keyword)
      );
    }

    // 时间范围过滤
    if (query.timeRange) {
      results = results.filter(index =>
        index.createdAt >= query.timeRange!.startTime &&
        index.createdAt <= query.timeRange!.endTime
      );
    }

    // 排序
    if (query.sortBy) {
      results.sort((a, b) => {
        const aValue = a[query.sortBy!];
        const bValue = b[query.sortBy!];
        const order = query.sortOrder === 'desc' ? -1 : 1;

        // 字符串类型特殊处理
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * order;
        }

        return ((aValue as number) - (bValue as number)) * order;
      });
    }

    return results;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats & {
    platformIndexSize: number;
    tagIndexSize: number;
    categoryIndexSize: number;
    followingIndexSize: number;
  } {
    const stats = this.cache.getStats();
    return {
      ...stats,
      platformIndexSize: this.platformIndex.size,
      tagIndexSize: this.tagIndex.size,
      categoryIndexSize: this.categoryIndex.size,
      followingIndexSize: this.followingIndex.size
    };
  }

  /**
   * 更新平台索引
   */
  private updatePlatformIndex(creatorIndex: CreatorIndex): void {
    const { platform, creatorId } = creatorIndex;
    if (!this.platformIndex.has(platform)) {
      this.platformIndex.set(platform, []);
    }
    const creatorIds = this.platformIndex.get(platform)!;
    if (!creatorIds.includes(creatorId)) {
      creatorIds.push(creatorId);
    }
  }

  /**
   * 更新标签索引
   */
  private updateTagIndex(creatorIndex: CreatorIndex): void {
    const { tags, creatorId } = creatorIndex;
    tags.forEach(tagId => {
      if (!this.tagIndex.has(tagId)) {
        this.tagIndex.set(tagId, []);
      }
      const creatorIds = this.tagIndex.get(tagId)!;
      if (!creatorIds.includes(creatorId)) {
        creatorIds.push(creatorId);
      }
    });
  }

  /**
   * 更新分类索引
   */
  private updateCategoryIndex(creatorIndex: CreatorIndex): void {
    const { categories, creatorId } = creatorIndex;
    categories.forEach(categoryId => {
      if (!this.categoryIndex.has(categoryId)) {
        this.categoryIndex.set(categoryId, []);
      }
      const creatorIds = this.categoryIndex.get(categoryId)!;
      if (!creatorIds.includes(creatorId)) {
        creatorIds.push(creatorId);
      }
    });
  }

  /**
   * 更新关注索引
   */
  private updateFollowingIndex(creatorIndex: CreatorIndex): void {
    const { isFollowing, creatorId } = creatorIndex;
    if (!this.followingIndex.has(isFollowing)) {
      this.followingIndex.set(isFollowing, []);
    }
    const creatorIds = this.followingIndex.get(isFollowing)!;
    if (!creatorIds.includes(creatorId)) {
      creatorIds.push(creatorId);
    }
  }

  /**
   * 从平台索引中移除
   */
  private removeFromPlatformIndex(platform: Platform, creatorId: ID): void {
    const creatorIds = this.platformIndex.get(platform);
    if (creatorIds) {
      const index = creatorIds.indexOf(creatorId);
      if (index !== -1) {
        creatorIds.splice(index, 1);
      }
    }
  }

  /**
   * 从标签索引中移除
   */
  private removeFromTagIndex(tagId: ID, creatorId: ID): void {
    const creatorIds = this.tagIndex.get(tagId);
    if (creatorIds) {
      const index = creatorIds.indexOf(creatorId);
      if (index !== -1) {
        creatorIds.splice(index, 1);
      }
    }
  }

  /**
   * 从分类索引中移除
   */
  private removeFromCategoryIndex(categoryId: ID, creatorId: ID): void {
    const creatorIds = this.categoryIndex.get(categoryId);
    if (creatorIds) {
      const index = creatorIds.indexOf(creatorId);
      if (index !== -1) {
        creatorIds.splice(index, 1);
      }
    }
  }

  /**
   * 从关注索引中移除
   */
  private removeFromFollowingIndex(isFollowing: boolean, creatorId: ID): void {
    const creatorIds = this.followingIndex.get(isFollowing);
    if (creatorIds) {
      const index = creatorIds.indexOf(creatorId);
      if (index !== -1) {
        creatorIds.splice(index, 1);
      }
    }
  }

  /**
   * 根据平台获取创作者ID
   */
  private getByPlatform(platform: Platform): ID[] {
    return [...(this.platformIndex.get(platform) || [])];
  }

  /**
   * 根据分类获取创作者ID
   */
  private getByCategories(categories: ID[]): ID[] {
    if (categories.length === 0) {
      return this.cache.keys();
    }

    // 获取第一个分类的创作者ID
    const firstCategoryCreators = this.categoryIndex.get(categories[0]) || [];

    // 如果只有一个分类,直接返回
    if (categories.length === 1) {
      return [...firstCategoryCreators];
    }

    // 多个分类,取交集
    return firstCategoryCreators.filter(creatorId => {
      return categories.slice(1).every(categoryId => {
        const creators = this.categoryIndex.get(categoryId);
        return creators && creators.includes(creatorId);
      });
    });
  }

  /**
   * 根据关注状态获取创作者ID
   */
  private getByFollowing(isFollowing: boolean): ID[] {
    return [...(this.followingIndex.get(isFollowing) || [])];
  }

  /**
   * 根据标签逻辑表达式查询创作者ID
   * @param expressions 标签逻辑表达式数组（从左到右依次执行）
   * @returns 符合条件的创作者ID列表
   */
  queryByTagExpressions(expressions: Array<{
    operator: 'and' | 'or' | 'not';
    tagIds: string[];
  }>): ID[] {
    if (expressions.length === 0) {
      return this.cache.keys();
    }

    // 初始结果为所有创作者ID
    let result: ID[] = this.cache.keys();

    // 从左到右依次执行每个表达式
    for (const expr of expressions) {
      switch (expr.operator) {
        case 'and':
          // 与运算：必须包含所有指定标签
          result = this.applyAndOperator(result, expr.tagIds);
          break;
        case 'or':
          // 或运算：至少包含其中一个标签
          result = this.applyOrOperator(result, expr.tagIds);
          break;
        case 'not':
          // 非运算：不包含指定标签
          result = this.applyNotOperator(result, expr.tagIds);
          break;
      }
    }

    return result;
  }

  /**
   * 应用与运算符
   * @param currentIds 当前创作者ID列表
   * @param tagIds 标签ID列表
   * @returns 同时包含所有指定标签的创作者ID列表
   */
  private applyAndOperator(currentIds: ID[], tagIds: string[]): ID[] {
    if (tagIds.length === 0) {
      return currentIds;
    }

    // 获取第一个标签的创作者ID
    const firstTagCreators = this.tagIndex.get(tagIds[0]) || [];

    // 如果只有一个标签，返回交集
    if (tagIds.length === 1) {
      return currentIds.filter(id => firstTagCreators.includes(id));
    }

    // 多个标签，取所有标签的交集
    const allTagCreators = tagIds.reduce((acc, tagId) => {
      const creators = this.tagIndex.get(tagId) || [];
      return acc.filter(id => creators.includes(id));
    }, firstTagCreators);

    // 返回与当前结果的交集
    return currentIds.filter(id => allTagCreators.includes(id));
  }

  /**
   * 应用或运算符
   * @param currentIds 当前创作者ID列表
   * @param tagIds 标签ID列表
   * @returns 至少包含其中一个标签的创作者ID列表
   */
  private applyOrOperator(currentIds: ID[], tagIds: string[]): ID[] {
    if (tagIds.length === 0) {
      return currentIds;
    }

    // 收集所有标签对应的创作者ID
    const allTagCreators = new Set<ID>();
    for (const tagId of tagIds) {
      const creators = this.tagIndex.get(tagId) || [];
      creators.forEach(id => allTagCreators.add(id));
    }

    // 返回当前结果中至少包含一个标签的创作者
    return currentIds.filter(id => allTagCreators.has(id));
  }

  /**
   * 应用非运算符
   * @param currentIds 当前创作者ID列表
   * @param tagIds 标签ID列表
   * @returns 不包含任何指定标签的创作者ID列表
   */
  private applyNotOperator(currentIds: ID[], tagIds: string[]): ID[] {
    if (tagIds.length === 0) {
      return currentIds;
    }

    // 收集所有标签对应的创作者ID
    const excludedIds = new Set<ID>();
    for (const tagId of tagIds) {
      const creators = this.tagIndex.get(tagId) || [];
      creators.forEach(id => excludedIds.add(id));
    }

    // 返回当前结果中不包含任何排除标签的创作者
    return currentIds.filter(id => !excludedIds.has(id));
  }
}
