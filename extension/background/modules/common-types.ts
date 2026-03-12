import { getFollowedUPs, getUPInfo, getUPVideos, getVideoTags } from "../../api/bili-api.js";
import { classifyUP } from "../../engine/classifier.js";
import { randomUP, randomVideo, recommendUP, recommendVideo, updateInterestFromWatch } from "../../engine/recommender.js";
import { saveUPList } from "../../storage/storage.js";

export const ALARM_UPDATE_UP_LIST = "update_up_list";
export const ALARM_CLASSIFY_UPS = "classify_ups";
export const ALARM_COLLECT_UP_PAGES = "collect_up_pages";

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

export interface BackgroundOptions {
  getFollowedUPsFn?: typeof getFollowedUPs;
  saveUPListFn?: typeof saveUPList;
  getValueFn?: (key: string) => Promise<unknown>;
  setValueFn?: (key: string, value: unknown) => Promise<void>;
  classifyUPFn?: typeof classifyUP;
  getUPVideosFn?: typeof getUPVideos;
  getVideoTagsFn?: typeof getVideoTags;
  getUPInfoFn?: typeof getUPInfo;
  recommendUPFn?: typeof recommendUP;
  recommendVideoFn?: typeof recommendVideo;
  updateInterestFromWatchFn?: typeof updateInterestFromWatch;
  randomUPFn?: typeof randomUP;
  randomVideoFn?: typeof randomVideo;
  tabs?: TabsManager;
  notifications?: NotificationManager;
  uid?: number;
  batchSize?: number;
  classifyWithPageDataFn?: (mid: number, pageData: any, existingTags: string[]) => Promise<string[]>;
  useAPIMethod?: boolean;
  maxVideos?: number;
}

export interface WatchProgressPayload {
  bvid: string;
  title: string;
  upMid?: number;
  tags: string[];
  watchedSeconds: number;
  duration: number;
  timestamp: number;
}

export interface WatchStats {
  totalSeconds: number;
  dailySeconds: Record<string, number>;
  upSeconds: Record<string, number>;
  videoSeconds: Record<string, number>;
  videoTitles: Record<string, string>;
  videoTags: Record<string, string[]>;
  videoUpIds: Record<string, number>;
  lastUpdate: number;
}
