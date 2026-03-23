import { chatComplete, parseTagsFromContent, LlmRequestError } from "../../engine/llm-client.js";
import {
  getValue,
  setValue,
  CreatorRepository,
  TagRepository
} from "../../database/implementations/index.js";
import { Platform, TagSource } from "../../database/types/base.js";
import type {MessageLike, TabOptions } from "./types.js";

declare const chrome: {
  runtime?: {
    sendMessage: (message: unknown) => void;
    getURL?: (path: string) => string;
  };
  notifications?: {
    create: (options: { type: string; iconUrl: string; title: string; message: string }) => void;
  };
  tabs?: {
    update: (tabId: number | undefined, updateProperties: { url: string }) => void;
    remove?: (tabId: number | number[]) => Promise<void>;
    create?: (createProperties: { url: string; active?: boolean }) => Promise<{ id?: number } | undefined>;
  };
};

import { buildUserSpaceUrl } from "../../utls/url-builder.js";

const collectedPageData = new Map<string, any>();
const classificationQueue: string[] = [];
const pendingClassificationQueue: string[] = [];
let isClassifying = false;
let pageClassifyActive = false;
let pageClassifyStopping = false;
let pageClassifyTotal = 0;
let pageClassifyProcessed = 0;
let pageClassifyTitle = "自动分类";
let pageClassifyDetail = "准备中...";
const upNameMap = new Map<string, string>();

const activeCollectionTabs = new Map<string, number>();
const createdCollectionTabs = new Set<number>();

const MAX_CONCURRENT_TABS = 3;
const MAX_CLASSIFY_TAGS = 3;

const creatorRepository = new CreatorRepository();
const tagRepository = new TagRepository();


function sendPageProgress(title: string, detail: string): void {
  if (typeof chrome === "undefined" || !chrome.runtime) return;
  pageClassifyTitle = title;
  pageClassifyDetail = detail;
  chrome.runtime.sendMessage({
    type: "classify_progress",
    payload: {
      active: pageClassifyActive,
      stopping: pageClassifyStopping,
      current: pageClassifyProcessed,
      total: pageClassifyTotal,
      title,
      detail
    }
  });
}

function sendPageComplete(): void {
  if (typeof chrome === "undefined" || !chrome.runtime) return;
  chrome.runtime.sendMessage({ type: "classify_complete" });
}

export function getPageClassifyProgress(): {
  active: boolean;
  stopping: boolean;
  current: number;
  total: number;
  title: string;
  detail: string;
} {
  return {
    active: pageClassifyActive,
    stopping: pageClassifyStopping,
    current: pageClassifyProcessed,
    total: pageClassifyTotal,
    title: pageClassifyTitle,
    detail: pageClassifyDetail
  };
}

function resetPageClassifyState(): void {
  classificationQueue.length = 0;
  pendingClassificationQueue.length = 0;
  collectedPageData.clear();
  activeCollectionTabs.clear();
  createdCollectionTabs.clear();
  upNameMap.clear();
  pageClassifyActive = false;
  pageClassifyStopping = false;
  pageClassifyTotal = 0;
  pageClassifyProcessed = 0;
  pageClassifyTitle = "自动分类";
  pageClassifyDetail = "准备中...";
}

async function finishPageClassification(detail: string = "分类完成"): Promise<void> {
  await closeAllCollectionTabs();
  const shouldNotify = pageClassifyActive;
  resetPageClassifyState();
  if (shouldNotify) {
    sendPageComplete();
  }
  console.log("[Background] Page classify finished:", detail);
}

function notifyClassificationFailure(title: string, message: string): void {
  const notifications = typeof chrome !== "undefined" ? chrome.notifications : undefined;
  if (!notifications) {
    return;
  }
  notifications.create({
    type: "basic",
    iconUrl: chrome.runtime?.getURL?.("icons/icon128.png") || "",
    title,
    message
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitRandom(minMs = 1000, maxMs = 2000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await wait(delay);
}

async function openNextUPPage(mid: string, tabId: number | undefined): Promise<void> {
  const tabs = typeof chrome !== "undefined" ? chrome.tabs : undefined;
  if (!tabs) {
    console.log("[Background] ✗ Tabs API not available");
    return;
  }

  if (!tabId) {
    console.log("[Background] ✗ No tabId provided for UP:", mid);
    return;
  }

  await waitRandom();
  console.log("[Background] Updating tab", tabId, "for UP:", mid);
  tabs.update(tabId, { url: buildUserSpaceUrl(mid) });
  activeCollectionTabs.set(mid, tabId);
}

function enqueueClassification(mid: string): void {
  if (!pendingClassificationQueue.includes(mid)) {
    pendingClassificationQueue.push(mid);
  }
}

async function closeCollectionTab(tabId: number): Promise<void> {
  const tabs = typeof chrome !== "undefined" ? chrome.tabs : undefined;
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

async function openNextAvailableUPPage(tabId: number): Promise<void> {
  if (classificationQueue.length === 0) {
    await closeCollectionTab(tabId);
    return;
  }
  const nextMid = classificationQueue.shift();
  if (!nextMid) {
    await closeCollectionTab(tabId);
    return;
  }
  await openNextUPPage(nextMid, tabId);
}

async function closeAllCollectionTabs(): Promise<void> {
  const tabs = typeof chrome !== "undefined" ? chrome.tabs : undefined;
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

export function handleCollectionTabRemoved(tabId: number): void {
  let removedMid: string | null = null;
  for (const [mid, activeTabId] of activeCollectionTabs.entries()) {
    if (activeTabId === tabId) {
      removedMid = mid;
      break;
    }
  }
  if (removedMid === null) {
    return;
  }
  activeCollectionTabs.delete(removedMid);
  createdCollectionTabs.delete(tabId);
  classificationQueue.push(removedMid);
  console.log("[Background] Collection tab closed, re-queue UP:", removedMid);
  if (pageClassifyActive) {
    sendPageProgress("自动分类", "采集标签页关闭，已重新排队");
  }
}

export async function handleUPPageCollected(
  message: MessageLike
): Promise<void> {
  const payload = message.payload as { mid?: string; name?: string; sign?: string; videos?: any[] } | undefined;
  if (!payload?.mid) {
    console.warn("[Background] Invalid UP page data", payload);
    return;
  }

  const settings = (await getValue("settings")) as { userId?: string } | null;
  const currentUserId = settings?.userId;
  if (currentUserId && payload.mid === currentUserId) {
    console.log("[Background] Ignore current user page collection:", payload.mid);
    return;
  }

  const tabId = activeCollectionTabs.get(payload.mid);
  if (!pageClassifyActive || !tabId) {
    console.log("[Background] Ignore unsolicited UP page collection:", payload.mid);
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
  activeCollectionTabs.delete(payload.mid);

  if (!payload.name && (!payload.videos || payload.videos.length === 0)) {
    console.log("[Background] UP", payload.mid, "appears to be invalid, skipping...");
    collectedPageData.delete(payload.mid);
    if (pageClassifyActive) {
      pageClassifyProcessed += 1;
      sendPageProgress(payload.name || "无效UP", "页面数据为空，已跳过");
    }
    if (tabId) {
      await openNextAvailableUPPage(tabId);
    }
    return;
  }

  collectedPageData.set(payload.mid, payload);

  if (tabId) {
    await openNextAvailableUPPage(tabId);
  }
  enqueueClassification(payload.mid);
  await processNextClassification();
}

export async function classifyUPWithPageData(
  mid: string,
  pageData: any,
  existingTags: string[] = []
): Promise<string[]> {
  return defaultClassifyWithPageData(mid, pageData, existingTags);
}

async function defaultClassifyWithPageData(
  mid: string,
  pageData: any,
  existingTags: string[] = []
): Promise<string[]> {
  console.log("[Background] Starting LLM classification for UP:", mid);

  const pageText = pageData.pageText ?? "";
  const titles = pageData.videos?.slice(0, 10).map((v: any) => v.title) ?? []

  const existing = existingTags.length > 0 ? existingTags.join("、") : "无";
  const prompt = [
    "You are a content classifier.",
    "Return a JSON array of 1 to 3 short Chinese tags.",
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
  const tags = parseTagsFromContent(content).slice(0, MAX_CLASSIFY_TAGS);
  console.log("[Background] Parsed tags for UP", mid, ":", tags);
  return tags;
}

async function abortForLlmError(mid: string, pageData: any, error: LlmRequestError): Promise<void> {
  const statusSuffix = typeof error.status === "number" ? `（HTTP ${error.status}）` : "";
  const upName = pageData?.name || upNameMap.get(mid) || `UP ${mid}`;
  console.error("[Background] Fatal LLM error, stop auto classification:", {
    mid,
    upName,
    status: error.status,
    message: error.message
  });
  pageClassifyStopping = true;
  sendPageProgress("LLM 调用失败", `${upName}${statusSuffix}，自动分类已终止`);
  notifyClassificationFailure("自动分类已终止", `LLM 请求失败${statusSuffix}，请检查 API Key 或模型配置。`);
  await finishPageClassification("LLM 调用失败");
}

async function processNextClassification(): Promise<void> {
  if (isClassifying) {
    console.log("[Background] Already classifying, skipping...");
    return;
  }

  if (!pageClassifyActive || pageClassifyStopping) {
    if (classificationQueue.length === 0 && pendingClassificationQueue.length === 0 && activeCollectionTabs.size === 0) {
      await finishPageClassification(pageClassifyStopping ? "已停止" : "分类完成");
    }
    return;
  }

  if (pendingClassificationQueue.length === 0) {
    if (classificationQueue.length === 0 && activeCollectionTabs.size === 0) {
      console.log("[Background] Classification queue is empty, all done!");
      await finishPageClassification();
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
  console.log("[Background] Pending classification:", pendingClassificationQueue.slice(0, 5));

  if (!pageData) {
    console.log("[Background] No page data yet for UP", mid, ", waiting...");
    isClassifying = false;
    return;
  }

  try {
    // 获取UP的手动标签
    const existingTagIds = await creatorRepository.getUPManualTags(mid,Platform.BILIBILI);

    console.log("[Background] Existing manual tags for UP", mid, ":", existingTagIds);

    if (existingTagIds.length > 0) {
      console.log("[Background] UP", mid, "already has manual tags, skipping...");
      collectedPageData.delete(mid);
      isClassifying = false;
      if (pageClassifyActive) {
        pageClassifyProcessed += 1;
        sendPageProgress(pageData.name || upNameMap.get(mid) || "已分类UP", "已存在可编辑标签，跳过");
      }
      await processNextClassification();
      return;
    }

    // 获取LLM分类的标签名称
    const tagNames = await classifyUPWithPageData(mid, pageData, []);
    console.log("[Background] LLM classified tags for UP", mid, ":", tagNames);

    const normalizedTagNames = [...new Set(tagNames.map((tag) => tag.trim()).filter(Boolean))].slice(0, MAX_CLASSIFY_TAGS);
    if (normalizedTagNames.length === 0) {
      collectedPageData.delete(mid);
      isClassifying = false;
      if (pageClassifyActive) {
        pageClassifyProcessed += 1;
        sendPageProgress(pageData.name || upNameMap.get(mid) || "分类结果为空", "没有生成有效标签，未写入");
      }
      await processNextClassification();
      return;
    }

    // 将标签名称添加到标签库，获取标签ID。自动分类产物按可编辑用户标签存储。
    // 创建标签并获取标签ID
    const tagIds: string[] = [];
    for (const tagName of normalizedTagNames) {
      const tagId = await tagRepository.createTag(tagName,TagSource.USER);
      tagIds.push(tagId);
    }


    // 更新创作者的用户标签
    const creator = await creatorRepository.getCreator(mid, Platform.BILIBILI);
    if (creator) {
      // 保留系统标签，只更新用户标签
      const systemTagWeights = creator.tagWeights.filter(tw => tw.source === TagSource.SYSTEM);
      const userTagWeights = tagIds.map(tagId => ({
        tagId,
        source: TagSource.USER,
        count: 0,
        createdAt: Date.now()
      }));
      
      await creatorRepository.updateTagWeights(mid, Platform.BILIBILI, [
        ...systemTagWeights,
        ...userTagWeights
      ]);
    }

    console.log("[Background] ✓ Successfully classified UP", mid, "with tags:", normalizedTagNames, "tagIds:", tagIds);
    const remaining =
      classificationQueue.length + pendingClassificationQueue.length + activeCollectionTabs.size;
    console.log("[Background] Progress:", remaining, "UPs remaining (including in-flight)");
    if (pageClassifyActive) {
      pageClassifyProcessed += 1;
      sendPageProgress(
        pageData.name || upNameMap.get(mid) || "自动分类",
        "分类完成，继续处理下一位UP"
      );
    }

    collectedPageData.delete(mid);

    await setValue("classifyStatus", { lastUpdate: Date.now() });

    isClassifying = false;
    await processNextClassification();
  } catch (error) {
    if (error instanceof LlmRequestError) {
      collectedPageData.delete(mid);
      isClassifying = false;
      await abortForLlmError(mid, pageData, error);
      return;
    }

    console.error("[Background] ✗ Classification error for UP", mid, ":", error);
    collectedPageData.delete(mid);
    isClassifying = false;
    if (pageClassifyActive) {
      pageClassifyProcessed += 1;
      sendPageProgress(pageData?.name || upNameMap.get(mid) || "自动分类", "分类失败，已跳过");
    }
  }
}

export async function stopAutoClassification(): Promise<boolean> {
  if (!pageClassifyActive) {
    return false;
  }

  pageClassifyStopping = true;
  classificationQueue.length = 0;
  pendingClassificationQueue.length = 0;
  collectedPageData.clear();
  sendPageProgress("正在停止分类", "关闭采集标签页并停止后续任务");

  await closeAllCollectionTabs();
  activeCollectionTabs.clear();

  if (!isClassifying) {
    await finishPageClassification("已停止");
  }

  return true;
}

export async function startAutoClassification(): Promise<boolean> {
  console.log("[Background] ===== Starting auto classification =====");

  if (pageClassifyActive) {
    console.log("[Background] Auto classification already running");
    return true;
  }

  // 获取已关注的UP列表
  const followedUPs = await creatorRepository.getFollowingCreators(Platform.BILIBILI);

  console.log("[Background] Loaded followed UP list:", followedUPs.length, "UPs");

  if (followedUPs.length === 0) {
    console.log("[Background] ✗ No followed UPs to classify. Please follow some UPs first.");
    return false;
  }

  resetPageClassifyState();
  pageClassifyActive = true;

  // 筛选出没有手动标签的已关注UP
  const upsWithoutTags = [];
  for (const up of followedUPs) {
    upNameMap.set(up.creatorId, up.name);
    const creator = await creatorRepository.getCreator(up.creatorId, Platform.BILIBILI);
    const existingTagIds = creator?.tagWeights
      .filter(tw => tw.source === TagSource.USER)
      .map(tw => tw.tagId) || [];

    if (existingTagIds.length === 0) {
      upsWithoutTags.push(up);
      console.log("[Background] UP", up.creatorId, "has no manual tags, will classify");
    } else {
      console.log("[Background] Skipping UP", up.creatorId, "- already has manual tags");
    }
  }


  for (const up of upsWithoutTags) {
    classificationQueue.push(up.creatorId);
  }
  pageClassifyTotal = classificationQueue.length;
  sendPageProgress("自动分类", `待分类 ${pageClassifyTotal} 位UP`);

  console.log("[Background] ✓ Classification queue created with", classificationQueue.length, "UPs");

  if (classificationQueue.length > 0) {
    // 使用TabOptions类型的配置来处理标签页操作
    const tabOptions: TabOptions = {
      tabs: typeof chrome !== "undefined" ? chrome.tabs : undefined,
      active: false
    };
    
    const tabs = tabOptions.tabs;
    if (!tabs || !tabs.create) {
      console.log("[Background] ✗ Tabs API not available for creating new tabs");
      await finishPageClassification("浏览器标签页能力不可用");
      return false;
    }

    const toOpen = Math.min(MAX_CONCURRENT_TABS, classificationQueue.length);
    console.log("[Background] Creating", toOpen, "tabs for concurrent collection");

    for (let i = 0; i < toOpen; i++) {
      const nextMid = classificationQueue.shift();
      if (!nextMid) break;
      await waitRandom();
      sendPageProgress(upNameMap.get(nextMid) || "自动分类", `正在打开页面采集内容 · ${pageClassifyProcessed}/${pageClassifyTotal}`);
      const created = await tabs.create({ url: buildUserSpaceUrl(nextMid), active: false });
      if (created?.id) {
        activeCollectionTabs.set(nextMid, created.id);
        createdCollectionTabs.add(created.id);
        console.log("[Background] Created tab", created.id, "for UP:", nextMid);
      }
    }
    return true;
  }

  await finishPageClassification("没有需要分类的UP");
  return false;
}
