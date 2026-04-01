/**
 * DailyWatchStatsRepositoryImpl 实现
 * 实现每日观看统计相关的数据库操作
 * 专门针对IndexedDB优化，提供高效的增删改查方法
 */

import { DailyWatchStats } from '../types/daily-watch-stats.js';
import { Platform, PaginationParams, PaginationResult, ID } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * DailyWatchStatsRepositoryImpl 实现类
 * 专门针对IndexedDB优化，避免复杂条件查询过滤排序等低效操作
 */
export class DailyWatchStatsRepositoryImpl {
  /**
   * 创建或更新每日观看统计
   * 基于主键索引的创建或更新操作
   */
  async upsertStats(stats: DailyWatchStats): Promise<void> {
    await DBUtils.put(STORE_NAMES.DAILY_WATCH_STATS, stats);
  }

  /**
   * 批量创建或更新每日观看统计
   * 基于主键索引的批量创建或更新操作
   */
  async upsertStatsBatch(stats: DailyWatchStats[]): Promise<void> {
    await DBUtils.putBatch(STORE_NAMES.DAILY_WATCH_STATS, stats);
  }

  /**
   * 获取单个每日观看统计
   * 基于主键statsId的查询
   */
  async getStats(statsId: ID): Promise<DailyWatchStats | null> {
    return await DBUtils.get<DailyWatchStats>(STORE_NAMES.DAILY_WATCH_STATS, statsId);
  }

  /**
   * 根据日期键获取每日观看统计
   * @param dateKey 日期键，格式为 YYYY-MM-DD
   * @returns 每日观看统计，不存在返回 null
   */
  async getStatsByDateKey(dateKey: string): Promise<DailyWatchStats | null> {
    const stats = await DBUtils.getByIndex<DailyWatchStats>(
      STORE_NAMES.DAILY_WATCH_STATS,
      'dateKey',
      dateKey
    );
    return stats.length > 0 ? stats[0] : null;
  }

  /**
   * 根据日期键和平台获取每日观看统计
   * @param dateKey 日期键，格式为 YYYY-MM-DD
   * @param platform 平台类型
   * @returns 每日观看统计，不存在返回 null
   */
  async getStatsByDateKeyAndPlatform(dateKey: string, platform: Platform): Promise<DailyWatchStats | null> {
    const stats = await DBUtils.getByIndex<DailyWatchStats>(
      STORE_NAMES.DAILY_WATCH_STATS,
      'dateKey',
      dateKey
    );
    return stats.find(s => s.platform === platform) || null;
  }

  /**
   * 获取指定日期范围内的每日观看统计
   * @param startDate 开始日期键，格式为 YYYY-MM-DD
   * @param endDate 结束日期键，格式为 YYYY-MM-DD
   * @param platform 平台类型（可选）
   * @returns 每日观看统计数组
   */
  async getStatsByDateRange(
    startDate: string,
    endDate: string,
    platform?: Platform
  ): Promise<DailyWatchStats[]> {
    const allStats = await DBUtils.getByIndexRange<DailyWatchStats>(
      STORE_NAMES.DAILY_WATCH_STATS,
      'dateKey',
      IDBKeyRange.bound(startDate, endDate)
    );

    return platform ? allStats.filter(s => s.platform === platform) : allStats;
  }

  /**
   * 获取最近的N条每日观看统计
   * @param platform 平台类型
   * @param limit 返回数量限制
   * @returns 每日观看统计数组，按日期降序排列
   */
  async getRecentStats(platform: Platform, limit: number = 30): Promise<DailyWatchStats[]> {
    const results: DailyWatchStats[] = [];

    // 使用游标遍历，按日期键降序获取
    await DBUtils.cursor<DailyWatchStats>(
      STORE_NAMES.DAILY_WATCH_STATS,
      (value, cursor) => {
        if (value.platform === platform) {
          results.push(value);
          if (results.length >= limit) {
            return false;
          }
        }
        cursor.continue();
      },
      'dateKey',
      undefined,
      'prev' // 降序
    );

    return results;
  }

  /**
   * 获取指定平台的每日观看统计总数
   * @param platform 平台类型
   * @returns 统计记录数量
   */
  async getStatsCount(platform: Platform): Promise<number> {
    return await DBUtils.countByIndex(STORE_NAMES.DAILY_WATCH_STATS, 'platform', platform);
  }

  /**
   * 删除每日观看统计
   * 基于主键索引的删除操作
   */
  async deleteStats(statsId: ID): Promise<void> {
    await DBUtils.delete(STORE_NAMES.DAILY_WATCH_STATS, statsId);
  }

  /**
   * 根据日期键删除每日观看统计
   * @param dateKey 日期键，格式为 YYYY-MM-DD
   * @param platform 平台类型（可选）
   */
  async deleteStatsByDateKey(dateKey: string, platform?: Platform): Promise<void> {
    const stats = await DBUtils.getByIndex<DailyWatchStats>(
      STORE_NAMES.DAILY_WATCH_STATS,
      'dateKey',
      dateKey
    );

    const toDelete = platform ? stats.filter(s => s.platform === platform) : stats;
    const statsIds = toDelete.map(s => s.statsId);

    if (statsIds.length > 0) {
      await DBUtils.deleteBatch(STORE_NAMES.DAILY_WATCH_STATS, statsIds);
    }
  }

  /**
   * 增量更新每日观看统计
   * @param platform 平台类型
   * @param dateKey 日期键，格式为 YYYY-MM-DD
   * @param watchDurationDelta 观看时长增量（秒）
   * @param watchCountDelta 观看次数增量
   * @param completeWatchDelta 完整观看次数增量
   * @param creatorIds 观看的UP主ID列表（用于计算唯一UP主数量）
   * @param videoIds 观看的视频ID列表（用于计算唯一视频数量）
   * @param updateTime 更新时间
   */
  async updateStats(
    platform: Platform,
    dateKey: string,
    watchDurationDelta?: number,
    watchCountDelta?: number,
    completeWatchDelta?: number,
    creatorIds?: ID[],
    videoIds?: ID[],
    updateTime?: number
  ): Promise<void> {
    const existing = await this.getStatsByDateKeyAndPlatform(dateKey, platform);
    const now = updateTime || Date.now();

    if (!existing) {
      // 如果不存在，创建新记录
      const newStats: DailyWatchStats = {
        statsId: now,
        platform,
        dateKey,
        totalWatchDuration: watchDurationDelta || 0,
        totalWatchCount: watchCountDelta || 0,
        uniqueCreatorsCount: creatorIds ? new Set(creatorIds).size : 0,
        uniqueVideosCount: videoIds ? new Set(videoIds).size : 0,
        completeWatchCount: completeWatchDelta || 0,
        updateTime: now
      };

      await this.upsertStats(newStats);
      return;
    }

    // 更新现有记录
    const updated: DailyWatchStats = {
      ...existing,
      totalWatchDuration: existing.totalWatchDuration + (watchDurationDelta || 0),
      totalWatchCount: existing.totalWatchCount + (watchCountDelta || 0),
      completeWatchCount: existing.completeWatchCount + (completeWatchDelta || 0),
      uniqueCreatorsCount: creatorIds 
        ? new Set(creatorIds).size 
        : existing.uniqueCreatorsCount,
      uniqueVideosCount: videoIds 
        ? new Set(videoIds).size 
        : existing.uniqueVideosCount,
      updateTime: now
    };

    await this.upsertStats(updated);
  }

  /**
   * 记录观看事件
   * 增量更新观看时长和次数
   * @param platform 平台类型
   * @param dateKey 日期键，格式为 YYYY-MM-DD
   * @param watchDuration 观看时长（秒）
   * @param creatorIds 观看的UP主ID列表
   * @param videoIds 观看的视频ID列表
   * @param isComplete 是否完整观看
   */
  async recordWatch(
    platform: Platform,
    dateKey: string,
    watchDuration: number,
    creatorIds: ID[],
    videoIds: ID[],
    isComplete: boolean = false
  ): Promise<void> {
    await this.updateStats(
      platform,
      dateKey,
      watchDuration,
      1,
      isComplete ? 1 : 0,
      creatorIds,
      videoIds,
      Date.now()
    );
  }

  /**
   * 获取总观看时长
   * @param platform 平台类型
   * @param startDate 开始日期键（可选）
   * @param endDate 结束日期键（可选）
   * @returns 总观看时长（秒）
   */
  async getTotalWatchDuration(
    platform: Platform,
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    let stats: DailyWatchStats[];

    if (startDate && endDate) {
      stats = await this.getStatsByDateRange(startDate, endDate, platform);
    } else {
      stats = await DBUtils.getByIndex<DailyWatchStats>(
        STORE_NAMES.DAILY_WATCH_STATS,
        'platform',
        platform
      );
    }

    return stats.reduce((sum, s) => sum + s.totalWatchDuration, 0);
  }

  /**
   * 获取总观看次数
   * @param platform 平台类型
   * @param startDate 开始日期键（可选）
   * @param endDate 结束日期键（可选）
   * @returns 总观看次数
   */
  async getTotalWatchCount(
    platform: Platform,
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    let stats: DailyWatchStats[];

    if (startDate && endDate) {
      stats = await this.getStatsByDateRange(startDate, endDate, platform);
    } else {
      stats = await DBUtils.getByIndex<DailyWatchStats>(
        STORE_NAMES.DAILY_WATCH_STATS,
        'platform',
        platform
      );
    }

    return stats.reduce((sum, s) => sum + s.totalWatchCount, 0);
  }
}
