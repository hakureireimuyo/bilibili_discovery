/**
 * Background service worker initialization.
 */

import { DataProcessor } from '../content/processors/data-processor.js';

const dataProcessor = new DataProcessor();

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

export function initBackground(): void {
  console.log("[Background] Extension started");
  // if (typeof chrome === "undefined" || !chrome.alarms) {
  //   console.log("[Background] Alarms unavailable");
  // } else {
  //   scheduleAlarms(chrome.alarms);
  //   chrome.alarms.onAlarm.addListener((alarm) => {
  //     void handleAlarm(alarm);
  //   });
  // }

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
