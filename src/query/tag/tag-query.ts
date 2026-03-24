/**
 * 标签查询实现
 * 基于src/cache和src/database/implementations实现
 */

import type { Tag } from '../../database/types/semantic.js';
import type { QueryResult, QueryOptions, TagQueryParams } from '../types.js';
import { TagRepository } from '../../database/implementations/tag-repository.impl.js';
import { QueryError } from '../types.js';
import { TagSource } from '../../database/types/base.js';

// 创建Repository实例
const tagRepo = new TagRepository();

/**
 * 获取所有标签
 * @param params 查询参数
 * @param options 查询选项
 * @returns 查询结果
 */
export async function getAllTags(
  params: TagQueryParams = {},
  options: QueryOptions = {}
): Promise<QueryResult<Tag>> {
  try {
    // 检查缓存
    const cacheKey = `tags:all:${params.source || 'all'}`;
    if (options.useCache !== false) {
      // 这里可以添加缓存逻辑
    }

    // 从数据库获取数据
    const tagsResult = await tagRepo.getAllTags();
    let tags = tagsResult.items;

    // 应用过滤条件
    if (params.source) {
      tags = tags.filter(tag => tag.source === params.source);
    }

    // 计算分页
    const page = params.page || 0;
    const pageSize = params.pageSize || 50;
    const total = tags.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const pageTags = tags.slice(startIndex, endIndex);

    const result: QueryResult<Tag> = {
      data: pageTags,
      total,
      page,
      pageSize,
      hasNext: page < totalPages - 1,
      hasPrev: page > 0
    };

    return result;
  } catch (error) {
    console.error('[TagQuery] Error getting all tags:', error);
    throw new QueryError('获取标签列表失败', error as Error);
  }
}

/**
 * 根据ID获取标签
 * @param tagId 标签ID
 * @param options 查询选项
 * @returns 标签对象
 */
export async function getTagById(
  tagId: string,
  options: QueryOptions = {}
): Promise<Tag | undefined> {
  try {
    // 检查缓存
    if (options.useCache !== false) {
      // 这里可以添加缓存逻辑
    }

    // 从数据库获取数据
    const tag = await tagRepo.getTag(tagId);
    return tag ?? undefined;
  } catch (error) {
    console.error('[TagQuery] Error getting tag by id:', error);
    throw new QueryError('获取标签失败', error as Error);
  }
}

/**
 * 根据ID列表批量获取标签
 * @param tagIds 标签ID列表
 * @param options 查询选项
 * @returns 标签对象Map
 */
export async function getTagsByIds(
  tagIds: string[],
  options: QueryOptions = {}
): Promise<Map<string, Tag>> {
  try {
    const result = new Map<string, Tag>();

    for (const tagId of tagIds) {
      const tag = await getTagById(tagId, options);
      if (tag) {
        result.set(tagId, tag);
      }
    }

    return result;
  } catch (error) {
    console.error('[TagQuery] Error getting tags by ids:', error);
    throw new QueryError('批量获取标签失败', error as Error);
  }
}

/**
 * 创建标签
 * @param params 标签参数
 * @returns 标签ID
 */
export async function createTag(params: {
  name: string;
  source: TagSource;
  createdAt: number;
}): Promise<string> {
  try {
    const { name, source } = params;
    const tagId = await tagRepo.createTag(name, source);
    return tagId;
  } catch (error) {
    console.error('[TagQuery] Error creating tag:', error);
    throw new QueryError('创建标签失败', error as Error);
  }
}

/**
 * 删除标签
 * @param tagId 标签ID
 * @returns 是否成功
 */
export async function deleteTag(tagId: string): Promise<boolean> {
  try {
    const success = await tagRepo.deleteTag(tagId);
    return success;
  } catch (error) {
    console.error('[TagQuery] Error deleting tag:', error);
    throw new QueryError('删除标签失败', error as Error);
  }
}

/**
 * 搜索标签
 * @param keyword 关键词
 * @param params 查询参数
 * @param options 查询选项
 * @returns 查询结果
 */
export async function searchTags(
  keyword: string,
  params: TagQueryParams = {},
  options: QueryOptions = {}
): Promise<QueryResult<Tag>> {
  try {
    // 获取所有标签
    const allTags = await getAllTags(params, options);

    // 应用关键词过滤
    const lowerKeyword = keyword.toLowerCase();
    const filteredTags = allTags.data.filter(tag =>
      tag.name.toLowerCase().includes(lowerKeyword)
    );

    return {
      ...allTags,
      data: filteredTags,
      total: filteredTags.length
    };
  } catch (error) {
    console.error('[TagQuery] Error searching tags:', error);
    throw new QueryError('搜索标签失败', error as Error);
  }
}

/**
 * 清空标签缓存
 */
export function clearTagCache(): void {
  // 这里可以添加清空缓存的逻辑
}
