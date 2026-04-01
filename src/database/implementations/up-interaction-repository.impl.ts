/**
 * UPInteractionRepositoryImpl 实现
 * 实现UP主交互相关的数据库操作
 * 专门针对IndexedDB优化，提供高效的增删改查方法
 */

import { UPInteraction, UPInteractionUpdate, UPStatSummary } from '../types/up-interaction.js';
import { Platform, PaginationParams, PaginationResult, ID } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * UPInteractionRepositoryImpl 实现类
 * 专门针对IndexedDB优化，避免复杂条件查询过滤排序等低效操作
 */
export class UPInteractionRepositoryImpl {
  /**
   * 创建或更新UP主交互数据
   * 基于主键索引的创建或更新操作
   */
  async upsertInteraction(interaction: UPInteraction): Promise<void> {
    await DBUtils.put(STORE_NAMES.UP_INTERACTIONS, interaction);
  }

  /**
   * 批量创建或更新UP主交互数据
   * 基于主键索引的批量创建或更新操作
   */
  async upsertInteractions(interactions: UPInteraction[]): Promise<void> {
    await DBUtils.putBatch(STORE_NAMES.UP_INTERACTIONS, interactions);
  }

  /**
   * 获取单个UP主交互数据
   * 基于主键creatorId的查询
   */
  async getInteraction(creatorId: ID): Promise<UPInteraction | null> {
    const interactions = await DBUtils.getByIndex<UPInteraction>(
      STORE_NAMES.UP_INTERACTIONS,
      'creatorId',
      creatorId
    );
    return interactions.length > 0 ? interactions[0] : null;
  }

  /**
   * 批量获取多个UP主交互数据
   * 基于主键索引的批量查询
   */
  async getInteractions(creatorIds: ID[]): Promise<UPInteraction[]> {
    return await DBUtils.getBatch<UPInteraction>(
      STORE_NAMES.UP_INTERACTIONS,
      creatorIds
    );
  }

  /**
   * 获取所有UP主交互数据
   * 仅用于数据导出等场景
   */
  async getAll(): Promise<UPInteraction[]> {
    return await DBUtils.getAll<UPInteraction>(STORE_NAMES.UP_INTERACTIONS);
  }

  /**
   * 获取指定平台的全部UP主交互数据
   * 基于platform索引的查询
   */
  async getAllByPlatform(platform: Platform): Promise<UPInteraction[]> {
    return await DBUtils.getByIndex<UPInteraction>(
      STORE_NAMES.UP_INTERACTIONS,
      'platform',
      platform
    );
  }

  /**
   * 获取分页后的UP主交互数据
   * 基于平台索引和游标的分页查询
   */
  async getPaginatedInteractions(
    platform: Platform,
    params: PaginationParams = { page: 1, pageSize: 20 }
  ): Promise<PaginationResult<UPInteraction>> {
    const { page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;
    let totalCount = 0;
    const results: UPInteraction[] = [];

    // 使用游标遍历实现分页，避免一次性获取全部数据
    await DBUtils.cursor<UPInteraction>(
      STORE_NAMES.UP_INTERACTIONS,
      (value, cursor) => {
        // 计总数
        totalCount++;

        // 跳过前面的数据
        if (cursor.primaryKey && typeof cursor.primaryKey === 'number' && cursor.primaryKey < offset) {
          cursor.continue();
          return;
        }

        // 收集当前页数据
        if (results.length < pageSize) {
          results.push(value);
          cursor.continue();
        } else {
          // 停止遍历
          return false;
        }
      },
      'platform',
      IDBKeyRange.only(platform)
    );

    return {
      items: results,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    };
  }

  /**
   * 获取按观看时长排序的Top N UP主
   * 基于totalWatchDuration索引的查询
   */
  async getTopByWatchDuration(
    platform: Platform,
    limit: number = 10
  ): Promise<UPInteraction[]> {
    const results: UPInteraction[] = [];

    // 使用游标遍历，按观看时长降序获取
    await DBUtils.cursor<UPInteraction>(
      STORE_NAMES.UP_INTERACTIONS,
      (value, cursor) => {
        results.push(value);
        if (results.length >= limit) {
          return false;
        }
        cursor.continue();
      },
      'totalWatchDuration',
      undefined,
      'prev' // 降序
    );

    return results.filter(i => i.platform === platform);
  }

  /**
   * 获取按观看次数排序的Top N UP主
   * 需要在内存中排序，因为IndexedDB不支持多字段索引
   */
  async getTopByWatchCount(
    platform: Platform,
    limit: number = 10
  ): Promise<UPInteraction[]> {
    const all = await this.getAllByPlatform(platform);
    return all
      .sort((a, b) => b.totalWatchCount - a.totalWatchCount)
      .slice(0, limit);
  }

  /**
   * 获取按互动率排序的Top N UP主
   * 互动率 = (点赞+投币+收藏)/观看次数
   */
  async getTopByInteractionRate(
    platform: Platform,
    limit: number = 10
  ): Promise<UPStatSummary[]> {
    const all = await this.getAllByPlatform(platform);

    return all
      .map(interaction => {
        const totalInteractions = interaction.likeCount + 
                            interaction.coinCount + 
                            interaction.favoriteCount;
        const interactionRate = interaction.totalWatchCount > 0 
          ? totalInteractions / interaction.totalWatchCount 
          : 0;

        return {
          creatorId: interaction.creatorId,
          totalWatchDuration: interaction.totalWatchDuration,
          totalWatchCount: interaction.totalWatchCount,
          likeCount: interaction.likeCount,
          coinCount: interaction.coinCount,
          favoriteCount: interaction.favoriteCount,
          commentCount: interaction.commentCount,
          lastWatchTime: interaction.lastWatchTime,
          firstWatchTime: interaction.firstWatchTime,
          interactionRate,
          avgWatchDuration: interaction.totalWatchCount > 0
            ? interaction.totalWatchDuration / interaction.totalWatchCount
            : 0
        };
      })
      .sort((a, b) => (b.interactionRate || 0) - (a.interactionRate || 0))
      .slice(0, limit);
  }

  /**
   * 增量更新UP主交互数据
   * 基于主键查询后更新
   */
  async updateInteraction(update: UPInteractionUpdate): Promise<void> {
    const existing = await this.getInteraction(update.creatorId);

    if (!existing) {
      // 如果不存在，创建新记录
      const now = Date.now();
      const newInteraction: UPInteraction = {
        interactionId: now,
        platform: Platform.BILIBILI, // 默认平台，实际应根据传入的creatorId确定
        creatorId: update.creatorId,
        totalWatchDuration: update.watchDurationDelta || 0,
        totalWatchCount: update.watchCountDelta || 0,
        likeCount: update.likeDelta || 0,
        coinCount: update.coinDelta || 0,
        favoriteCount: update.favoriteDelta || 0,
        commentCount: update.commentDelta || 0,
        lastWatchTime: update.watchTime || now,
        firstWatchTime: now,
        updateTime: now
      };

      await this.upsertInteraction(newInteraction);
      return;
    }

    // 更新现有记录
    const updated: UPInteraction = {
      ...existing,
      totalWatchDuration: existing.totalWatchDuration + (update.watchDurationDelta || 0),
      totalWatchCount: existing.totalWatchCount + (update.watchCountDelta || 0),
      likeCount: existing.likeCount + (update.likeDelta || 0),
      coinCount: existing.coinCount + (update.coinDelta || 0),
      favoriteCount: existing.favoriteCount + (update.favoriteDelta || 0),
      commentCount: existing.commentCount + (update.commentDelta || 0),
      lastWatchTime: update.watchTime || existing.lastWatchTime,
      updateTime: Date.now()
    };

    await this.upsertInteraction(updated);
  }

  /**
   * 批量增量更新UP主交互数据
   */
  async updateInteractions(updates: UPInteractionUpdate[]): Promise<void> {
    for (const update of updates) {
      await this.updateInteraction(update);
    }
  }

  /**
   * 记录观看事件
   * 增量更新观看时长和次数
   */
  async recordWatch(
    creatorId: ID,
    watchDuration: number,
    watchTime: number
  ): Promise<void> {
    await this.updateInteraction({
      creatorId,
      watchDurationDelta: watchDuration,
      watchCountDelta: 1,
      watchTime
    });
  }

  /**
   * 记录点赞事件
   */
  async recordLike(creatorId: ID): Promise<void> {
    await this.updateInteraction({
      creatorId,
      likeDelta: 1
    });
  }

  /**
   * 记录投币事件
   */
  async recordCoin(creatorId: ID): Promise<void> {
    await this.updateInteraction({
      creatorId,
      coinDelta: 1
    });
  }

  /**
   * 记录收藏事件
   */
  async recordFavorite(creatorId: ID): Promise<void> {
    await this.updateInteraction({
      creatorId,
      favoriteDelta: 1
    });
  }

  /**
   * 记录评论事件
   */
  async recordComment(creatorId: ID): Promise<void> {
    await this.updateInteraction({
      creatorId,
      commentDelta: 1
    });
  }

  /**
   * 删除UP主交互数据
   * 基于主键索引的删除操作
   */
  async deleteInteraction(creatorId: ID): Promise<void> {
    await DBUtils.delete(STORE_NAMES.UP_INTERACTIONS, creatorId);
  }

  /**
   * 获取指定平台的UP主数量
   * 基于platform索引的计数
   */
  async getInteractionCount(platform: Platform): Promise<number> {
    return await DBUtils.countByIndex(STORE_NAMES.UP_INTERACTIONS, 'platform', platform);
  }

  /**
   * 获取最近观看的UP主
   * 基于lastWatchTime索引的查询
   */
  async getRecentlyWatched(
    platform: Platform,
    limit: number = 10
  ): Promise<UPInteraction[]> {
    const results: UPInteraction[] = [];

    // 使用游标遍历，按最近观看时间降序获取
    await DBUtils.cursor<UPInteraction>(
      STORE_NAMES.UP_INTERACTIONS,
      (value, cursor) => {
        if (value.platform === platform) {
          results.push(value);
          if (results.length >= limit) {
            return false;
          }
        }
        cursor.continue();
      },
      'lastWatchTime',
      undefined,
      'prev' // 降序
    );

    return results;
  }
}
