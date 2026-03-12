/**
 * Background service worker initialization.
 * 支持同时在最多五个标签页中进行数据抓取
 */

import { getFollowedUPs, getUPInfo, getUPVideos, getUPVideosForClassification, getVideoTags } from "../api/bili-api.js";
import { classifyUP } from "../engine/classifier.js";
import {
  randomUP,
  randomVideo,
  recommendUP,
  recommendVideo,
  updateInterestFromWatch
} from "../engine/recommender.js";
import { getValue, saveUPList, setValue, type UP } from "../storage/storage.js";
import { chatComplete, parseTagsFromContent } from "../engine/llm-client.js";

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
  sendMessage: (message: unknown, callback?: (response?: unknown) => void) => void;
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

interface BackgroundOptions {
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

declare const chrome: {
  alarms?: AlarmManager;
  runtime?: RuntimeManager;
  tabs?: TabsManager;
  notifications?: NotificationManager;
};

function toVideoUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${bvid}`;
}

function toUpUrl(mid: number): string {
  return `https://space.bilibili.com/${mid}`;
}

const collectedPageData = new Map<number, any>();
const classificationQueue: number[] = [];
const pendingClassificationQueue: number[] = [];
let isClassifying = false;
const activeCollectionTabs = new Map<number, number>();
const createdCollectionTabs = new Set<number>();

export async function handleUPPageCollected(
  message: MessageLike,
  options: BackgroundOptions = {}
): Promise<void> {
  const payload = message.payload as { mid?: number; name?: string; sign?: string; videos?: any[] } | undefined;
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
  console.log("[Background] Active collection tabs:", Array.from(activeCollectionTabs.entries()));

  const tabId = activeCollectionTabs.get(payload.mid);
  if (tabId) {
    activeCollectionTabs.delete(payload.mid);
  }

  if (!payload.name && (!payload.videos || payload.videos.length === 0)) {
    console.log("[Background] UP", payload.mid, "appears to be invalid, skipping...");
    const queueIndex = classificationQueue.indexOf(payload.mid);
    if (queueIndex !== -1) {
      classificationQueue.splice(queueIndex, 1);
    }
    collectedPageData.delete(payload.mid);

    if (tabId) {
      await openNextAvailableUPPage(tabId, options);
    }
    return;
  }

  collectedPageData.set(payload.mid, payload);

  if (tabId) {
    await openNextAvailableUPPage(tabId, options);
  }
  enqueueClassification(payload.mid);
  await processNextClassification(options);
}

async function openNextUPPage(mid: number, tabId: number | undefined, options: BackgroundOptions = {}): Promise<void> {
  const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
  if (!tabs) {
    console.log("[Background] ✗ Tabs API not available");
    return;
  }

  if (!tabId) {
    console.log("[Background] ✗ No tabId provided for UP:", mid);
    return;
  }

  console.log("[Background] Updating tab", tabId, "for UP:", mid);
  tabs.update(tabId, { url: toUpUrl(mid) });
  activeCollectionTabs.set(mid, tabId);
}

function enqueueClassification(mid: number): void {
  if (!pendingClassificationQueue.includes(mid)) {
    pendingClassificationQueue.push(mid);
  }
}

async function openNextAvailableUPPage(tabId: number, options: BackgroundOptions = {}): Promise<void> {
  if (classificationQueue.length === 0) {
    await closeCollectionTab(tabId, options);
    return;
  }
  const nextMid = classificationQueue.shift();
  if (!nextMid) {
    await closeCollectionTab(tabId, options);
    return;
  }
  await openNextUPPage(nextMid, tabId, options);
}

async function closeCollectionTab(tabId: number, options: BackgroundOptions = {}): Promise<void> {
  const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
  if (!tabs?.remove) {
    return;
  }
  if (!createdCollectionTabs.has(tabId)) {
    return;
  }
  try {
    await tabs.remove(tabId);
    createdCollectionTabs.delete(tabId);
    console.log("[Background] Closed collection tab", tabId);
  } catch (error) {
    console.warn("[Background] Failed to close tab", tabId, error);
  }
}
async function classifyUPWithPageData(
  mid: number,
  pageData: any,
  existingTags: string[] = [],
  options: BackgroundOptions = {}
): Promise<string[]> {
  const classifyWithPageDataFn = options.classifyWithPageDataFn ?? defaultClassifyWithPageData;
  return classifyWithPageDataFn(mid, pageData, existingTags);
}

async function defaultClassifyWithPageData(
  mid: number,
  pageData: any,
  existingTags: string[]
): Promise<string[]> {
  const videoTitles = pageData.videos?.map((v: any) => v.title) ?? [];
  const pageText = pageData.pageText ?? "";

  console.log("[Background] Classifying UP", mid, "with", videoTitles.length, "videos");

  const tags = parseTagsFromContent(pageText);

  console.log("[Background] Parsed tags:", tags);

  return tags;
}

async function processNextClassification(options: BackgroundOptions = {}): Promise<void> {
  if (isClassifying) {
    console.log("[Background] Already classifying, skipping...");
    return;
  }

  if (pendingClassificationQueue.length === 0) {
    if (classificationQueue.length === 0 && activeCollectionTabs.size === 0) {
      console.log("[Background] Classification queue is empty, all done!");
      await closeAllCollectionTabs(options);
    }
    return;
  }

  isClassifying = true;
  const mid = pendingClassificationQueue.shift();
  if (mid === undefined) {
    isClassifying = false;
    return;
  }
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
    const getValueFn = options.getValueFn ?? ((key: string) => getValue(key));
    const setValueFn = options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));

    const upTags = ((await getValueFn("upTags")) as Record<string, string[]> | null) ?? {};
    const existingTags = upTags[String(mid)] ?? [];

    console.log("[Background] Existing tags for UP", mid, ":", existingTags);

    if (existingTags.length > 0) {
      console.log("[Background] UP", mid, "already has tags, skipping...");
      collectedPageData.delete(mid);
      isClassifying = false;

      await processNextClassification(options);
      return;
    }

    const tags = await classifyUPWithPageData(mid, pageData, existingTags, options);
    upTags[String(mid)] = tags;

    await setValueFn("upTags", upTags);
    console.log("[Background] ✓ Successfully classified UP", mid, "with tags:", tags);
    const remaining =
      classificationQueue.length + pendingClassificationQueue.length + activeCollectionTabs.size;
    console.log("[Background] Progress:", remaining, "UPs remaining (including in-flight)");

    collectedPageData.delete(mid);

    await setValueFn("classifyStatus", { lastUpdate: Date.now() });

    isClassifying = false;
    await processNextClassification(options);
  } catch (error) {
    console.error("[Background] ✗ Classification error for UP", mid, ":", error);
    collectedPageData.delete(mid);
    isClassifying = false;
  }
}

export async function startAutoClassification(options: BackgroundOptions = {}): Promise<void> {
  console.log("[Background] ===== Starting auto classification =====");

  const getValueFn = options.getValueFn ?? ((key: string) => getValue(key));
  const cache = (await getValueFn("upList")) as { upList?: { mid: number }[] } | null;
  const list = cache?.upList ?? [];

  console.log("[Background] Loaded UP list:", list.length, "UPs");

  if (list.length === 0) {
    console.log("[Background] ✗ No UPs to classify. Please update your UP list first.");
    return;
  }

  classificationQueue.length = 0;
  pendingClassificationQueue.length = 0;
  collectedPageData.clear();
  activeCollectionTabs.clear();
  createdCollectionTabs.clear();

  const upTags = ((await getValueFn("upTags")) as Record<string, string[]> | null) ?? {};

  const upsWithoutTags = list.filter(up => {
    const existingTags = upTags[String(up.mid)] ?? [];
    const hasTags = existingTags.length > 0;
    if (hasTags) {
      console.log("[Background] Skipping UP", up.mid, "- already has tags:", existingTags);
    }
    return !hasTags;
  });

  for (const up of upsWithoutTags) {
    classificationQueue.push(up.mid);
  }

  console.log("[Background] ✓ Classification queue created with", classificationQueue.length, "UPs");
  console.log("[Background] First 5 UPs in queue:", classificationQueue.slice(0, 5));

  const MAX_CONCURRENT_TABS = 5;
  const toOpen = Math.min(MAX_CONCURRENT_TABS, classificationQueue.length);

  if (toOpen > 0) {
    console.log("[Background] Creating", toOpen, "tabs for concurrent collection");

    const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
    if (!tabs || !tabs.create) {
      console.log("[Background] ✗ Tabs API not available for creating new tabs");
      return;
    }

    for (let i = 0; i < toOpen; i++) {
      const nextMid = classificationQueue.shift();
      if (!nextMid) break;
      const created = await tabs.create({ url: toUpUrl(nextMid), active: false });
      if (created?.id) {
        console.log("[Background] Created tab", created.id, "for UP:", nextMid);
        activeCollectionTabs.set(nextMid, created.id);
        createdCollectionTabs.add(created.id);
      }
    }
  }
}

async function closeAllCollectionTabs(options: BackgroundOptions = {}): Promise<void> {
  const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
  if (!tabs?.remove || createdCollectionTabs.size === 0) {
    return;
  }
  const toClose = Array.from(createdCollectionTabs);
  createdCollectionTabs.clear();
  try {
    await tabs.remove(toClose);
    console.log("[Background] Closed all collection tabs:", toClose.length);
  } catch (error) {
    console.warn("[Background] Failed to close all collection tabs", error);
  }
}

export async function handleMessage(
  message: MessageLike,
  options: BackgroundOptions = {}
): Promise<unknown> {
  const getValueFn =
    options.getValueFn ?? ((key: string) => getValue(key));
  const getUPVideosFn = options.getUPVideosFn ?? getUPVideos;
  const getVideoTagsFn = options.getVideoTagsFn ?? getVideoTags;
  const recommendUPFn = options.recommendUPFn ?? recommendUP;
  const recommendVideoFn = options.recommendVideoFn ?? recommendVideo;
  const updateInterestFromWatchFn =
    options.updateInterestFromWatchFn ?? updateInterestFromWatch;
  const randomUPFn = options.randomUPFn ?? randomUP;
  const randomVideoFn = options.randomVideoFn ?? randomVideo;
  const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);

  if (!message || !message.type) {
    return;
  }

  if (message.type === "watch_event") {
    const payload = message.payload as { bvid?: string; watch_time?: number; duration?: number };
    if (!payload?.bvid) {
      return;
    }
    const tags = await getVideoTagsFn(payload.bvid);
    console.log("[Background] Watch event for", payload.bvid, "tags:", tags);
    await updateInterestFromWatchFn({
      watch_time: payload.watch_time ?? 0,
      duration: payload.duration ?? 0,
      tags
    });
    return null;
  }

  if (message.type === "start_classification") {
    const settings = (await getValueFn("settings")) as { classifyMethod?: "api" | "page" } | null;
    const classifyMethod = settings?.classifyMethod ?? "page";

    console.log("[Background] Classification method:", classifyMethod);

    if (classifyMethod === "api") {
      console.log("[Background] Using API method for auto classification");
      await classifyUpTask(options);
    } else {
      console.log("[Background] Using page scraping method for auto classification");
      await startAutoClassification(options);
    }
    return null;
  }

  if (message.type === "up_page_collected") {
    await handleUPPageCollected(message, options);
    return null;
  }

  if (message.type === "clear_classify_data") {
    const setValueFn =
      options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));
    await setValueFn("upTags", {});
    await setValueFn("videoCounts", {});
    await setValueFn("classifyStatus", { lastUpdate: 0 });
    console.log("[Background] Cleared classify data");
    return null;
  }

  if (message.type === "probe_up") {
    const payload = message.payload as { mid?: number };
    const mid = payload?.mid;
    if (!mid) return { ok: false };
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
    if (!up) return null;
    const video = await recommendVideoFn(up.mid);
    if (video) {
      const url = toVideoUrl(video.bvid);
      if (!tabs) {
        return { title: video.title, url };
      }
      const activeTab = await tabs.query?.({ active: true, currentWindow: true });
      if (activeTab && activeTab[0]?.id) {
        tabs.update(activeTab[0].id, { url });
      } else {
        tabs.update(undefined, { url });
      }
      return { title: video.title, url };
    }
  }



  return null;
}

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

async function proxyApiRequest(url: string): Promise<unknown | null> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query || !chrome.tabs?.sendMessage) {
    return null;
  }
  const tabs = await chrome.tabs.query({ url: "*://*.bilibili.com/*" });
  const candidates = tabs.filter((tab) => typeof tab.id === "number") as { id: number }[];
  if (candidates.length === 0) {
    console.warn("[Background] No Bilibili tab for proxy");
    return null;
  }
  for (const tab of candidates) {
    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: "bili_api_request",
        url
      })) as { data?: unknown } | undefined;
      if (response && response.data !== undefined) {
        return response.data ?? null;
      }
    } catch (error) {
      console.warn("[Background] Proxy send failed", error);
    }
  }
  console.warn("[Background] No proxy response");
  return null;
}

export async function classifyUpTask(
  options: BackgroundOptions = {}
): Promise<number> {
  const classifyUPFn = options.classifyUPFn ?? classifyUP;
  const getValueFn =
    options.getValueFn ?? ((key: string) => getValue(key));
  const setValueFn =
    options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));
  const batchSize = options.batchSize ?? 10;
  const useAPIMethod = options.useAPIMethod ?? false;
  const maxVideos = options.maxVideos ?? 30;

  const settings = (await getValueFn("settings")) as { classifyMethod?: "api" | "page" } | null;
  const classifyMethod = settings?.classifyMethod ?? "page";
  const shouldUseAPIMethod = useAPIMethod || classifyMethod === "api";

  const cache = (await getValueFn("upList")) as { upList?: { mid: number }[] } | null;
  const list = cache?.upList ?? [];
  if (list.length === 0) {
    console.log("[Background] No UPs to classify");
    return 0;
  }

  const upTags =
    ((await getValueFn("upTags")) as Record<string, string[]> | null) ?? {};
  const videoCounts =
    ((await getValueFn("videoCounts")) as Record<string, number> | null) ?? {};
  const batch = list;
  let processed = 0;

  console.log("[Background] Classify UPs using method:", shouldUseAPIMethod ? "API" : "Page");

  if (shouldUseAPIMethod && typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: "classify_progress",
      payload: { current: 0, total: list.length, text: "准备中..." }
    });
  }

  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    for (const up of chunk) {
      const existing = upTags[String(up.mid)] ?? [];
      console.log("[Background] Classify UP", up.mid, {
        existingTags: existing.length
      });

      const profile = await classifyUPFn(up.mid, {
        existingTags: existing,
        useAPIMethod: shouldUseAPIMethod,
        maxVideos: maxVideos,
        getUPVideosFn: shouldUseAPIMethod
          ? (mid: number) => getUPVideosForClassification(mid, maxVideos, { fallbackRequest: proxyApiRequest })
          : (mid: number) => getUPVideos(mid, { fallbackRequest: proxyApiRequest }),
        getUPInfoFn: (mid: number) =>
          getUPInfo(mid, { fallbackRequest: proxyApiRequest }),
        getVideoTagsFn: (bvid: string) =>
          getVideoTags(bvid, { fallbackRequest: proxyApiRequest })
      });
      upTags[String(up.mid)] = profile.tags;
      videoCounts[String(up.mid)] = profile.videoCount ?? 0;
      processed += 1;

      if (shouldUseAPIMethod && typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: "classify_progress",
          payload: {
            current: processed,
            total: list.length,
            text: `正在分类: ${up.mid}`
          }
        });
      }
    }
  }

  await setValueFn("upTags", upTags);
  await setValueFn("videoCounts", videoCounts);
  await setValueFn("classifyStatus", { lastUpdate: Date.now() });
  console.log("[Background] Classified UPs", processed);

  if (shouldUseAPIMethod && typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({ type: "classify_complete" });
  }

  return processed;
}

export async function updateUpListTask(
  options: BackgroundOptions = {}
): Promise<{ success: boolean; newCount?: number }> {
  const getFollowedUPsFn = options.getFollowedUPsFn ?? getFollowedUPs;
  const saveUPListFn = options.saveUPListFn ?? saveUPList;
  const getValueFn =
    options.getValueFn ?? ((key: string) => getValue(key));
  const notifications = options.notifications ?? chrome.notifications;

  const settings = (await getValueFn("settings")) as { userId?: number } | null;
  const uid = options.uid ?? (await getValueFn("userId")) ?? settings?.userId;
  const uidValue = typeof uid === "number" ? uid : Number(uid);
  if (!uidValue || Number.isNaN(uidValue)) {
    console.warn("[Background] Missing userId for update");
    return { success: false };
  }

  const existingCache = (await getValueFn("upList")) as { upList?: UP[] } | null;
  const existingUPs = existingCache?.upList ?? [];

  const result = await getFollowedUPsFn(uidValue, {}, existingUPs);

  await saveUPListFn(result.upList);
  console.log("[Background] Updated UP list", result.upList.length, "New UPs:", result.newCount);

  if (result.newCount > 0 && notifications) {
    notifications.create({
      type: "basic",
      iconUrl: chrome.runtime?.getURL?.("icons/icon128.png") || "",
      title: "关注更新",
      message: `发现 ${result.newCount} 个新关注的UP主！`
    });
  }

  return { success: true, newCount: result.newCount };
}

export function scheduleAlarms(alarms: AlarmManager): void {
  console.log("[Background] Schedule alarms");
  alarms.create(ALARM_UPDATE_UP_LIST, { periodInMinutes: 24 * 60 });
  alarms.create(ALARM_CLASSIFY_UPS, { periodInMinutes: 7 * 24 * 60 });
}

export async function handleAlarm(
  alarm: AlarmLike,
  options: BackgroundOptions = {}
): Promise<void> {
  if (alarm.name === ALARM_UPDATE_UP_LIST) {
    await updateUpListTask(options);
    return;
  }
  if (alarm.name === ALARM_CLASSIFY_UPS) {
    await classifyUpTask(options);
  }
}
