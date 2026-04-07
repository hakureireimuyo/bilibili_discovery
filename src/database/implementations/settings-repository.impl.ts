
/**
 * Settings Repository Implementation
 * 实现应用设置的存储和读取
 */

import { DBUtils, STORE_NAMES } from "../indexeddb/index.js";

/**
 * 应用设置接口
 */
export interface AppSettings {
  /**
   * 缓存时间（小时）
   */
  cacheHours: number;
  /**
   * 用户UID
   */
  userId: number | null;
  /**
   * API基础URL
   */
  apiBaseUrl: string;
  /**
   * API模型名称
   */
  apiModel: string;
  /**
   * API密钥
   */
  apiKey: string;
  /**
   * 图片缓存保留天数
   */
  imageCacheRetentionDays: 7 | 30 | 180 | 365;
  /**
   * 获取视频标签的间隔时间（毫秒）
   */
  tagFetchInterval: number;
  /**
   * API请求最小间隔（毫秒）
   */
  apiMinInterval: number;
  /**
   * API请求最大间隔（毫秒）
   */
  apiMaxInterval: number;
  /**
   * 获取UP主视频的最大数量
   */
  maxVideosToFetch: number;
}

interface SettingsRecord<T = unknown> {
  key: string;
  value: T;
  updatedAt: number;
}

/**
 * 获取设置值
 * @param key 设置键名
 * @returns 设置值
 */
export async function getValue<T>(key: string): Promise<T | null> {
  try {
    const record = await DBUtils.get<SettingsRecord<T>>(STORE_NAMES.APP_META, key);
    return record?.value ?? null;
  } catch (error) {
    console.error(`[SettingsRepository] Error getting value for key "${key}":`, error);
    return null;
  }
}

/**
 * 设置值
 * @param key 设置键名
 * @param value 设置值
 */
export async function setValue<T>(key: string, value: T): Promise<void> {
  try {
    await DBUtils.put<SettingsRecord<T>>(STORE_NAMES.APP_META, {
      key,
      value,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error(`[SettingsRepository] Error setting value for key "${key}":`, error);
    throw error;
  }
}

/**
 * 删除设置值
 * @param key 设置键名
 */
export async function deleteValue(key: string): Promise<void> {
  try {
    await DBUtils.delete(STORE_NAMES.APP_META, key);
  } catch (error) {
    console.error(`[SettingsRepository] Error deleting value for key "${key}":`, error);
    throw error;
  }
}
