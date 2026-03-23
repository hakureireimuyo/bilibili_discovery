/**
 * TagRepository 实现（最终重构版）
 */

// 接口已移除，直接实现功能
import { Tag, TagStats } from '../types/semantic.js';
import { TagSource, PaginationParams, PaginationResult } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

export class TagRepository {

  /**
   * 名称规范化
   */
  private normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  /**
   * 创建标签（单个）
   */
  async createTag(tag: Omit<Tag, 'tagId'>): Promise<string> {
    const name = this.normalize(tag.name);

    const existing = await DBUtils.getOneByIndex<Tag>(
      STORE_NAMES.TAGS,
      'name',
      name
    );

    if (existing) return existing.tagId;

    const newTag: Tag = {
      tagId: crypto.randomUUID(),
      ...tag,
      name
    };

    try {
      await DBUtils.add(STORE_NAMES.TAGS, newTag);
      return newTag.tagId;
    } catch (err: any) {
      if (err.name === 'ConstraintError') {
        const existing = await DBUtils.getOneByIndex<Tag>(
          STORE_NAMES.TAGS,
          'name',
          name
        );
        if (existing) return existing.tagId;
      }
      throw err;
    }
  }

  /**
   * 使用指定ID创建标签
   */
  async createTagWithId(tag: Tag): Promise<void> {
    const name = this.normalize(tag.name);

    const existing = await DBUtils.getOneByIndex<Tag>(
      STORE_NAMES.TAGS,
      'name',
      name
    );

    if (existing) return;

    await DBUtils.add(STORE_NAMES.TAGS, {
      ...tag,
      name
    });
  }

  /**
   * 批量创建标签（自适应策略）
   */
  async createTags(tags: Omit<Tag, 'tagId'>[]): Promise<string[]> {
    if (tags.length < 100) {
      return this.createTagsByIndex(tags);
    } else {
      return this.createTagsByCursor(tags);
    }
  }

  /**
   * 小批量：index 查询版本
   */
  private async createTagsByIndex(tags: Omit<Tag, 'tagId'>[]): Promise<string[]> {
    const resultIds: string[] = [];

    for (const tag of tags) {
      const name = this.normalize(tag.name);

      const existing = await DBUtils.getOneByIndex<Tag>(
        STORE_NAMES.TAGS,
        'name',
        name
      );

      if (existing) {
        resultIds.push(existing.tagId);
      } else {
        const tagId = crypto.randomUUID();

        try {
          await DBUtils.add(STORE_NAMES.TAGS, {
            tagId,
            ...tag,
            name
          });
          resultIds.push(tagId);
        } catch (err: any) {
          if (err.name === 'ConstraintError') {
            const existing = await DBUtils.getOneByIndex<Tag>(
              STORE_NAMES.TAGS,
              'name',
              name
            );
            if (existing) resultIds.push(existing.tagId);
          } else {
            throw err;
          }
        }
      }
    }

    return resultIds;
  }

  /**
   * 大批量：cursor 优化版本
   */
  private async createTagsByCursor(tags: Omit<Tag, 'tagId'>[]): Promise<string[]> {
    const resultIds: string[] = [];

    // 1️⃣ 标准化 + 去重
    const normalizedMap = new Map<string, Omit<Tag, 'tagId'>>();

    for (const tag of tags) {
      const name = this.normalize(tag.name);
      if (!normalizedMap.has(name)) {
        normalizedMap.set(name, { ...tag, name });
      }
    }

    const targetNames = new Set(normalizedMap.keys());

    // 2️⃣ cursor 扫描 index
    const existingMap = new Map<string, Tag>();

    await DBUtils.cursor<Tag>(
      STORE_NAMES.TAGS,
      (value) => {
        const name = value.name;

        if (targetNames.has(name)) {
          existingMap.set(name, value);

          if (existingMap.size === targetNames.size) {
            return false;
          }
        }
      },
      'name'
    );

    // 3️⃣ 构建新增数据
    const newTags: Tag[] = [];

    for (const [name, tag] of normalizedMap.entries()) {
      const existing = existingMap.get(name);

      if (existing) {
        resultIds.push(existing.tagId);
      } else {
        const tagId = crypto.randomUUID();

        newTags.push({
          tagId,
          ...tag
        });

        resultIds.push(tagId);
      }
    }

    // 4️⃣ 批量写入
    if (newTags.length > 0) {
      try {
        await DBUtils.addBatch(STORE_NAMES.TAGS, newTags);
      } catch (err: any) {
        if (err.name === 'ConstraintError') {
          for (const tag of newTags) {
            try {
              await DBUtils.add(STORE_NAMES.TAGS, tag);
            } catch {
              // ignore
            }
          }
        } else {
          throw err;
        }
      }
    }

    return resultIds;
  }

  /**
   * 批量创建（带ID）
   */
  async createTagsWithIds(tags: Tag[]): Promise<string[]> {
    const createdIds: string[] = [];

    for (const tag of tags) {
      const name = this.normalize(tag.name);

      const existing = await DBUtils.getOneByIndex<Tag>(
        STORE_NAMES.TAGS,
        'name',
        name
      );

      if (!existing) {
        await DBUtils.add(STORE_NAMES.TAGS, {
          ...tag,
          name
        });
        createdIds.push(tag.tagId);
      }
    }

    return createdIds;
  }

  /**
   * 获取标签
   */
  async getTag(tagId: string): Promise<Tag | null> {
    return DBUtils.get<Tag>(STORE_NAMES.TAGS, tagId);
  }

  /**
   * 批量获取标签
   */
  async getTags(tagIds: string[]): Promise<Tag[]> {
    return DBUtils.getBatch<Tag>(STORE_NAMES.TAGS, tagIds);
  }

  /**
   * 通过名称查找
   */
  async findTagByName(name: string): Promise<Tag | null> {
    return DBUtils.getOneByIndex<Tag>(
      STORE_NAMES.TAGS,
      'name',
      this.normalize(name)
    );
  }

  /**
   * 搜索标签（前缀匹配）
   */
  async searchTags(
    keyword: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<Tag>> {

    const normalized = this.normalize(keyword);

    const range = IDBKeyRange.bound(
      normalized,
      normalized + '\uffff'
    );

    const items = await DBUtils.getByIndexRange<Tag>(
      STORE_NAMES.TAGS,
      'name',
      range
    );

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;

    return {
      items: items.slice(start, end),
      total: items.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(items.length / pagination.pageSize)
    };
  }

  /**
   * 获取所有标签
   */
  async getAllTags(source?: TagSource): Promise<Tag[]> {
    if (source !== undefined) {
      return DBUtils.getByIndex<Tag>(
        STORE_NAMES.TAGS,
        'source',
        source
      );
    }
    return DBUtils.getAll<Tag>(STORE_NAMES.TAGS);
  }

  /**
   * 更新标签
   */
  async updateTag(
    tagId: string,
    updates: Partial<Omit<Tag, 'tagId' | 'createdAt'>>
  ): Promise<void> {

    const existing = await this.getTag(tagId);
    if (!existing) throw new Error(`Tag not found: ${tagId}`);

    if (existing.source === 'system') {
      throw new Error('System tag cannot be modified');
    }

    if (updates.name) {
      const name = this.normalize(updates.name);

      const other = await DBUtils.getOneByIndex<Tag>(
        STORE_NAMES.TAGS,
        'name',
        name
      );

      if (other && other.tagId !== tagId) {
        throw new Error('Tag name already exists');
      }

      updates.name = name;
    }

    await DBUtils.put(STORE_NAMES.TAGS, {
      ...existing,
      ...updates
    });
  }

  /**
   * 删除标签
   */
  async deleteTag(tagId: string): Promise<void> {
    await DBUtils.delete(STORE_NAMES.TAGS, tagId);
  }

  /**
   * 标签统计（占位）
   */
  async getTagStats(tagId: string): Promise<TagStats | null> {
    return null;
  }

  /**
   * 批量统计（占位）
   */
  async getTagsStats(tagIds: string[]): Promise<TagStats[]> {
    return [];
  }

  /**
   * 热门标签（降级实现）
   */
  async getHotTags(limit: number = 100, source?: TagSource): Promise<Tag[]> {
    const tags = await this.getAllTags(source);
    return tags.slice(0, limit);
  }
}