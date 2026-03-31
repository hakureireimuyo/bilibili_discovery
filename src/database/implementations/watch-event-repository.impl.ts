/**
 * WatchEventRepositoryImpl 实现
 * 实现观看事件相关的数据库操作
 */

// 接口已移除，直接实现功能
import { WatchEvent } from '../types/behavior.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';
import { generateId } from './id-generator.js';
import {ID} from '../types/base.js'
/**
 * WatchEventRepositoryImpl 实现类
 */
export class WatchEventRepositoryImpl {
  /**
   * 记录观看事件
   */
  async recordWatchEvent(event: Omit<WatchEvent, 'eventId'>): Promise<void> {
    const eventId = generateId();
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
      eventId: generateId(),
      ...event
    }));
    await DBUtils.addBatch(STORE_NAMES.WATCH_EVENTS, watchEvents);
  }

  /**
   * 获取观看事件
   */
  async getWatchEvent(eventId: ID): Promise<WatchEvent | null> {
    return DBUtils.get<WatchEvent>(STORE_NAMES.WATCH_EVENTS, eventId);
  }

  /**
   * 获取视频最近的观看事件
   * @param videoId 视频ID
   * @param maxInterval 最大间隔时间（毫秒），超过此时间则认为不是连续观看
   * @returns 最近的观看事件，如果不存在或超过最大间隔时间则返回null
   */
  async getRecentWatchEvent(videoId: ID, maxInterval: number = 30 * 60 * 1000): Promise<WatchEvent | null> {
    const allEvents = await DBUtils.getAll<WatchEvent>(STORE_NAMES.WATCH_EVENTS);
    const videoEvents = allEvents
      .filter(event => event.videoId === videoId)
      .sort((a, b) => b.endTime - a.endTime);

    if (videoEvents.length === 0) {
      return null;
    }

    const recentEvent = videoEvents[0];
    const now = Date.now();
    const interval = now - recentEvent.endTime;

    // 如果间隔时间小于最大间隔时间，返回最近的观看事件
    return interval < maxInterval ? recentEvent : null;
  }

  /**
   * 更新观看事件
   */
  async updateWatchEvent(eventId: ID, updates: Partial<Omit<WatchEvent, 'eventId' | 'videoId' | 'creatorId' | 'watchTime'>>): Promise<void> {
    const event = await this.getWatchEvent(eventId);
    if (!event) {
      throw new Error(`WatchEvent not found: ${eventId}`);
    }

    const updatedEvent: WatchEvent = {
      ...event,
      ...updates
    };

    await DBUtils.put(STORE_NAMES.WATCH_EVENTS, updatedEvent);
  }










}
