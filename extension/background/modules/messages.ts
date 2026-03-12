import { getUPInfo, getUPVideos, getVideoTags } from "../../api/bili-api.js";
import { randomUP, randomVideo, recommendUP, recommendVideo, updateInterestFromWatch } from "../../engine/recommender.js";
import { getValue, setValue, type UP } from "../../storage/storage.js";
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
    await updateWatchStats(payload, options);
    await updateInterestFromWatchFn({
      tags: payload.tags ?? [],
      watch_time: payload.watchedSeconds ?? 0,
      duration: payload.duration ?? 0
    });
    if (payload.tags && payload.tags.length > 0) {
      const existingTags = ((await getValueFn("upTags")) as Record<string, string[]> | null) ?? {};
      const customTags = ((await getValueFn("customTags")) as string[] | null) ?? [];
      const knownTagSet = new Set<string>([
        ...Object.values(existingTags).flat(),
        ...customTags
      ]);
      const nextCustom = [...customTags];
      for (const tag of payload.tags) {
        if (tag && !knownTagSet.has(tag)) {
          knownTagSet.add(tag);
          nextCustom.push(tag);
        }
      }
      if (nextCustom.length !== customTags.length) {
        await (options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value)))(
          "customTags",
          nextCustom
        );
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
