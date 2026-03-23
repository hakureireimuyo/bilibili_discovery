import { getUPInfo, getUPVideos, getVideoTags, getVideoDetail, getVideoTagsDetail } from "../../api/bili-api.js";
import { randomUP, randomVideo, recommendUP, recommendVideo, updateInterestFromWatch } from "../../engine/recommender.js";

// 全局变量，用于存储是否应该停止同步
let shouldStopSync = false;

// 同步进度状态
let syncProgressState = {
  active: false,
  current: 0,
  total: 0,
  title: "",
  detail: "",
  stopping: false
};

// 发送同步进度消息
function sendSyncProgress(): void {
  if (chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: "sync_progress",
      payload: { ...syncProgressState }
    }).catch(() => {
      // 忽略错误，可能是popup已关闭
    });
  }
}
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
} from "../../database/implementations/index.js";
import type { BackgroundOptions, MessageLike, WatchProgressPayload } from "./common-types.js";
import { classifyUpTask } from "./classify-api.js";
import { handleUPPageCollected, getPageClassifyProgress, startAutoClassification, stopAutoClassification } from "./classify-page.js";
import { updateUpListTask } from "./up-list.js";
import { proxyApiRequest } from "./proxy.js";
import { updateWatchStats, initializeVideoInfo, processUPInfo, processVideoTags } from "./watch-stats.js";
import { createInterestManager } from "./interest-manager.js";
import { syncFavoriteVideos, searchFavoriteVideos } from "./favorite-sync/index.js";
import { CollectionRepository } from "../../database/implementations/collection-repository.impl.js";
import { Platform, TagSource } from "../../database/types/base.js";
// import { getCollectionVideos, getAllCollectionVideos, getCollectionVideosPaginated, getAllCollectionVideosPaginated, getCollectionTags, getAllCollectionTags } from "../../database/implementations/collection-facade.impl.js";
import { VideoRepository, CreatorRepository, TagRepository, CollectionItemRepository } from "../../database/implementations/index.js";

declare const chrome: {
  runtime?: {
    sendMessage?: (message: unknown) => Promise<unknown>;
  };
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

  const collectionRepository = new CollectionRepository();

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
    // 只更新观看时间，不判断是否第一次观看
    
    await updateWatchStats(payload, options);
    await updateInterestFromWatchFn({
      tags: payload.tags ?? [],
      watch_time: payload.watchedSeconds ?? 0,
      duration: payload.duration ?? 0
    });

    // 触发兴趣计算
    const interestManager = createInterestManager();
    await interestManager.handleWatchEvent(payload.tags ?? []);
    


      

    return null;
  }

  if (message.type === "initialize_video_info") {
    const payload = message.payload as WatchProgressPayload | undefined;
    if (!payload?.bvid) {
      return null;
    }
    // 初始化视频信息
    await initializeVideoInfo(payload, options);
    return null;
  }

  if (message.type === "process_up_info") {
    const payload = message.payload as WatchProgressPayload | undefined;
    if (!payload?.upMid) {
      return null;
    }
    // 处理UP信息
    await processUPInfo(payload, options);
    return null;
  }

  if (message.type === "process_video_tags") {
    const payload = message.payload as WatchProgressPayload | undefined;
    if (!payload?.bvid) {
      return null;
    }
    // 处理视频标签
    await processVideoTags(payload, options);
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

  if (message.type === "get_value") {
    const payload = message.payload as { key?: string };
    if (!payload?.key) {
      return { success: false, error: "Missing key" };
    }
    const value = await getValueFn(payload.key);
    return { success: true, data: value };
  }

  const tabs = options.tabs ?? (typeof chrome !== "undefined" ? chrome.tabs : undefined);
  if (!tabs) {
    console.log("[Background] Tabs unavailable");
    return null;
  }

  if (message.type === "random_up") {
    const cache = await loadUPList();
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
    const cache = await loadUPList();
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
    const result = await updateUpListTask(options);
    return result;
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
      const started = await startAutoClassification(options);
      return { success: started };
    }
    return { success: true };
  }

  if (message.type === "stop_auto_classification") {
    const settings = (await getValueFn("settings")) as { classifyMethod?: "api" | "page" } | null;
    const classifyMethod = settings?.classifyMethod ?? "api";

    if (classifyMethod === "page") {
      const stopped = await stopAutoClassification(options);
      return { success: stopped };
    }
    return { success: false };
  }

  if (message.type === "up_page_collected") {
    await handleUPPageCollected(message, options);
    return null;
  }

  if (message.type === "clear_classify_data") {
    const setValueFn = options.setValueFn ?? ((key: string, value: unknown) => setValue(key, value));
    await setValueFn("upManualTagsCache", {});
    await setValueFn("upTagWeightsCache", {});
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

  if (message.type === "get_interest_stats") {
    const interestManager = createInterestManager();
    const stats = await interestManager.getInterestStats();
    return stats;
  }

  if (message.type === "initialize_interest_system") {
    const interestManager = createInterestManager();
    await interestManager.initialize();
    return { success: true };
  }

  if (message.type === "run_daily_interest_task") {
    const interestManager = createInterestManager();
    await interestManager.runDailyTask();
    return { success: true };
  }

  if (message.type === "run_weekly_interest_task") {
    const interestManager = createInterestManager();
    await interestManager.runWeeklyTask();
    return { success: true };
  }

  if (message.type === "run_monthly_interest_task") {
    const interestManager = createInterestManager();
    await interestManager.runMonthlyTask();
    return { success: true };
  }

  // 收藏相关消息处理
  // if (message.type === "favorite_action") {
  //   const payload = message.payload as { bvid?: string; action?: "add" | "remove"; title?: string };
  //   if (!payload?.bvid || !payload?.action) {
  //     return { success: false, error: "Invalid favorite action payload" };
  //   }
    
  //   try {
  //     if (payload.action === "add") {
  //       // 获取视频详细信息
  //       const videoDetail = await getVideoDetail(payload.bvid, undefined, { fallbackRequest: proxyApiRequest });
  //       if (!videoDetail) {
  //         return { success: false, error: "Failed to get video detail" };
  //       }
        
  //       // 获取视频标签
  //       const videoTags = await getVideoTagsDetail(payload.bvid, { fallbackRequest: proxyApiRequest });
        
  //       // 保存视频信息到数据库
  //       const videoRepo = new VideoRepository();
  //       const creatorRepo = new CreatorRepository();
  //       const tagRepo = new TagRepository();
        
  //       // 确保UP主存在
  //       const creatorId = videoDetail.owner.mid.toString();
  //       let creator = await creatorRepo.getCreator(creatorId, Platform.BILIBILI);
  //       if (!creator) {
  //         await creatorRepo.upsertCreator({
  //           creatorId,
  //           platform: Platform.BILIBILI,
  //           name: videoDetail.owner.name,
  //           avatar: "",
  //           avatarUrl: "",
  //           description: "",
  //           isFollowing: 0,
  //           createdAt: Date.now(),
  //           followTime: Date.now(),
  //           isLogout:0,
  //           tagWeights:[]
  //         });
  //       }
        
  //       // 确保标签存在
  //       const tagIds: string[] = [];
  //       for (const videoTag of videoTags) {
  //         const tagId = videoTag.tag_id.toString();
  //         let tag = await tagRepo.getTag(tagId);
  //         if (!tag) {
  //           await tagRepo.createTag({
  //             name: videoTag.tag_name,
  //             source: TagSource.USER,
  //             createdAt: Date.now(),
  //           });
  //         }
  //         tagIds.push(tagId);
  //       }
        
  //       // 保存视频信息
  //       await videoRepo.upsertVideo({
  //         videoId: payload.bvid,
  //         platform: Platform.BILIBILI,
  //         creatorId,
  //         title: videoDetail.title,
  //         description: videoDetail.desc,
  //         duration: 0,
  //         publishTime: videoDetail.pubdate * 1000,
  //         tags: tagIds,
  //         createdAt: Date.now(),
  //         coverUrl: videoDetail.pic
  //       });
        
  //       // 添加到收藏夹
  //       const collectionRepo = new CollectionRepository();
  //       const collectionItemRepo = new CollectionItemRepository();
        
  //       let collection = await collectionRepo.getCollection("bilibili_favorites");
  //       if (!collection) {
  //         const collectionId = await collectionRepo.createCollection({
  //           platform: Platform.BILIBILI,
  //           name: "B站收藏夹",
  //           description: "从B站同步的收藏视频",
  //           createdAt: Date.now(),
  //           lastUpdate: Date.now()
  //         });
  //         collection = await collectionRepo.getCollection(collectionId);
  //       }
        
  //       if (collection) {
  //         const isInCollection = await collectionItemRepo.isVideoInCollection(
  //           collection.collectionId,
  //           payload.bvid
  //         );
          
  //         if (!isInCollection) {
  //           await collectionItemRepo.addVideoToCollection(
  //             collection.collectionId,
  //             payload.bvid,
  //             Platform.BILIBILI
  //           );
  //         }
  //       }
  //     } else if (payload.action === "remove") {
  //       // 从收藏夹移除视频
  //       const collectionRepo = new CollectionRepository();
  //       const collectionItemRepo = new CollectionItemRepository();
        
  //       const collection = await collectionRepo.getCollection("bilibili_favorites");
  //       if (collection) {
  //         await collectionItemRepo.removeVideoFromCollection(
  //           collection.collectionId,
  //           payload.bvid
  //         );
  //       }
  //     }
      
  //     return { success: true };
  //   } catch (error) {
  //     console.error("[Background] Error handling favorite action:", error);
  //     return { success: false, error: String(error) };
  //   }
  // }

  if (message.type === "get_should_stop_sync") {
    return { success: true, shouldStop: shouldStopSync };
  }

  if (message.type === "get_sync_progress") {
    return { ...syncProgressState };
  }

  if (message.type === "set_should_stop_sync") {
    const payload = message.payload as { shouldStop?: boolean };
    if (payload?.shouldStop !== undefined) {
      shouldStopSync = payload.shouldStop;
      syncProgressState.stopping = payload.shouldStop;
      console.log(`[Background] shouldStopSync set to: ${shouldStopSync}`);
      sendSyncProgress();
      return { success: true };
    }
    return { success: false, error: "Missing shouldStop" };
  }

  if (message.type === "sync_favorite_videos") {
    const payload = message.payload as { uid?: number };
    if (!payload?.uid) {
      return { success: false, error: "Missing uid" };
    }
    
    try {
      // 重置 shouldStop 状态
      shouldStopSync = false;
      syncProgressState = {
        active: true,
        current: 0,
        total: 0,
        title: "同步收藏",
        detail: "准备中...",
        stopping: false
      };
      console.log(`[Background] Starting sync, shouldStopSync reset to: ${shouldStopSync}`);
      sendSyncProgress();

      // 创建 shouldStop 函数
      const shouldStop = async () => {
        console.log(`[Background] Checking shouldStopSync: ${shouldStopSync}`);
        return shouldStopSync;
      };

      const count = await syncFavoriteVideos(payload.uid, shouldStop);
      
      // 同步完成
      syncProgressState.active = false;
      sendSyncProgress();
      if (chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: "sync_complete",
          payload: { count }
        }).catch(() => {
          // 忽略错误，可能是popup已关闭
        });
      }
      
      return { success: true, count };
    } catch (error) {
      console.error("[Background] Error syncing favorite videos:", error);
      syncProgressState.active = false;
      sendSyncProgress();
      return { success: false, error: String(error) };
    }
  }

  if (message.type === "get_collections") {
    try {
      const collections = await collectionRepository.getAllCollections(Platform.BILIBILI);
      return { success: true, collections };
    } catch (error) {
      console.error("[Background] Error getting collections:", error);
      return { success: false, error: String(error) };
    }
  }

  // if (message.type === "get_collection_videos") {
  //   const payload = message.payload as { collectionId: string };
  //   console.log("[Background] Getting collection videos for:", payload.collectionId);

  //   try {
  //     const videos = await getCollectionVideos(payload.collectionId, Platform.BILIBILI);
  //     console.log("[Background] Collection videos result:", videos);
  //     return { success: true, videos };
  //   } catch (error) {
  //     console.error("[Background] Error getting collection videos:", error);
  //     return { success: false, error: String(error) };
  //   }
  // }

  // if (message.type === "get_collection_videos_paginated") {
  //   const payload = message.payload as { 
  //     collectionId: string; 
  //     page: number; 
  //     pageSize: number;
  //     keyword?: string;
  //     tagId?: string;
  //     creatorId?: string;
  //     includeTags?: string[];
  //     excludeTags?: string[];
  //   };
  //   console.log("[Background] Getting paginated collection videos for:", payload.collectionId);

  //   try {
  //     const result = await getCollectionVideosPaginated(
  //       payload.collectionId,
  //       { page: payload.page, pageSize: payload.pageSize },
  //       {
  //         keyword: payload.keyword,
  //         tagId: payload.tagId,
  //         creatorId: payload.creatorId,
  //         includeTags: payload.includeTags,
  //         excludeTags: payload.excludeTags
  //       },
  //       Platform.BILIBILI
  //     );
  //     console.log("[Background] Paginated collection videos result:", result);
  //     return { success: true, videos: result.videos, total: result.total };
  //   } catch (error) {
  //     console.error("[Background] Error getting paginated collection videos:", error);
  //     return { success: false, error: String(error) };
  //   }
  // }

  // if (message.type === "get_all_collection_videos") {
  //   console.log("[Background] Getting all collection videos");
  //   const payload = message.payload as { collectionType?: 'user' | 'subscription' };

  //   try {
  //     const videos = await getAllCollectionVideos(Platform.BILIBILI, payload.collectionType);
  //     console.log("[Background] All collection videos result:", videos);
  //     return { success: true, videos };
  //   } catch (error) {
  //     console.error("[Background] Error getting all collection videos:", error);
  //     return { success: false, error: String(error) };
  //   }
  // }

  // if (message.type === "get_all_collection_videos_paginated") {
  //   console.log("[Background] Getting all paginated collection videos");
  //   const payload = message.payload as { 
  //     page: number; 
  //     pageSize: number;
  //     collectionType?: 'user' | 'subscription';
  //     keyword?: string;
  //     tagId?: string;
  //     creatorId?: string;
  //     includeTags?: string[];
  //     excludeTags?: string[];
  //   };

  //   try {
  //     const result = await getAllCollectionVideosPaginated(
  //       { page: payload.page, pageSize: payload.pageSize },
  //       {
  //         keyword: payload.keyword,
  //         tagId: payload.tagId,
  //         creatorId: payload.creatorId,
  //         includeTags: payload.includeTags,
  //         excludeTags: payload.excludeTags
  //       },
  //       Platform.BILIBILI,
  //       payload.collectionType
  //     );
  //     console.log("[Background] All paginated collection videos result:", result);
  //     return { success: true, videos: result.videos, total: result.total };
  //   } catch (error) {
  //     console.error("[Background] Error getting all paginated collection videos:", error);
  //     return { success: false, error: String(error) };
  //   }
  // }

  // if (message.type === "get_collection_tags") {
  //   const payload = message.payload as { collectionId: string };
  //   console.log("[Background] Getting collection tags for:", payload.collectionId);

  //   try {
  //     const tags = await getCollectionTags(payload.collectionId, Platform.BILIBILI);
  //     console.log("[Background] Collection tags result:", tags);
  //     return { success: true, tags: Array.from(tags) };
  //   } catch (error) {
  //     console.error("[Background] Error getting collection tags:", error);
  //     return { success: false, error: String(error) };
  //   }
  // }

  // if (message.type === "get_all_collection_tags") {
  //   console.log("[Background] Getting all collection tags");
  //   const payload = message.payload as { collectionType?: 'user' | 'subscription' };

  //   try {
  //     const tags = await getAllCollectionTags(Platform.BILIBILI, payload.collectionType);
  //     console.log("[Background] All collection tags result:", tags);
  //     return { success: true, tags: Array.from(tags) };
  //   } catch (error) {
  //     console.error("[Background] Error getting all collection tags:", error);
  //     return { success: false, error: String(error) };
  //   }
  // }

  if (message.type === "search_favorite_videos") {
    const payload = message.payload as { collectionId?: string; keyword?: string; tagId?: string; creatorId?: string };
    
    try {
      const videos = await searchFavoriteVideos(
        payload.collectionId,
        payload.keyword,
        payload.tagId,
        payload.creatorId
      );
      return { success: true, videos };
    } catch (error) {
      console.error("[Background] Error searching favorite videos:", error);
      return { success: false, error: String(error) };
    }
  }

  return null;
}
