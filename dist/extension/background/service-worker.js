/**
 * Background service worker initialization.
 */
import { ALARM_CLASSIFY_UPS, ALARM_COLLECT_UP_PAGES, ALARM_UPDATE_UP_LIST } from "./modules/common-types.js";
import { scheduleAlarms, handleAlarm } from "./modules/alarms.js";
import { classifyUpTask } from "./modules/classify-api.js";
import { classifyUPWithPageData, handleCollectionTabRemoved, handleUPPageCollected, startAutoClassification } from "./modules/classify-page.js";
import { handleMessage } from "./modules/messages.js";
import { updateUpListTask } from "./modules/up-list.js";
export { ALARM_CLASSIFY_UPS, ALARM_COLLECT_UP_PAGES, ALARM_UPDATE_UP_LIST };
export { scheduleAlarms, handleAlarm };
export { updateUpListTask };
export { classifyUpTask };
export { handleUPPageCollected, classifyUPWithPageData, startAutoClassification };
export { handleMessage };
export function initBackground() {
    console.log("[Background] Extension started");
    if (typeof chrome === "undefined" || !chrome.alarms) {
        console.log("[Background] Alarms unavailable");
    }
    else {
        scheduleAlarms(chrome.alarms);
        chrome.alarms.onAlarm.addListener((alarm) => {
            void handleAlarm(alarm);
        });
    }
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            void handleMessage(message)
                .then((result) => sendResponse(result))
                .catch(() => sendResponse(null));
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
