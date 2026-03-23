export const ALARM_UPDATE_UP_LIST = "update_up_list";
export const ALARM_CLASSIFY_UPS = "classify_ups";
export const ALARM_COLLECT_UP_PAGES = "collect_up_pages";
export const ALARM_DAILY_INTEREST = "daily_interest";
export const ALARM_WEEKLY_INTEREST = "weekly_interest";
export const ALARM_MONTHLY_INTEREST = "monthly_interest";

export interface AlarmLike {
  name: string;
}

export interface AlarmManager {
  create: (name: string, info: { periodInMinutes: number }) => void;
  onAlarm: { addListener: (handler: (alarm: AlarmLike) => void) => void };
}

export interface MessageLike {
  type: string;
  payload?: unknown;
}

export interface TabsManager {
  update: (tabId: number | undefined, updateProperties: { url: string }) => void;
  query?: (queryInfo: { active?: boolean; currentWindow?: boolean; url?: string }) => Promise<{ id?: number; url?: string }[]>;
  sendMessage?: (tabId: number, message: unknown) => Promise<unknown>;
  create?: (createProperties: { url: string; active?: boolean }) => Promise<{ id?: number } | undefined>;
  remove?: (tabId: number | number[]) => Promise<void>;
  onRemoved?: { addListener: (handler: (tabId: number) => void) => void };
}

/**
 * 浏览器标签页操作选项
 * 专门用于标签页创建、更新、关闭等操作
 */
export interface TabOptions {
  /**
   * 标签页管理器实例
   */
  tabs?: TabsManager;
  /**
   * 是否激活新创建的标签页
   */
  active?: boolean;
  /**
   * 标签页URL
   */
  url?: string;
}

export interface RuntimeManager {
  onMessage: {
    addListener: (
      handler: (
        message: MessageLike,
        sender: unknown,
        sendResponse: (response?: unknown) => void
      ) => void
    ) => void;
  };
  sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
  getURL?: (path: string) => string;
}

export interface NotificationManager {
  create: (options: {
    type: string;
    iconUrl: string;
    title: string;
    message: string;
  }) => void;
}


export interface WatchProgressPayload {
  bvid: string;
  title: string;
  upMid?: number;
  upName?: string;
  upFace?: string;
  tags: string[];
  watchedSeconds: number;
  currentTime?: number;
  duration: number;
  timestamp: number;
}

export interface WatchStats {
  totalSeconds: number;
  dailySeconds: Record<string, number>;
  upSeconds: Record<string, number>;
  videoSeconds: Record<string, number>;
  videoTitles: Record<string, string>;
  videoTags: Record<string, string[]>; // 存储标签ID数组
  videoUpIds: Record<string, number>;
  videoWatchCount: Record<string, number>;
  videoFirstWatched: Record<string, number>;
  videoCreatedAt?: Record<string, number>; // 视频记录创建时间戳
  lastUpdate: number;
}
