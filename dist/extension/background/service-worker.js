/**
 * Background service worker initialization.
 */
import { getFollowedUPs, getUPInfo, getUPVideos, getVideoTags } from "../api/bili-api.js";
import { classifyUP } from "../engine/classifier.js";
import { randomUP, randomVideo, recommendUP, recommendVideo, updateInterestFromWatch } from "../engine/recommender.js";
import { getValue, saveUPList, setValue } from "../storage/storage.js";
import { chatComplete, parseTagsFromContent } from "../engine/llm-client.js";
export const ALARM_UPDATE_UP_LIST = "update_up_list";
export const ALARM_CLASSIFY_UPS = "classify_ups";
export const ALARM_COLLECT_UP_PAGES = "collect_up_pages";
/**
 * Schedule periodic alarms.
 */
export function scheduleAlarms(alarms) {
    console.log("[Background] Schedule alarms");
    alarms.create(ALARM_UPDATE_UP_LIST, { periodInMinutes: 24 * 60 });
    alarms.create(ALARM_CLASSIFY_UPS, { periodInMinutes: 7 * 24 * 60 });
}
/**
 * Update followed UP list.
 */
export async function updateUpListTask(options = {}) {
    const getFollowedUPsFn = options.getFollowedUPsFn ?? getFollowedUPs;
    const saveUPListFn = options.saveUPListFn ?? saveUPList;
    const getValueFn = options.getValueFn ?? ((key) => getValue(key));
    const settings = (await getValueFn("settings"));
    const uid = options.uid ?? (await getValueFn("userId")) ?? settings?.userId;
    const uidValue = typeof uid === "number" ? uid : Number(uid);
    if (!uidValue || Number.isNaN(uidValue)) {
        console.warn("[Background] Missing userId for update");
        return false;
    }
    const upList = await getFollowedUPsFn(uidValue);
    await saveUPListFn(upList);
    console.log("[Background] Updated UP list", upList.length);
    return true;
}
/**
 * Classify UPs in batches and store tags.
 */
export async function classifyUpTask(options = {}) {
    const classifyUPFn = options.classifyUPFn ?? classifyUP;
    const getValueFn = options.getValueFn ?? ((key) => getValue(key));
    const setValueFn = options.setValueFn ?? ((key, value) => setValue(key, value));
    const batchSize = options.batchSize ?? 10;
    const cache = (await getValueFn("upList"));
    const list = cache?.upList ?? [];
    if (list.length === 0) {
        console.log("[Background] No UPs to classify");
        return 0;
    }
    const upTags = (await getValueFn("upTags")) ?? {};
    const videoCounts = (await getValueFn("videoCounts")) ?? {};
    const batch = list;
    let processed = 0;
    for (let i = 0; i < batch.length; i += batchSize) {
        const chunk = batch.slice(i, i + batchSize);
        for (const up of chunk) {
            const existing = upTags[String(up.mid)] ?? [];
            console.log("[Background] Classify UP", up.mid, {
                existingTags: existing.length
            });
            const profile = await classifyUPFn(up.mid, {
                existingTags: existing,
                getUPVideosFn: (mid) => getUPVideos(mid, { fallbackRequest: proxyApiRequest }),
                getUPInfoFn: (mid) => getUPInfo(mid, { fallbackRequest: proxyApiRequest }),
                getVideoTagsFn: (bvid) => getVideoTags(bvid, { fallbackRequest: proxyApiRequest })
            });
            upTags[String(up.mid)] = profile.tags;
            videoCounts[String(up.mid)] = profile.videoCount ?? 0;
            processed += 1;
        }
    }
    await setValueFn("upTags", upTags);
    await setValueFn("videoCounts", videoCounts);
    await setValueFn("classifyStatus", { lastUpdate: Date.now() });
    console.log("[Background] Classified UPs", processed);
    return processed;
}
/**
 * Handle alarm events.
 */
export async function handleAlarm(alarm, options = {}) {
    if (alarm.name === ALARM_UPDATE_UP_LIST) {
        await updateUpListTask(options);
        return;
    }
    if (alarm.name === ALARM_CLASSIFY_UPS) {
        await classifyUpTask(options);
    }
}
function toVideoUrl(bvid) {
    return `https://www.bilibili.com/video/${bvid}`;
}
function toUpUrl(mid) {
    return `https://space.bilibili.com/${mid}`;
}
// Store collected page data temporarily
const collectedPageData = new Map();
// Track classification queue and status
const classificationQueue = [];
let isClassifying = false;
/**
 * Handle UP page data collection from content script
 */
export async function handleUPPageCollected(message, options = {}) {
    const payload = message.payload;
    if (!payload?.mid) {
        console.warn("[Background] Invalid UP page data", payload);
        return;
    }
    console.log("[Background] UP page data collected:", {
        mid: payload.mid,
        name: payload.name,
        sign: payload.sign,
        videoCount: payload.videos?.length ?? 0
    });
    console.log("[Background] Classification queue:", classificationQueue);
    console.log("[Background] Current UP being classified:", classificationQueue[0]);
    // Check if UP is invalid (no name and no videos)
    if (!payload.name && (!payload.videos || payload.videos.length === 0)) {
        console.log("[Background] UP", payload.mid, "appears to be invalid, skipping...");
        // Remove from queue
        const queueIndex = classificationQueue.indexOf(payload.mid);
        if (queueIndex !== -1) {
            classificationQueue.splice(queueIndex, 1);
        }
        collectedPageData.delete(payload.mid);
        // If this was the current UP, process next one
        if (classificationQueue.length > 0) {
            const nextMid = classificationQueue[0];
            console.log("[Background] Moving to next UP:", nextMid);
            const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
            if (tabs) {
                // Get all tabs, excluding DevTools windows
                const allTabs = await tabs.query?.({}) ?? [];
                // Find a non-DevTools window with an active tab
                const targetTab = allTabs.find(tab => !tab.url?.startsWith("devtools://"));
                if (targetTab?.id) {
                    tabs.update(targetTab.id, { url: toUpUrl(nextMid) });
                }
            }
        }
        return;
    }
    collectedPageData.set(payload.mid, payload);
    // If we have data for the current UP being classified, process it
    if (classificationQueue.length > 0 && classificationQueue[0] === payload.mid) {
        console.log("[Background] Data matches current UP, processing classification...");
        await processNextClassification(options);
    }
    else {
        console.log("[Background] Data does not match current UP, waiting...");
    }
}
/**
 * Classify UP using page data instead of API
 */
export async function classifyUPWithPageData(mid, pageData, existingTags = [], options = {}) {
    const classifyWithPageDataFn = options.classifyWithPageDataFn ?? defaultClassifyWithPageData;
    return classifyWithPageDataFn(mid, pageData, existingTags);
}
/**
 * Default implementation of classifyUPWithPageData
 */
async function defaultClassifyWithPageData(mid, pageData, existingTags = []) {
    console.log("[Background] Starting LLM classification for UP:", mid);
    console.log("[Background] UP name:", pageData.name);
    console.log("[Background] UP sign:", pageData.sign);
    console.log("[Background] Existing tags:", existingTags);
    // Use page text content for classification
    const pageText = pageData.pageText ?? "";
    const titles = pageData.videos?.slice(0, 10).map((v) => v.title) ?? [];
    console.log("[Background] Page text length:", pageText.length);
    console.log("[Background] Page text preview:", pageText.substring(0, 500));
    console.log("[Background] Video titles for classification:", titles);
    const existing = existingTags.length > 0 ? existingTags.join("、") : "无";
    const prompt = [
        "You are a content classifier.",
        "Return a JSON array of 3 to 5 short Chinese tags.",
        "Prefer existing tags when appropriate and avoid near-duplicate synonyms.",
        `UP: ${pageData.name}`,
        `Bio: ${pageData.sign}`,
        `Existing tags: ${existing}`,
        `Page content (first 2000 chars): ${pageText.substring(0, 2000)}`,
        `Video titles: ${titles.join(" | ")}`
    ].join("\n");
    console.log("[Background] Sending prompt to LLM...");
    console.log("[Background] Prompt:", prompt);
    const content = await chatComplete([
        { role: "system", content: "Classify Bilibili UP content into tags." },
        { role: "user", content: prompt }
    ]);
    if (!content) {
        console.log("[Background] LLM empty response for UP:", mid);
        return [];
    }
    console.log("[Background] LLM raw response for UP", mid, ":", content);
    const tags = parseTagsFromContent(content);
    console.log("[Background] Parsed tags for UP", mid, ":", tags);
    return tags;
}
/**
 * Process next UP in classification queue
 */
async function processNextClassification(options = {}) {
    if (isClassifying) {
        console.log("[Background] Already classifying, skipping...");
        return;
    }
    if (classificationQueue.length === 0) {
        console.log("[Background] Classification queue is empty, all done!");
        return;
    }
    isClassifying = true;
    const mid = classificationQueue[0];
    const pageData = collectedPageData.get(mid);
    console.log("[Background] Processing classification for UP:", mid);
    console.log("[Background] Queue size:", classificationQueue.length);
    console.log("[Background] Remaining UPs:", classificationQueue.slice(0, 5));
    if (!pageData) {
        console.log("[Background] No page data yet for UP", mid, ", waiting...");
        isClassifying = false;
        return;
    }
    try {
        const getValueFn = options.getValueFn ?? ((key) => getValue(key));
        const setValueFn = options.setValueFn ?? ((key, value) => setValue(key, value));
        const upTags = (await getValueFn("upTags")) ?? {};
        const existingTags = upTags[String(mid)] ?? [];
        console.log("[Background] Existing tags for UP", mid, ":", existingTags);
        // Skip if UP already has tags
        if (existingTags.length > 0) {
            console.log("[Background] UP", mid, "already has tags, skipping...");
            classificationQueue.shift();
            collectedPageData.delete(mid);
            isClassifying = false;
            // Process next UP
            if (classificationQueue.length > 0) {
                const nextMid = classificationQueue[0];
                console.log("[Background] Moving to next UP:", nextMid);
                const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
                if (tabs) {
                    // Get all tabs, excluding DevTools windows
                    const allTabs = await tabs.query?.({}) ?? [];
                    // Find a non-DevTools window with an active tab
                    const targetTab = allTabs.find(tab => !tab.url?.startsWith("devtools://"));
                    if (targetTab?.id) {
                        tabs.update(targetTab.id, { url: toUpUrl(nextMid) });
                    }
                }
            }
            return;
        }
        const tags = await classifyUPWithPageData(mid, pageData, existingTags, options);
        upTags[String(mid)] = tags;
        await setValueFn("upTags", upTags);
        console.log("[Background] ✓ Successfully classified UP", mid, "with tags:", tags);
        console.log("[Background] Progress:", classificationQueue.length - 1, "UPs remaining");
        // Remove from queue and collected data
        classificationQueue.shift();
        collectedPageData.delete(mid);
        // Update status
        await setValueFn("classifyStatus", { lastUpdate: Date.now() });
        // Process next UP
        isClassifying = false;
        if (classificationQueue.length > 0) {
            const nextMid = classificationQueue[0];
            console.log("[Background] Moving to next UP:", nextMid);
            const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
            if (tabs) {
                // Get all tabs, excluding DevTools windows
                const allTabs = await tabs.query?.({}) ?? [];
                // Find a non-DevTools window with an active tab
                const targetTab = allTabs.find(tab => !tab.url?.startsWith("devtools://"));
                if (targetTab?.id) {
                    tabs.update(targetTab.id, { url: toUpUrl(nextMid) });
                }
                else {
                    console.log("[Background] No suitable tab found, skipping navigation");
                }
            }
        }
        else {
            console.log("[Background] ✓ All UPs classified successfully!");
        }
    }
    catch (error) {
        console.error("[Background] ✗ Classification error for UP", mid, ":", error);
        classificationQueue.shift();
        collectedPageData.delete(mid);
        isClassifying = false;
    }
}
/**
 * Start automatic classification by visiting UP pages
 */
export async function startAutoClassification(options = {}) {
    console.log("[Background] ===== Starting auto classification =====");
    const getValueFn = options.getValueFn ?? ((key) => getValue(key));
    const cache = (await getValueFn("upList"));
    const list = cache?.upList ?? [];
    console.log("[Background] Loaded UP list:", list.length, "UPs");
    if (list.length === 0) {
        console.log("[Background] ✗ No UPs to classify. Please update your UP list first.");
        return;
    }
    // Clear existing queue
    classificationQueue.length = 0;
    collectedPageData.clear();
    // Get existing tags
    const upTags = (await getValueFn("upTags")) ?? {};
    // Filter out UPs that already have tags
    const upsWithoutTags = list.filter(up => {
        const existingTags = upTags[String(up.mid)] ?? [];
        const hasTags = existingTags.length > 0;
        if (hasTags) {
            console.log("[Background] Skipping UP", up.mid, "- already has tags:", existingTags);
        }
        return !hasTags;
    });
    // Add UPs without tags to queue
    for (const up of upsWithoutTags) {
        classificationQueue.push(up.mid);
    }
    console.log("[Background] ✓ Classification queue created with", classificationQueue.length, "UPs");
    console.log("[Background] First 5 UPs in queue:", classificationQueue.slice(0, 5));
    // Start by opening first UP page
    if (classificationQueue.length > 0) {
        const firstMid = classificationQueue[0];
        console.log("[Background] Opening first UP page:", toUpUrl(firstMid));
        const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
        if (tabs) {
            // Get current active tab
            const activeTab = await tabs.query?.({ active: true, currentWindow: true });
            if (activeTab && activeTab[0]?.id) {
                console.log("[Background] Updating active tab:", activeTab[0].id);
                tabs.update(activeTab[0].id, { url: toUpUrl(firstMid) });
            }
            else {
                // Fallback: update the current tab
                console.log("[Background] Updating current tab (fallback)");
                tabs.update(undefined, { url: toUpUrl(firstMid) });
            }
        }
        else {
            console.log("[Background] ✗ Tabs API not available");
        }
    }
}
/**
 * Handle runtime messages.
 */
export async function handleMessage(message, options = {}) {
    const getValueFn = options.getValueFn ?? ((key) => getValue(key));
    const getUPVideosFn = options.getUPVideosFn ?? getUPVideos;
    const getVideoTagsFn = options.getVideoTagsFn ?? getVideoTags;
    const recommendUPFn = options.recommendUPFn ?? recommendUP;
    const recommendVideoFn = options.recommendVideoFn ?? recommendVideo;
    const updateInterestFromWatchFn = options.updateInterestFromWatchFn ?? updateInterestFromWatch;
    const randomUPFn = options.randomUPFn ?? randomUP;
    const randomVideoFn = options.randomVideoFn ?? randomVideo;
    if (!message || !message.type) {
        return;
    }
    if (message.type === "watch_event") {
        const payload = message.payload;
        if (!payload?.bvid) {
            return;
        }
        const tags = await getVideoTagsFn(payload.bvid);
        await updateInterestFromWatchFn({
            tags,
            watch_time: payload.watch_time ?? 0,
            duration: payload.duration ?? 0
        });
        return null;
    }
    if (message.type === "detect_uid") {
        const payload = message.payload;
        if (!payload?.uid) {
            return null;
        }
        const setValueFn = options.setValueFn ?? ((key, value) => setValue(key, value));
        const settings = (await getValueFn("settings"));
        const nextSettings = { ...(settings ?? {}), userId: payload.uid };
        await setValueFn("settings", nextSettings);
        await setValueFn("userId", payload.uid);
        console.log("[Background] Updated userId", payload.uid);
        return null;
    }
    const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
    if (!tabs) {
        console.log("[Background] Tabs unavailable");
        return null;
    }
    if (message.type === "random_up") {
        const cache = (await getValueFn("upList"));
        const upList = cache?.upList ?? [];
        const up = randomUPFn(upList);
        if (up) {
            // Get current active tab
            const activeTab = await tabs.query?.({ active: true, currentWindow: true });
            if (activeTab && activeTab[0]?.id) {
                tabs.update(activeTab[0].id, { url: toUpUrl(up.mid) });
            }
            else {
                // Fallback: update the current tab
                tabs.update(undefined, { url: toUpUrl(up.mid) });
            }
        }
        return null;
    }
    if (message.type === "random_video") {
        const cache = (await getValueFn("upList"));
        const upList = cache?.upList ?? [];
        const up = randomUPFn(upList);
        if (!up)
            return;
        const videos = await getUPVideosFn(up.mid);
        const video = randomVideoFn(videos);
        if (video) {
            // Get current active tab
            const activeTab = await tabs.query?.({ active: true, currentWindow: true });
            if (activeTab && activeTab[0]?.id) {
                tabs.update(activeTab[0].id, { url: toVideoUrl(video.bvid) });
            }
            else {
                // Fallback: update the current tab
                tabs.update(undefined, { url: toVideoUrl(video.bvid) });
            }
        }
        return null;
    }
    if (message.type === "update_up_list") {
        await updateUpListTask(options);
        return null;
    }
    if (message.type === "classify_ups") {
        await classifyUpTask(options);
        return null;
    }
    if (message.type === "start_auto_classification") {
        await startAutoClassification(options);
        return null;
    }
    if (message.type === "up_page_collected") {
        await handleUPPageCollected(message, options);
        return null;
    }
    if (message.type === "clear_classify_data") {
        const setValueFn = options.setValueFn ?? ((key, value) => setValue(key, value));
        await setValueFn("upTags", {});
        await setValueFn("videoCounts", {});
        await setValueFn("classifyStatus", { lastUpdate: 0 });
        console.log("[Background] Cleared classify data");
        return null;
    }
    if (message.type === "probe_up") {
        const payload = message.payload;
        const mid = payload?.mid;
        if (!mid)
            return { ok: false };
        const info = await getUPInfo(mid, { fallbackRequest: proxyApiRequest });
        const videos = await getUPVideos(mid, { fallbackRequest: proxyApiRequest });
        return {
            ok: Boolean(info),
            name: info?.name ?? null,
            videoCount: Array.isArray(videos) ? videos.length : 0
        };
    }
    if (message.type === "recommend_video") {
        const up = await recommendUPFn();
        if (!up)
            return null;
        const video = await recommendVideoFn(up.mid);
        if (video) {
            const url = toVideoUrl(video.bvid);
            // Get current active tab
            const activeTab = await tabs.query?.({ active: true, currentWindow: true });
            if (activeTab && activeTab[0]?.id) {
                tabs.update(activeTab[0].id, { url });
            }
            else {
                // Fallback: update the current tab
                tabs.update(undefined, { url });
            }
            return { title: video.title, url };
        }
    }
    return null;
}
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
}
if (typeof chrome !== "undefined") {
    initBackground();
}
async function proxyApiRequest(url) {
    if (typeof chrome === "undefined" || !chrome.tabs?.query || !chrome.tabs?.sendMessage) {
        return null;
    }
    const tabs = await chrome.tabs.query({ url: "*://*.bilibili.com/*" });
    const candidates = tabs.filter((tab) => typeof tab.id === "number");
    if (candidates.length === 0) {
        console.warn("[Background] No Bilibili tab for proxy");
        return null;
    }
    for (const tab of candidates) {
        try {
            const response = (await chrome.tabs.sendMessage(tab.id, {
                type: "bili_api_request",
                url
            }));
            if (response && response.data !== undefined) {
                return response.data ?? null;
            }
        }
        catch (error) {
            console.warn("[Background] Proxy send failed", error);
        }
    }
    console.warn("[Background] No proxy response");
    return null;
}
