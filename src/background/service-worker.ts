/**
 * Background service worker initialization.
 */

import {
  ALARM_CLASSIFY_UPS,
  ALARM_COLLECT_UP_PAGES,
  ALARM_UPDATE_UP_LIST,
  type AlarmManager,
  type RuntimeManager,
  type TabsManager
} from "./modules/types.js";
import { scheduleAlarms, handleAlarm } from "./modules/alarms.js";
import { classifyUpTask } from "./modules/classify-api.js";
import {
  classifyUPWithPageData,
  handleCollectionTabRemoved,
  handleUPPageCollected,
  startAutoClassification
} from "./modules/classify-page.js";
import { handleMessage } from "./modules/messages.js";
import { updateUpListTask } from "./modules/up-list.js";

export { ALARM_CLASSIFY_UPS, ALARM_COLLECT_UP_PAGES, ALARM_UPDATE_UP_LIST };
export { scheduleAlarms, handleAlarm };
export { updateUpListTask };
export { classifyUpTask };
export { handleUPPageCollected, classifyUPWithPageData, startAutoClassification };
export { handleMessage };

declare const chrome: {
  alarms?: AlarmManager;
  runtime?: RuntimeManager;
  tabs?: TabsManager;
};

export function initBackground(): void {
  console.log("[Background] Extension started");
  if (typeof chrome === "undefined" || !chrome.alarms) {
    console.log("[Background] Alarms unavailable");
  } else {
    scheduleAlarms(chrome.alarms);
    chrome.alarms.onAlarm.addListener((alarm) => {
      void handleAlarm(alarm);
    });
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      console.log("[Background] Received message:", message.type, message);
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

  if (typeof chrome !== "undefined" && chrome.tabs?.onRemoved) {
    chrome.tabs.onRemoved.addListener((tabId) => {
      handleCollectionTabRemoved(tabId);
    });
  }
}

if (typeof chrome !== "undefined") {
  initBackground();
}
