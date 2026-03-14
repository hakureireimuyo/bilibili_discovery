/**
 * CreatorRepository 实现
 * 实现创作者相关的数据库操作
 */

import { ICreatorRepository } from '../interfaces/creator/creator-repository.interface';
import { Creator, CreatorStats } from '../types/creator';
import { Platform, PaginationParams, PaginationResult } from '../types/base';
import { DBUtils, STORE_NAMES } from '../indexeddb';

/**
 * CreatorRepository 实现类
 */
export class CreatorRepository implements ICreatorRepository {
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
   * 更新创作者关注状态
   */
  async updateFollowStatus(creatorId: string, platform: Platform, isFollowing: boolean): Promise<void> {
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
      isLogout: true
    };

    await this.upsertCreator(updated);
  }
}
