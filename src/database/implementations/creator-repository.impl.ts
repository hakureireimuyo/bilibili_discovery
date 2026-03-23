/**
 * CreatorRepository 实现
 * 实现创作者相关的数据库操作
 */

// 接口已移除，直接实现功能
import { Creator, CreatorStats } from '../types/creator.js';
import { Platform, PaginationParams, PaginationResult } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * CreatorRepository 实现类
 */
export class CreatorRepository {
  /**
   * 创建或更新创作者信息
   */
  async upsertCreator(creator: Creator): Promise<void> {
    await DBUtils.put(STORE_NAMES.CREATORS, creator);
  }

  /**
   * 批量创建或更新创作者信息
   */
  async upsertCreators(creators: Creator[]): Promise<void> {
    await DBUtils.putBatch(STORE_NAMES.CREATORS, creators);
  }

  /**
   * 获取创作者信息
   */
  async getCreator(creatorId: string, platform: Platform): Promise<Creator | null> {
    const creators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'creatorId',
      creatorId
    );
    return creators.find(c => c.platform === platform) || null;
  }

  /**
   * 获取多个创作者信息
   */
  async getCreators(creatorIds: string[], platform: Platform): Promise<Creator[]> {
    const allCreators = await DBUtils.getBatch<Creator>(
      STORE_NAMES.CREATORS,
      creatorIds
    );
    return allCreators.filter(c => c.platform === platform);
  }

  /**
   * 获取所有关注的创作者
   */
  async getFollowingCreators(platform: Platform): Promise<Creator[]> {
    const allCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'isFollowing',
      1
    );
    return allCreators
      .filter(c => c.platform === platform)
      .sort((a, b) => b.followTime - a.followTime);
  }

  /**
   * 获取指定平台的全部创作者
   */
  async getAllCreators(platform: Platform): Promise<Creator[]> {
    const allCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'platform',
      platform
    );

    return allCreators.sort((a, b) => b.followTime - a.followTime);
  }

  /**
   * 更新创作者关注状态
   */
  async updateFollowStatus(creatorId: string, platform: Platform, isFollowing: number): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    const updated: Creator = {
      ...creator,
      isFollowing,
      followTime: isFollowing ? Date.now() : creator.followTime
    };

    await this.upsertCreator(updated);
  }

  /**
   * 更新创作者标签权重
   */
  async updateTagWeights(
    creatorId: string,
    platform: Platform,
    tagWeights: Creator['tagWeights']
  ): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    // 合并现有标签权重
    const existingMap = new Map(
      creator.tagWeights.map(tw => [tw.tagId, tw])
    );

    tagWeights.forEach(tw => {
      const existing = existingMap.get(tw.tagId);
      if (existing) {
        // 如果已存在，合并计数
        existing.count += tw.count;
      } else {
        // 如果不存在，添加新标签
        existingMap.set(tw.tagId, tw);
      }
    });

    const updated: Creator = {
      ...creator,
      tagWeights: Array.from(existingMap.values())
    };

    await this.upsertCreator(updated);
  }

  /**
   * 获取创作者统计信息
   */
  async getCreatorStats(creatorId: string, platform: Platform): Promise<CreatorStats | null> {
    // TODO: 实现统计计算逻辑
    return null;
  }

  /**
   * 获取多个创作者的统计信息
   */
  async getCreatorsStats(creatorIds: string[], platform: Platform): Promise<CreatorStats[]> {
    // TODO: 实现批量统计计算逻辑
    return [];
  }

  /**
   * 获取创作者排名
   */
  async getCreatorRanking(platform: Platform, limit: number = 100): Promise<CreatorStats[]> {
    // TODO: 实现排名计算逻辑
    return [];
  }

  /**
   * 搜索创作者
   */
  async searchCreators(
    platform: Platform,
    keyword: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<Creator>> {
    const allCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'platform',
      platform
    );

    const filtered = allCreators.filter(creator =>
      creator.name.toLowerCase().includes(keyword.toLowerCase())
    );

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = filtered.slice(start, end);

    return {
      items,
      total: filtered.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(filtered.length / pagination.pageSize)
    };
  }

  /**
   * 删除创作者
   */
  async deleteCreator(creatorId: string, platform: Platform): Promise<void> {
    await DBUtils.delete(STORE_NAMES.CREATORS, creatorId);
  }

  /**
   * 标记创作者为已注销
   */
  async markCreatorAsLogout(creatorId: string, platform: Platform): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    const updated: Creator = {
      ...creator,
      isLogout: 1
    };

    await this.upsertCreator(updated);
  }

  /**
   * 获取所有创作者（不区分平台）
   */
  async getAllCreatorsNoFilter(): Promise<Creator[]> {
    return await DBUtils.getAll<Creator>(STORE_NAMES.CREATORS);
  }

  /**
   * 获取指定平台的创作者数量
   */
  async getCreatorCount(platform: Platform): Promise<number> {
    const creators = await this.getAllCreators(platform);
    return creators.length;
  }

  /**
   * 批量获取创作者标签权重
   */
  async getCreatorsTagWeights(platform: Platform): Promise<Record<string, Creator['tagWeights']>> {
    const creators = await this.getAllCreators(platform);
    return Object.fromEntries(
      creators.map(creator => [creator.creatorId, creator.tagWeights])
    );
  }

  /**
   * 根据关注状态获取创作者
   */
  async getCreatorsByFollowStatus(platform: Platform, isFollowing: boolean): Promise<Creator[]> {
    const allCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'isFollowing',
      isFollowing ? 1 : 0
    );
    return allCreators.filter(c => c.platform === platform);
  }

  /**
   * 按条件查询创作者
   */
  async searchCreatorsByFilter(
    platform: Platform,
    options: {
      isFollowing?: boolean;
      includeTags?: string[];
      excludeTags?: string[];
      includeCategories?: string[];
      excludeCategories?: string[];
      keyword?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<Creator[]> {
    // 获取所有符合平台的创作者
    let creators = await DBUtils.getByIndex<Creator>(STORE_NAMES.CREATORS, 'platform', platform);

    // 按关注状态过滤
    if (options.isFollowing !== undefined) {
      creators = creators.filter(c => c.isFollowing === (options.isFollowing ? 1 : 0));
    }

    // 按关键词搜索
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      creators = creators.filter(c => c.name.toLowerCase().includes(keyword));
    }

    // 如果没有标签或分类过滤条件，直接返回结果
    if (
      (!options.includeTags || options.includeTags.length === 0) &&
      (!options.excludeTags || options.excludeTags.length === 0) &&
      (!options.includeCategories || options.includeCategories.length === 0) &&
      (!options.excludeCategories || options.excludeCategories.length === 0)
    ) {
      // 应用分页
      const page = options.page ?? 0;
      const pageSize = options.pageSize ?? 100;
      const start = page * pageSize;
      const end = start + pageSize;
      return creators.slice(start, end);
    }

    // 需要获取分类信息以处理分类过滤
    const { CategoryRepository } = await import('./category-repository.impl.js');
    const categoryRepo = new CategoryRepository();
    const allCategories = await categoryRepo.getAllCategories();

    // 构建分类到标签的映射
    const categoryToTags = new Map<string, string[]>();
    for (const category of allCategories) {
      categoryToTags.set(category.id, category.tagIds);
    }

    // 过滤创作者
    const filteredCreators = creators.filter(creator => {
      // 提取创作者的用户标签
      const userTags = creator.tagWeights
        .filter(tw => tw.source === 'user')
        .map(tw => tw.tagId);

      // 检查是否包含所有必需标签
      if (options.includeTags && options.includeTags.length > 0) {
        const hasAllIncludeTags = options.includeTags.every(tag => userTags.includes(tag));
        if (!hasAllIncludeTags) {
          return false;
        }
      }

      // 检查是否不包含排除标签
      if (options.excludeTags && options.excludeTags.length > 0) {
        const hasExcludeTag = options.excludeTags.some(tag => userTags.includes(tag));
        if (hasExcludeTag) {
          return false;
        }
      }

      // 检查是否包含至少一个必需分类的标签
      if (options.includeCategories && options.includeCategories.length > 0) {
        const hasIncludeCategory = options.includeCategories.some(categoryId => {
          const categoryTags = categoryToTags.get(categoryId) || [];
          return categoryTags.some(tag => userTags.includes(tag));
        });
        if (!hasIncludeCategory) {
          return false;
        }
      }

      // 检查是否不包含排除分类的标签
      if (options.excludeCategories && options.excludeCategories.length > 0) {
        const hasExcludeCategory = options.excludeCategories.some(categoryId => {
          const categoryTags = categoryToTags.get(categoryId) || [];
          return categoryTags.some(tag => userTags.includes(tag));
        });
        if (hasExcludeCategory) {
          return false;
        }
      }

      return true;
    });

    // 应用分页
    const page = options.page ?? 0;
    const pageSize = options.pageSize ?? 100;
    const start = page * pageSize;
    const end = start + pageSize;
    return filteredCreators.slice(start, end);
  }

  /**
   * 获取已关注创作者数量
   */
  async getFollowedCount(platform: Platform): Promise<number> {
    const followedCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'isFollowing',
      1
    );
    return followedCreators.filter(c => c.platform === platform).length;
  }

  /**
   * 获取未关注创作者数量
   */
  async getUnfollowedCount(platform: Platform): Promise<number> {
    const unfollowedCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'isFollowing',
      0
    );
    return unfollowedCreators.filter(c => c.platform === platform).length;
  }

  /**
   * 获取标签使用次数统计
   */
  async getTagUsageCounts(platform: Platform): Promise<Map<string, number>> {
    const allCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'platform',
      platform
    );

    const tagCounts = new Map<string, number>();
    for (const creator of allCreators) {
      const userTags = creator.tagWeights
        .filter(tw => tw.source === 'user')
        .map(tw => tw.tagId);

      for (const tagId of userTags) {
        tagCounts.set(tagId, (tagCounts.get(tagId) ?? 0) + 1);
      }
    }

    return tagCounts;
  }

  /**
   * 获取创作者头像URL
   */
  async getAvatarUrl(creatorId: string, platform: Platform): Promise<string> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      return '';
    }

    // 如果已有avatarUrl，直接返回
    if (creator.avatarUrl) {
      return creator.avatarUrl;
    }

    // 如果是bilibili平台且avatarUrl为空，尝试通过API获取
    if (platform === 'bilibili') {
      try {
        const { getUPInfo } = await import('../../api/bili-api.js');
        const upInfo = await getUPInfo(parseInt(creatorId, 10));
        if (upInfo?.face) {
          // 更新数据库中的avatarUrl
          await this.updateAvatarUrl(creatorId, platform, upInfo.face);
          return upInfo.face;
        }
      } catch (error) {
        console.error(`[CreatorRepository] Failed to fetch avatar URL for ${creatorId}:`, error);
      }
    }

    return '';
  }

  /**
   * 更新创作者头像URL
   */
  async updateAvatarUrl(creatorId: string, platform: Platform, avatarUrl: string): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    const updated: Creator = {
      ...creator,
      avatarUrl
    };

    await this.upsertCreator(updated);
  }
}
