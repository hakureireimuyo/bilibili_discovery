/**
 * WatchEventRepository 实现
 * 实现观看事件相关的数据库操作
 */

// 接口已移除，直接实现功能
import { WatchEvent, BehaviorSummary } from '../types/behavior.js';
import { Platform, PaginationParams, PaginationResult, TimeRange } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * WatchEventRepository 实现类
 */
export class WatchEventRepository {
  /**
   * 记录观看事件
   */
  async recordWatchEvent(event: Omit<WatchEvent, 'eventId'>): Promise<void> {
    const eventId = `watch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const watchEvent: WatchEvent = {
      eventId,
      ...event
    };
    await DBUtils.add(STORE_NAMES.WATCH_EVENTS, watchEvent);
  }

  /**
   * 批量记录观看事件
   */
  async recordWatchEvents(events: Omit<WatchEvent, 'eventId'>[]): Promise<void> {
    const watchEvents: WatchEvent[] = events.map(event => ({
      eventId: `watch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      ...event
    }));
    await DBUtils.addBatch(STORE_NAMES.WATCH_EVENTS, watchEvents);
  }

  /**
   * 获取观看事件
   */
  async getWatchEvent(eventId: string): Promise<WatchEvent | null> {
    return DBUtils.get<WatchEvent>(STORE_NAMES.WATCH_EVENTS, eventId);
  }

  /**
   * 获取视频的观看记录
   */
  async getVideoWatchEvents(
    videoId: string,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<WatchEvent>> {
    const allEvents = await DBUtils.getByIndex<WatchEvent>(
      STORE_NAMES.WATCH_EVENTS,
      'videoId',
      videoId
    );

    const filtered = allEvents.filter(e => e.platform === platform);
    const sorted = filtered.sort((a, b) => b.watchTime - a.watchTime);

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      total: sorted.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(sorted.length / pagination.pageSize)
    };
  }

  /**
   * 获取创作者的观看记录
   */
  async getCreatorWatchEvents(
    creatorId: string,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<WatchEvent>> {
    const allEvents = await DBUtils.getByIndex<WatchEvent>(
      STORE_NAMES.WATCH_EVENTS,
      'creatorId',
      creatorId
    );

    const filtered = allEvents.filter(e => e.platform === platform);
    const sorted = filtered.sort((a, b) => b.watchTime - a.watchTime);

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      total: sorted.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(sorted.length / pagination.pageSize)
    };
  }

  /**
   * 按时间范围获取观看记录
   */
  async getWatchEventsByTimeRange(
    timeRange: TimeRange,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<WatchEvent>> {
    const allEvents = await DBUtils.getByIndex<WatchEvent>(
      STORE_NAMES.WATCH_EVENTS,
      'platform',
      platform
    );

    const filtered = allEvents.filter(e =>
      e.watchTime >= timeRange.startTime &&
      e.watchTime <= timeRange.endTime
    );

    const sorted = filtered.sort((a, b) => b.watchTime - a.watchTime);

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      total: sorted.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(sorted.length / pagination.pageSize)
    };
  }

  /**
   * 获取观看统计汇总
   */
  async getWatchSummary(
    timeRange: TimeRange,
    platform: Platform
  ): Promise<BehaviorSummary> {
    const allEvents = await DBUtils.getByIndex<WatchEvent>(
      STORE_NAMES.WATCH_EVENTS,
      'platform',
      platform
    );

    const filtered = allEvents.filter(e =>
      e.watchTime >= timeRange.startTime &&
      e.watchTime <= timeRange.endTime
    );

    const totalWatchCount = filtered.length;
    const totalWatchTime = filtered.reduce((sum, e) => sum + e.watchDuration, 0);

    const uniqueCreators = new Set(filtered.map(e => e.creatorId)).size;
    const uniqueVideos = new Set(filtered.map(e => e.videoId)).size;
    const completeWatchCount = filtered.filter(e => e.isComplete).length;

    return {
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      totalWatchCount,
      totalWatchTime,
      totalInteractionCount: 0,
      totalSearchCount: 0,
      watchedCreatorCount: uniqueCreators,
      watchedVideoCount: uniqueVideos,
      completeWatchCount
    };
  }

  /**
   * 获取所有观看事件
   */
  async getAllWatchEvents(): Promise<WatchEvent[]> {
    return DBUtils.getAll<WatchEvent>(STORE_NAMES.WATCH_EVENTS);
  }
}
