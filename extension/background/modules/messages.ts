import { getUPInfo, getUPVideos, getVideoTags } from "../../api/bili-api.js";
import { randomUP, randomVideo, recommendUP, recommendVideo, updateInterestFromWatch } from "../../engine/recommender.js";
import { 
  getValue, 
  setValue, 
  loadUPList, 
  saveUPList, 
  updateUPTagWeights,
  addTagsToLibrary,
  getTagIdByName,
  updateUPFollowStatus,
  type UP 
} from "../../storage/storage.js";
import type { BackgroundOptions, MessageLike, WatchProgressPayload } from "./common-types.js";
import { classifyUpTask } from "./classify-api.js";
import { handleUPPageCollected, getPageClassifyProgress, startAutoClassification } from "./classify-page.js";
import { updateUpListTask } from "./up-list.js";
import { proxyApiRequest } from "./proxy.js";
import { updateWatchStats } from "./watch-stats.js";

declare const chrome: {
  tabs?: {
    query?: (queryInfo: { active?: boolean; currentWindow?: boolean }) => Promise<{ id?: number }[]>;
    update?: (tabId: number | undefined, updateProperties: { url: string }) => void;
  };
};

function toVideoUrl(bvid: string): string {
  return `https://www.bilibili.com/video/${bvid}`;
}

function toUpUrl(mid: number): string {
  return `https://space.bilibili.com/${mid}`;
}

export async function handleMessage(
  message: MessageLike,
  options: BackgroundOptions = {}
): Promise<unknown> {
  const getValueFn = options.getValueFn ?? ((key: string) => getValue(key));
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
    const payload = message.payload as { bvid?: string; watch_time?: number; duration?: number };
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

  if (message.type === "watch_progress") {
    const payload = message.payload as WatchProgressPayload | undefined;
    if (!payload?.bvid) {
      return null;
    }
    // 获取当前统计数据以判断是否是第一次观看
    const stats = await getValueFn("watchStats") as any;
    const videoKey = payload.bvid || payload.title || "unknown";
    const isFirstWatch = !stats?.videoFirstWatched?.[videoKey];
    
    await updateWatchStats(payload, options);
    await updateInterestFromWatchFn({
      tags: payload.tags ?? [],
      watch_time: payload.watchedSeconds ?? 0,
      duration: payload.duration ?? 0
    });
    
    // 只在第一次观看时更新 UP 标签统计
    if (isFirstWatch && payload.tags && payload.tags.length > 0) {
      // 将标签名称添加到标签库，并获取标签ID
      const addedTags = await addTagsToLibrary(payload.tags);
      const tagIds = addedTags.map(tag => tag.id);
      
      // 更新UP的标签权重
      if (payload.upMid) {
        await updateUPTagWeights(payload.upMid, tagIds);
        console.log(`[Background] Updated tag weights for UP ${payload.upMid}:`, tagIds);
      }

    }
    return null;
  }

  if (message.type === "detect_uid") {
    const payload = message.payload as { uid?: number };
    if (!payload?.uid) {
      return null;
    }
    const setValueFn = options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));
    const settings = (await getValueFn("settings")) as { userId?: number } | null;
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
    const cache = (await getValueFn("upList")) as { upList?: UP[] } | null;
    const upList = cache?.upList ?? [];
    const up = randomUPFn(upList);
    if (up) {
      const activeTab = await tabs.query?.({ active: true, currentWindow: true });
      if (!tabs.update) {
        return null;
      }
      if (activeTab && activeTab[0]?.id) {
        tabs.update(activeTab[0].id, { url: toUpUrl(up.mid) });
      } else {
        tabs.update(undefined, { url: toUpUrl(up.mid) });
      }
    }
    return null;
  }

  if (message.type === "random_video") {
    const cache = (await getValueFn("upList")) as { upList?: UP[] } | null;
    const upList = cache?.upList ?? [];
    const up = randomUPFn(upList);
    if (!up) return;
    const videos = await getUPVideosFn(up.mid);
    const video = randomVideoFn(videos);
    if (video) {
      const url = toVideoUrl(video.bvid);
      const activeTab = await tabs.query?.({ active: true, currentWindow: true });
      if (!tabs.update) {
        return null;
      }
      if (activeTab && activeTab[0]?.id) {
        tabs.update(activeTab[0].id, { url });
      } else {
        tabs.update(undefined, { url });
      }
    }
    return null;
  }

  if (message.type === "update_up_list") {
    await updateUpListTask(options);
    return null;
  }

  if (message.type === "classify_ups") {
    const settings = (await getValueFn("settings")) as { classifyMethod?: "api" | "page" } | null;
    const classifyMethod = settings?.classifyMethod ?? "api";

    if (classifyMethod === "api") {
      console.log("[Background] Using API method for classification");
      await classifyUpTask(options);
    } else {
      console.log("[Background] Using page scraping method for classification");
      await startAutoClassification(options);
    }
    return null;
  }

  if (message.type === "start_auto_classification") {
    const settings = (await getValueFn("settings")) as { classifyMethod?: "api" | "page" } | null;
    const classifyMethod = settings?.classifyMethod ?? "api";

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
    const setValueFn = options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));
    await setValueFn("upTags", {});
    await setValueFn("videoCounts", {});
    await setValueFn("classifyStatus", { lastUpdate: 0 });
    console.log("[Background] Cleared classify data");
    return null;
  }

  if (message.type === "follow_status_changed") {
    const payload = message.payload as {
      mid?: number;
      name?: string;
      face?: string;
      sign?: string;
      followed?: boolean;
    };

    if (!payload?.mid) {
      console.warn("[Background] Invalid follow status payload");
      return null;
    }

    const setValueFn = options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));
    const upCache = await loadUPList();
    const upList = upCache?.upList ?? [];

    try {
      if (payload.followed) {
        // 关注：添加到列表
        const exists = upList.some(up => up.mid === payload.mid);
        if (exists) {
          console.log("[Background] UP already in follow list, skipping:", payload.mid);
          // 更新UP信息（可能名称或头像有变化）
          const index = upList.findIndex(up => up.mid === payload.mid);
          if (index !== -1) {
            upList[index] = {
              ...upList[index],
              name: payload.name || upList[index].name,
              face: payload.face || upList[index].face,
              sign: payload.sign || upList[index].sign
            };
            await saveUPList(upList);
            console.log("[Background] Updated UP info:", payload.mid);
          }
        } else {
          const newUP: UP = {
            mid: payload.mid,
            name: payload.name || "",
            face: payload.face || "",
            sign: payload.sign || "",
            follow_time: Date.now(),
            is_followed: true
          };
          upList.push(newUP);
          await saveUPList(upList);
          console.log("[Background] Added UP to follow list:", newUP);
        }
      } else {
        // 取关：从列表中移除
        const index = upList.findIndex(up => up.mid === payload.mid);
        if (index === -1) {
          console.log("[Background] UP not in follow list, skipping removal:", payload.mid);
        } else {
          upList.splice(index, 1);
          await saveUPList(upList);
          console.log("[Background] Removed UP from follow list:", payload.mid);
        }
      }
    } catch (error) {
      console.error("[Background] Error updating follow list:", error);
      return { success: false, error: "Failed to update follow list" };
    }

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
      const activeTab = await tabs.query?.({ active: true, currentWindow: true });
      if (!tabs.update) {
        return null;
      }
      if (activeTab && activeTab[0]?.id) {
        tabs.update(activeTab[0].id, { url });
      } else {
        tabs.update(undefined, { url });
      }
      return { title: video.title, url };
    }
  }

  if (message.type === "get_classify_progress") {
    return getPageClassifyProgress();
  }

  return null;
}
