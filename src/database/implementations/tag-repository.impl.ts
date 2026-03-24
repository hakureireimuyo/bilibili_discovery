/**
 * TagRepository 实现（针对IndexedDB优化版）
 * 专注于获取全部数据、分页获取数据、基于索引的增删改查以及特定数据结构特有的方法
 */

// 接口已移除，直接实现功能
import { Tag } from '../types/semantic.js';
import { TagSource, PaginationParams, PaginationResult } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

export class TagRepository {

  // ====== 创建操作 ======

  /**
   * 创建单个标签（只提供name）
   * 直接使用 put 插入数据,如果 name 冲突则返回已存在标签的 ID
   */
  async createTag(name: string, source: TagSource): Promise<string> {
    const tagId = crypto.randomUUID();
    const newTag: Tag = {
      tagId,
      name,
      source,
    };

    try {
      await DBUtils.put(STORE_NAMES.TAGS, newTag);
    } catch (error) {
      // 如果是 name 冲突,尝试获取已存在的标签
      if (error instanceof Error && error.name === 'ConstraintError') {
        const existing = await DBUtils.getOneByIndex<Tag>(
          STORE_NAMES.TAGS,
          'name',
          name
        );
        if (existing) {
          return existing.tagId;
        }
        throw error;
      }
      throw error;
    }

    return tagId;
  }

  /**
   * 创建单个标签（提供id和name）
   * 直接使用 put 插入数据,如果 name 冲突则返回已存在标签的 ID
   */
  async createTagWithId(id: string, name: string, source: TagSource): Promise<string> {
    const newTag: Tag = {
      tagId: id,
      name,
      source,
    };

    try {
      await DBUtils.put(STORE_NAMES.TAGS, newTag);
    } catch (error) {
      // 如果是 name 冲突,尝试获取已存在的标签
      if (error instanceof Error && error.name === 'ConstraintError') {
        const existing = await DBUtils.getOneByIndex<Tag>(
          STORE_NAMES.TAGS,
          'name',
          name
        );
        if (existing) {
          return existing.tagId;
        }
        throw error;
      }
      throw error;
    }

    return id;
  }

  /**
   * 批量创建标签（使用cursor优化）
   */
  async createTags(names: string[], source: TagSource): Promise<string[]> {
    if (names.length === 0) return [];
    
    // 输入去重
    const nameSet = new Set<string>(names);
    const uniqueNames = Array.from(nameSet);

    const resultIds: string[] = [];
    const tags: Tag[] = [];

    // 准备所有标签
    for (const name of uniqueNames) {
      const tagId = crypto.randomUUID();
      tags.push({ tagId, name, source });
      resultIds.push(tagId);
    }

    try {
      // 批量 put
      await DBUtils.putBatch(STORE_NAMES.TAGS, tags);
    } catch (error) {
      // 如果有冲突,回退到原来的实现
      return this.createTagsByCursor(names, source);
    }

    return resultIds;
  }

  /**
   * 大批量：cursor 优化版本
   * 处理输入数据可能重复的情况，同时保证高效的批量创建
   */
  private async createTagsByCursor(names: string[], source: TagSource): Promise<string[]> {
    if (names.length === 0) return [];

    // 1️⃣ 输入去重（处理输入数据可能重复的情况）
    const nameSet = new Set<string>(names);
    const uniqueNames = Array.from(nameSet);

    // 2️⃣ 使用游标扫描索引，查找数据库中已存在的标签
    const existingMap = new Map<string, Tag>();

    await DBUtils.cursor<Tag>(
      STORE_NAMES.TAGS,
      (value) => {
        const name = value.name;

        // 只处理目标标签
        if (nameSet.has(name)) {
          existingMap.set(name, value);

          // 如果找到所有匹配项，提前终止遍历
          if (existingMap.size === nameSet.size) {
            return false;
          }
        }
      },
      'name'
    );

    // 3️⃣ 构建结果：已存在标签直接返回ID，新标签准备批量插入
    const resultIds: string[] = [];
    const newTags: Tag[] = [];

    for (const name of uniqueNames) {
      const existing = existingMap.get(name);

      if (existing) {
        // 数据库中已存在，直接返回ID
        resultIds.push(existing.tagId);
      } else {
        // 新标签，准备批量插入
        const tagId = crypto.randomUUID();
        newTags.push({
          tagId,
          name,
          source: source
        });
        resultIds.push(tagId);
      }
    }

    // 4️⃣ 批量写入新标签（避免异常处理开销）
    if (newTags.length > 0) {
      // 分批写入以控制事务大小
      const BATCH_SIZE = 100;
      for (let i = 0; i < newTags.length; i += BATCH_SIZE) {
        const batch = newTags.slice(i, i + BATCH_SIZE);
        await DBUtils.addBatch(STORE_NAMES.TAGS, batch);
      }
    }

    return resultIds;
  }

  /**
   * 批量创建（带ID）
   * 处理输入数据可能重复的情况，同时保证高效的批量创建
   */
  async createTagsWithIds(tags: { id: string; name: string }[], source: TagSource): Promise<string[]> {
    if (tags.length === 0) return [];
  
    
    // 1️⃣ 输入去重（处理输入数据可能重复的情况）
    // 使用Map去重，保留每个名称对应的第一个ID
    const uniqueTags = new Map<string, { id: string; name: string }>();
    for (const tag of tags) {
      if (!uniqueTags.has(tag.name)) {
        uniqueTags.set(tag.name, { id: tag.id, name: tag.name });
      }
    }

    const targetNames = new Set(uniqueTags.keys());

    // 2️⃣ 使用游标扫描索引，查找数据库中已存在的标签
    const existingMap = new Map<string, Tag>();

    await DBUtils.cursor<Tag>(
      STORE_NAMES.TAGS,
      (value) => {
        const name = value.name;

        // 只处理目标标签
        if (targetNames.has(name)) {
          existingMap.set(name, value);

          // 如果找到所有匹配项，提前终止遍历
          if (existingMap.size === targetNames.size) {
            return false;
          }
        }
      },
      'name'
    );

    // 3️⃣ 构建结果：已存在标签直接返回ID，新标签准备批量插入
    const resultIds: string[] = [];
    const newTags: Tag[] = [];

    for (const [name, tag] of uniqueTags.entries()) {
      const existing = existingMap.get(name);

      if (existing) {
        // 数据库中已存在，直接返回ID
        resultIds.push(existing.tagId);
      } else {
        // 新标签，准备批量插入
        newTags.push({
          tagId: tag.id,
          name: tag.name,
          source: source
        });
        resultIds.push(tag.id);
      }
    }

    // 4️⃣ 批量写入新标签（避免异常处理开销）
    if (newTags.length > 0) {
      // 分批写入以控制事务大小
      const BATCH_SIZE = 100;
      for (let i = 0; i < newTags.length; i += BATCH_SIZE) {
        const batch = newTags.slice(i, i + BATCH_SIZE);
        await DBUtils.addBatch(STORE_NAMES.TAGS, batch);
      }
    }
    
    return resultIds;
  }

  // ====== 查询操作 ======

  /**
   * 获取标签
   */
  async getTag(tagId: string): Promise<Tag | null> {
    // 使用主键查询，这是IndexedDB最高效的查询方式
    return DBUtils.get<Tag>(STORE_NAMES.TAGS, tagId);
  }

  /**
   * 批量获取标签
   */
  async getTags(tagIds: string[]): Promise<Tag[]> {
    if (tagIds.length === 0) return [];
    
    // 使用批量获取优化性能
    return DBUtils.getBatch<Tag>(STORE_NAMES.TAGS, tagIds);
  }

  /**
   * 通过名称查找
   */
  async findTagByName(name: string): Promise<Tag | null> {
    // 使用索引查询，比全表扫描高效
    return DBUtils.getOneByIndex<Tag>(
      STORE_NAMES.TAGS,
      'name',
      name
    );
  }

  /**
   * 获取所有标签（分页）
   */
  async getAllTags(pagination?: PaginationParams): Promise<PaginationResult<Tag>> {
    // 获取所有数据
    const allTags = await DBUtils.getAll<Tag>(STORE_NAMES.TAGS);
    
    // 如果没有分页参数，返回全部数据
    if (!pagination) {
      return {
        items: allTags,
        total: allTags.length,
        page: 0,
        pageSize: allTags.length,
        totalPages: 1
      };
    }
    
    // 应用分页
    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const paginatedTags = allTags.slice(start, end);
    
    return {
      items: paginatedTags,
      total: allTags.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(allTags.length / pagination.pageSize)
    };
  }

  /**
   * 按来源获取标签（优化分版）
   * 使用游标实现高效分页，避免一次性加载所有数据
   */
  async getTagsBySource(source: TagSource, pagination?: PaginationParams): Promise<PaginationResult<Tag>> {
    if (!pagination) {
      // 如果没有分页参数，获取全部数据
      const tags = await DBUtils.getByIndex<Tag>(
        STORE_NAMES.TAGS,
        'source',
        source
      );
      
      return {
        items: tags,
        total: tags.length,
        page: 0,
        pageSize: tags.length,
        totalPages: 1
      };
    }
    
    // 使用游标实现高效分页
    const items: Tag[] = [];
    const skipCount = pagination.page * pagination.pageSize;
    let processedCount = 0;
    
    await DBUtils.cursor<Tag>(
      STORE_NAMES.TAGS,
      (value) => {
        // 只处理指定来源的标签
        if (value.source === source) {
          processedCount++;
          
          // 跳过前面的项
          if (processedCount > skipCount) {
            items.push(value);
            
            // 如果获取足够的项目，停止遍历
            if (items.length >= pagination.pageSize) {
              return false;
            }
          }
        }
      },
      'source'
    );
    
    // 计算总数（需要额外查询）
    const total = await DBUtils.countByIndex(STORE_NAMES.TAGS, 'source', source);
    
    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize)
    };
  }

  /**
   * 搜索标签（前缀匹配）
   */
  async searchTags(
    keyword: string,
    pagination?: PaginationParams
  ): Promise<PaginationResult<Tag>> {


    // 使用范围查询优化搜索性能
    const range = IDBKeyRange.bound(
      keyword,
      keyword + '\uffff'
    );

    // 使用索引获取匹配的标签
    const items = await DBUtils.getByIndexRange<Tag>(
      STORE_NAMES.TAGS,
      'name',
      range
    );
    
    // 如果没有分页参数，返回全部数据
    if (!pagination) {
      return {
        items,
        total: items.length,
        page: 0,
        pageSize: items.length,
        totalPages: 1
      };
    }
    
    // 应用分页
    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const paginatedItems = items.slice(start, end);
    
    return {
      items: paginatedItems,
      total: items.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(items.length / pagination.pageSize)
    };
  }
  // ====== 删除操作 ======

  /**
   * 删除标签
   */
  async deleteTag(tagId: string): Promise<boolean> {
    // 检查标签是否存在
    const existing = await this.getTag(tagId);
    if (!existing) return false;
    
    // 系统标签不可删除
    if (existing.source === 'system') {
      return false;
    }
    
    // 使用主键删除，这是最高效的删除方式
    await DBUtils.delete(STORE_NAMES.TAGS, tagId);
    return true;
  }

  /**
   * 批量删除标签
   */
  async deleteTags(tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    
    // 批量删除以提高性能
    await DBUtils.deleteBatch(STORE_NAMES.TAGS, tagIds);
  }

  // ====== 特定数据结构特有的方法 ======

  /**
   * 获取系统标签
   */
  async getSystemTags(pagination?: PaginationParams): Promise<PaginationResult<Tag>> {
    return this.getTagsBySource(TagSource.SYSTEM, pagination);
  }

  /**
   * 获取用户标签
   */
  async getUserTags(pagination?: PaginationParams): Promise<PaginationResult<Tag>> {
    return this.getTagsBySource(TagSource.USER, pagination);
  }

}