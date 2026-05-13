/**
 * Background service worker initialization.
 */

import { DataProcessor } from '../content/processors/data-processor.js';
import { ImageRepositoryImpl, getValue, type AppSettings } from '../database/implementations/index.js';
import { refreshPopupSnapshotInBackground } from './popup-snapshot-refresh.js';

const dataProcessor = new DataProcessor();
const imageRepository = new ImageRepositoryImpl();
const IMAGE_CLEANUP_ALARM = "image-cache-cleanup";
const POPUP_SNAPSHOT_REFRESH_DELAY = 5000;

declare const chrome: {
  alarms?: {
    create: (name: string, alarmInfo: { when?: number; periodInMinutes?: number }) => void;
    onAlarm?: {
      addListener: (callback: (alarm: { name: string }) => void) => void;
    };
  };
  runtime?: {
    onMessage?: {
      addListener: (
        callback: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
      ) => void;
    };
  };
};

/**
 * 处理来自content script的消息
 */
async function handleMessage(message: any): Promise<any> {
  console.log('[Background] Handling message:', message);

  switch (message.type) {
    case 'VIDEO_DATA':
      await dataProcessor.processVideoData(message.payload);
      return { success: true };
    case 'WATCH_EVENT':
      await dataProcessor.processWatchEventData(message.payload);
      return { success: true };
    case 'FAVORITE_EVENT':
      await dataProcessor.processFavoriteEventData(message.payload);
      return { success: true };
    case 'LIKE_EVENT':
      await dataProcessor.processLikeEventData(message.payload);
      return { success: true };
    case 'SHARE_EVENT':
      await dataProcessor.processShareEventData(message.payload);
      return { success: true };
    case 'COIN_EVENT':
      await dataProcessor.processCoinEventData(message.payload);
      return { success: true };
    case 'UP_PAGE_DATA':
      await dataProcessor.processUPPageData(message.payload);
      return { success: true };
    case 'CREATOR_DATA':
      await dataProcessor.processCreatorData(message.payload);
      return { success: true };
    default:
      console.warn('[Background] Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

function getNextMidnightTimestamp(): number {
  const nextMidnight = new Date();
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime();
}

function scheduleImageCleanupAlarm(): void {
  if (typeof chrome === "undefined" || !chrome.alarms) {
    console.log("[Background] Alarms unavailable");
    return;
  }

  chrome.alarms.create(IMAGE_CLEANUP_ALARM, {
    when: getNextMidnightTimestamp(),
    periodInMinutes: 24 * 60
  });
}

async function handleImageCleanupAlarm(): Promise<void> {
  try {
    const settings = await getValue<Partial<AppSettings>>("settings");
    const retentionDays = settings?.imageCacheRetentionDays ?? 30;
    const expireTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const cleanedCount = await imageRepository.cleanupExpiredImages(expireTime);

    console.log("[Background] Image cache cleanup completed", {
      retentionDays,
      cleanedCount,
      expireTime
    });
  } catch (error) {
    console.error("[Background] Image cache cleanup failed:", error);
  }
}

async function handleAlarm(alarm: { name: string }): Promise<void> {
  if (alarm.name === IMAGE_CLEANUP_ALARM) {
    await handleImageCleanupAlarm();
  }
}

function schedulePopupSnapshotRefresh(): void {
  setTimeout(() => {
    refreshPopupSnapshotInBackground("startup-idle");
  }, POPUP_SNAPSHOT_REFRESH_DELAY);
}

export function initBackground(): void {
  console.log("[Background] Extension started");
  scheduleImageCleanupAlarm();
  schedulePopupSnapshotRefresh();
  if (typeof chrome !== "undefined" && chrome.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      void handleAlarm(alarm);
    });
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log("[Background] Received message:", message);
      void handleMessage(message)
        .then((result) => {
          console.log("[Background] Message handled, result:", result);
          sendResponse(result);
        })
        .catch((error) => {
          console.error("[Background] Message handling error:", error);
          sendResponse(null);
        });
      return true;
    });
  }

}

if (typeof chrome !== "undefined") {
  initBackground();
}
