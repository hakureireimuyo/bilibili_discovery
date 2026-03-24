/**
 * 创作者查询实现
 * 基于src/cache和src/database/implementations实现
 */

import type { Creator } from '../../database/types/creator.js';
import type { Platform } from '../../database/types/base.js';
import type { QueryResult, QueryOptions, CreatorQueryParams } from '../types.js';
import { CreatorRepository } from '../../database/implementations/creator-repository.impl.js';
import { QueryError } from '../types.js';
import { CreatorIndexCache, type CreatorIndex, type CreatorIndexQuery } from '../../cache/index-cache/index.js';
import { creatorDataCache } from '../../cache/data-cache/creator-data-cache.js';

// 创建Repository实例
const creatorRepo = new CreatorRepository();

// 创建索引缓存实例
const creatorIndexCache = new CreatorIndexCache(1000);

/**
 * 将Creator转换为CreatorIndex
 */
function creatorToIndex(creator: Creator): CreatorIndex {
  return {
    creatorId: creator.creatorId,
    platform: creator.platform,
    name: creator.name,
    tags: creator.tagWeights.map(tw => tw.tagId),
    categories: creator.categories || [],
    isFollowing: creator.isFollowing === 1,
    followTime: creator.followTime,
    createdAt: creator.createdAt,
    updatedAt: creator.updatedAt
  };
}

/**
 * 搜索创作者(带分页)
 * @param platform 平台
 * @param params 查询参数
 * @param options 查询选项
 * @returns 查询结果
 */
export async function searchCreators(
  platform: Platform,
  params: Omit<CreatorQueryParams, 'platform'>,
  options: QueryOptions = {}
): Promise<QueryResult<Creator>> {
  try {
    const {
      isFollowing,
      includeCategories = [],
      excludeCategories = [],
      keyword = '',
      page = 0,
      pageSize = 50
    } = params;

    // 构建索引查询条件
    const indexQuery: CreatorIndexQuery = {
      platform,
      keyword,
      isFollowing: isFollowing !== undefined ? (isFollowing ? true : undefined) : undefined
    };

    // 添加分类过滤
    if (includeCategories.length > 0) {
      indexQuery.categories = includeCategories;
    }

    // 先从索引缓存中查询
    let creatorIndexes: CreatorIndex[] = creatorIndexCache.query(indexQuery);

    // 如果索引缓存中没有数据，从数据库加载
    if (creatorIndexes.length === 0) {
      console.log('[CreatorQuery] 索引缓存为空，从数据库加载所有创作者索引');
      const allCreators = await creatorRepo.getAllCreators(platform);

      // 将所有创作者转换为索引并缓存
      const indexes = allCreators.map(creatorToIndex);
      creatorIndexCache.setBatch(indexes);

      // 重新查询
      creatorIndexes = creatorIndexCache.query(indexQuery);
    }

    // 使用标签逻辑表达式进行过滤
    if (params.tagExpressions && params.tagExpressions.length > 0) {
      console.log('[CreatorQuery] 使用标签逻辑表达式进行过滤');
      const filteredIds = creatorIndexCache.queryByTagExpressions(params.tagExpressions);
      creatorIndexes = creatorIndexes.filter(index => filteredIds.includes(index.creatorId));
    }

    // 排除分类过滤
    if (excludeCategories.length > 0) {
      creatorIndexes = creatorIndexes.filter(index =>
        !excludeCategories.some(categoryId => index.categories.includes(categoryId))
      );
    }

    // 计算总数和分页
    const total = creatorIndexes.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageIndexes = creatorIndexes.slice(startIndex, endIndex);

    // 获取当前页的完整数据
    const creatorIds = pageIndexes.map(index => index.creatorId);

    // 先从缓存中获取
    const cachedCreators: Creator[] = [];
    const uncachedIds: string[] = [];

    creatorIds.forEach(id => {
      const cached = creatorDataCache.get(id);
      if (cached) {
        cachedCreators.push(cached);
      } else {
        uncachedIds.push(id);
      }
    });

    // 从数据库获取未缓存的数据
    let dbCreators: Creator[] = [];
    if (uncachedIds.length > 0) {
      const creatorsMap = await creatorRepo.getCreators(uncachedIds, platform);
      dbCreators = uncachedIds.map(id => creatorsMap.find(c => c.creatorId === id)).filter((c): c is Creator => c !== undefined);

      // 将新获取的数据存入缓存
      creatorDataCache.setBatch(dbCreators);
    }

    // 合并缓存和数据库数据，保持原始顺序
    const creators = creatorIds.map(id => {
      const cached = cachedCreators.find(c => c.creatorId === id);
      if (cached) return cached;
      return dbCreators.find(c => c.creatorId === id);
    }).filter((c): c is Creator => c !== undefined);

    const result: QueryResult<Creator> = {
      data: creators,
      total,
      page,
      pageSize,
      hasNext: page < totalPages - 1,
      hasPrev: page > 0
    };

    return result;
  } catch (error) {
    console.error('[CreatorQuery] Error searching creators:', error);
    throw new QueryError('搜索创作者失败', error as Error);
  }
}

/**
 * 获取单个创作者
 * @param creatorId 创作者ID
 * @param platform 平台
 * @param options 查询选项
 * @returns 创作者对象
 */
export async function getCreator(
  creatorId: string,
  platform: Platform,
  options: QueryOptions = {}
): Promise<Creator | undefined> {
  try {
    // 先从缓存中获取
    if (options.useCache !== false) {
      const cached = creatorDataCache.get(creatorId);
      if (cached) {
        return cached;
      }
    }

    // 从数据库获取数据
    const creator = await creatorRepo.getCreator(creatorId, platform);

    // 如果获取到数据，更新缓存
    if (creator && options.useCache !== false) {
      // 更新索引缓存
      const index = creatorToIndex(creator);
      creatorIndexCache.set(index);

      // 更新数据缓存
      creatorDataCache.set(creator);
    }

    return creator;
  } catch (error) {
    console.error('[CreatorQuery] Error getting creator:', error);
    throw new QueryError('获取创作者失败', error as Error);
  }
}

/**
 * 批量获取创作者
 * @param creatorIds 创作者ID列表
 * @param platform 平台
 * @param options 查询选项
 * @returns 创作者对象Map
 */
export async function getCreatorsByIds(
  creatorIds: string[],
  platform: Platform,
  options: QueryOptions = {}
): Promise<Map<string, Creator>> {
  try {
    const result = new Map<string, Creator>();

    for (const creatorId of creatorIds) {
      const creator = await getCreator(creatorId, platform, options);
      if (creator) {
        result.set(creatorId, creator);
      }
    }

    return result;
  } catch (error) {
    console.error('[CreatorQuery] Error getting creators by ids:', error);
    throw new QueryError('批量获取创作者失败', error as Error);
  }
}

/**
 * 获取创作者头像URL
 * @param creatorId 创作者ID
 * @param platform 平台
 * @param options 查询选项
 * @returns 头像URL
 */
export async function getAvatarUrl(
  creatorId: string,
  platform: Platform,
  options: QueryOptions = {}
): Promise<string | undefined> {
  try {
    const avatarUrl = await creatorRepo.getAvatarUrl(creatorId, platform);
    return avatarUrl;
  } catch (error) {
    console.error('[CreatorQuery] Error getting avatar url:', error);
    throw new QueryError('获取头像URL失败', error as Error);
  }
}

/**
 * 更新创作者标签权重
 * @param creatorId 创作者ID
 * @param platform 平台
 * @param tagWeights 标签权重列表
 * @returns 是否成功
 */
export async function updateTagWeights(
  creatorId: string,
  platform: Platform,
  tagWeights: Array<{
    tagId: string;
    source: 'user' | 'system';
    count: number;
    createdAt: number;
  }>
): Promise<boolean> {
  try {
    await creatorRepo.updateTagWeights(creatorId, platform, tagWeights);
    return true;
  } catch (error) {
    console.error('[CreatorQuery] Error updating tag weights:', error);
    throw new QueryError('更新标签权重失败', error as Error);
  }
}

/**
 * 获取已关注UP的数量
 * @param platform 平台
 * @returns 数量
 */
export async function getFollowedCount(platform: Platform): Promise<number> {
  try {
    return await creatorRepo.getFollowedCount(platform);
  } catch (error) {
    console.error('[CreatorQuery] Error getting followed count:', error);
    throw new QueryError('获取关注数量失败', error as Error);
  }
}

/**
 * 获取未关注UP的数量
 * @param platform 平台
 * @returns 数量
 */
export async function getUnfollowedCount(platform: Platform): Promise<number> {
  try {
    return await creatorRepo.getUnfollowedCount(platform);
  } catch (error) {
    console.error('[CreatorQuery] Error getting unfollowed count:', error);
    throw new QueryError('获取未关注数量失败', error as Error);
  }
}

/**
 * 获取标签使用计数
 * @param platform 平台
 * @returns 标签使用计数Map
 */
export async function getTagUsageCounts(platform: Platform): Promise<Map<string, number>> {
  try {
    return await creatorRepo.getTagUsageCounts(platform);
  } catch (error) {
    console.error('[CreatorQuery] Error getting tag usage counts:', error);
    throw new QueryError('获取标签使用计数失败', error as Error);
  }
}

/**
 * 清空创作者缓存
 */
export function clearCreatorCache(): void {
  creatorIndexCache.clear();
  creatorDataCache.clear();
}
