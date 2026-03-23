import {
  getValue
} from "../../database/implementations/settings-repository.impl.js";
import { WatchEventRepository } from "../../database/implementations/watch-event-repository.impl.js";
import { VideoRepository } from "../../database/implementations/video-repository.impl.js";
import { CreatorRepository } from "../../database/implementations/creator-repository.impl.js";
import { TagRepository } from "../../database/implementations/tag-repository.impl.js";
import { ImageRepository } from "../../database/implementations/image-repository.impl.js";
import { Platform } from "../../database/types/base.js";
import type { WatchEvent } from "../../database/types/behavior.js";
import type { Video } from "../../database/types/video.js";
import type { Creator } from "../../database/types/creator.js";
import type { TagSource } from "../../database/types/base.js";
import type { WatchProgressPayload } from "./types.js";

// 创建共享的 repository 实例
const imageRepository = new ImageRepository();
const watchEventRepository = new WatchEventRepository();
const videoRepository = new VideoRepository();
const creatorRepository = new CreatorRepository(imageRepository);
const tagRepository = new TagRepository();

/**
 * 更新观看统计数据
 * 记录观看事件并保存视频信息
 */
export async function updateWatchStats(
  payload: WatchProgressPayload
): Promise<void> {
  console.log("[WatchStats] Updating watch time stats with payload:", payload);

  const delta = Math.max(0, payload.watchedSeconds || 0);
  if (delta <= 0 || !payload.bvid) {
    return;
  }

  // 记录观看事件
  await recordWatchEvent(payload);

  // 保存视频信息
  await saveVideoInfo(payload);

  console.log("[WatchStats] Watch event saved to database");
}

/**
 * 初始化视频信息（第一次观看时调用）
 */
export async function initializeVideoInfo(
  payload: WatchProgressPayload
): Promise<void> {
  console.log("[WatchStats] Initializing video info with payload:", payload);
  if (!payload.bvid) {
    return;
  }

  await saveVideoInfo(payload);
  console.log("[WatchStats] Video info saved to database:", payload.bvid);
}

/**
 * 处理UP信息（添加新UP或更新现有UP）
 */
export async function processUPInfo(
  payload: WatchProgressPayload
): Promise<void> {
  if (!payload.upMid) {
    return;
  }

  const settings = (await getValue("settings")) as { userId?: number } | null;
  const currentUserId = settings?.userId;
  if (currentUserId && payload.upMid === currentUserId) {
    console.log("[WatchStats] Skipping current user record:", payload.upMid);
    return;
  }

  console.log("[WatchStats] Processing UP info:", payload.upMid);
  const creatorId = String(payload.upMid);
  const existingCreator = await creatorRepository.getCreator(creatorId, Platform.BILIBILI);

  if (!existingCreator) {
    // UP不存在于数据库中，添加并标记为未关注
    console.log("[WatchStats] Adding new UP to database:", payload.upMid);
    const newCreator: Creator = {
      creatorId,
      platform: Platform.BILIBILI,
      name: payload.upName || "",
      avatar: '',
      avatarUrl: payload.upFace || "",
      isLogout: 0,
      description: '',
      createdAt: Date.now(),
      followTime: 0,
      isFollowing: 0,
      tagWeights: []
    };
    await creatorRepository.upsertCreator(newCreator);
    console.log("[WatchStats] New UP added to database:", payload.upMid);
  } else {
    // 更新现有UP的信息（如果需要）
    let needUpdate = false;
    if (payload.upName && existingCreator.name !== payload.upName) {
      existingCreator.name = payload.upName;
      needUpdate = true;
    }
    if (payload.upFace && existingCreator.avatarUrl !== payload.upFace) {
      existingCreator.avatarUrl = payload.upFace;
      needUpdate = true;
    }
    if (needUpdate) {
      await creatorRepository.upsertCreator(existingCreator);
      console.log("[WatchStats] UP info updated:", payload.upMid);
    }
  }
}

/**
 * 处理视频标签（添加到标签库并更新UP的标签权重）
 */
export async function processVideoTags(
  payload: WatchProgressPayload
): Promise<void> {
  if (!payload.tags || payload.tags.length === 0) {
    return;
  }

  console.log("[WatchStats] Processing video tags:", payload.tags);

  // 将标签添加到标签库，并获取标签ID（程序自动收集的标签）
  const tagIds = await tagRepository.createTags(payload.tags, 'system' as TagSource);

  // 更新视频的标签
  if (payload.bvid) {
    const existingVideo = await videoRepository.getVideo(payload.bvid, Platform.BILIBILI);
    if (existingVideo) {
      const updatedVideo: Video = {
        ...existingVideo,
        tags: tagIds
      };
      await videoRepository.upsertVideo(updatedVideo);
    }
  }

  // 如果有UP，更新UP的标签权重
  if (payload.upMid) {
    const creatorId = String(payload.upMid);
    const creator = await creatorRepository.getCreator(creatorId, Platform.BILIBILI);
    if (creator) {
      const tagWeights = tagIds.map(tagId => ({
        tagId,
        source: 'system' as TagSource,
        count: 1,
        createdAt: Date.now()
      }));
      await creatorRepository.updateTagWeights(creatorId, Platform.BILIBILI, tagWeights);
      console.log(`[WatchStats] Updated tag weights for UP ${payload.upMid}`);
    }
  }

  console.log("[WatchStats] Video tags saved to database");
}

/**
 * 记录观看事件
 */
async function recordWatchEvent(payload: WatchProgressPayload): Promise<void> {
  if (!payload.bvid) {
    return;
  }

  const watchEvent: Omit<WatchEvent, 'eventId'> = {
    platform: Platform.BILIBILI,
    videoId: payload.bvid,
    creatorId: payload.upMid ? String(payload.upMid) : '',
    watchTime: payload.timestamp,
    watchDuration: payload.watchedSeconds,
    videoDuration: payload.duration,
    progress: payload.currentTime ? payload.currentTime / payload.duration : 0,
    isComplete: payload.currentTime && payload.duration ? (payload.currentTime / payload.duration >= 0.9 ? 1 : 0) : 0,
    endTime: Date.now()
  };

  await watchEventRepository.recordWatchEvent(watchEvent);
}

/**
 * 保存视频信息
 */
async function saveVideoInfo(payload: WatchProgressPayload): Promise<void> {
  if (!payload.bvid) {
    return;
  }

  const existingVideo = await videoRepository.getVideo(payload.bvid, Platform.BILIBILI);

  const video: Video = existingVideo || {
    videoId: payload.bvid,
    platform: Platform.BILIBILI,
    creatorId: payload.upMid ? String(payload.upMid) : '',
    title: payload.title,
    description: '',
    duration: payload.duration,
    publishTime: payload.timestamp,
    tags: [],
    createdAt: Date.now(),
    coverUrl: '',
    isInvalid: false
  };

  // 如果视频已存在，只更新必要的信息
  if (existingVideo) {
    video.title = payload.title;
    video.duration = payload.duration;
  }

  await videoRepository.upsertVideo(video);
}
