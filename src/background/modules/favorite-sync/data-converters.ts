
/**
 * 数据转换工具
 * 负责将API数据转换为数据库模型
 */

import { Platform, TagSource } from "../../../database/types/base.js";
import type { Video as DBVideo } from "../../../database/types/video.js";
import type { Creator as DBCreator } from "../../../database/types/creator.js";
import type { Tag as DBTag } from "../../../database/types/semantic.js";
import type { FavoriteTag, FavoriteVideoApiDetail } from "./types.js";

const BILIBILI = Platform.BILIBILI;

/**
 * 将API视频详情转换为数据库视频模型
 */
export function toDBVideo(videoDetail: FavoriteVideoApiDetail, tagIds: string[]): DBVideo {
  return {
    videoId: videoDetail.bvid,
    platform: BILIBILI,
    creatorId: videoDetail.owner.mid.toString(),
    title: videoDetail.title || "未知标题",
    description: videoDetail.desc || "",
    duration: videoDetail.duration || 0,
    publishTime: videoDetail.pubdate ? videoDetail.pubdate * 1000 : Date.now(),
    tags: tagIds,
    createdAt: Date.now(),
    coverUrl: videoDetail.pic || ""
  };
}

/**
 * 批量将API视频详情转换为数据库视频模型
 */
export function toDBVideos(videoDetails: Array<FavoriteVideoApiDetail & { tagIds: string[] }>): DBVideo[] {
  return videoDetails.map(detail => toDBVideo(detail, detail.tagIds));
}

/**
 * 创建失效视频的数据库模型
 * 用于标记无法获取详情的视频（如被删除、下架等）
 */
export function toInvalidVideo(bvid: string, creatorId?: string, reason?: string): DBVideo {
  return {
    videoId: bvid,
    platform: BILIBILI,
    creatorId: creatorId || "unknown",
    title: "失效视频",
    description: reason || "该视频已失效或无法获取详情",
    duration: 0,
    publishTime: Date.now(),
    tags: [],
    createdAt: Date.now(),
    isInvalid: true
  };
}

/**
 * 将API UP主信息转换为数据库UP主模型
 */
export function toDBCreator(mid: number, name: string): DBCreator {
  return {
    creatorId: mid.toString(),
    platform: BILIBILI,
    name: name || "未知UP主",
    avatar: "",
    avatarUrl: "",
    description: "",
    isFollowing: 0,
    createdAt: Date.now(),
    followTime: Date.now(),
    isLogout: 0,
    tagWeights: []
  };
}

/**
 * 将API标签转换为数据库标签模型
 */
export function toDBTag(tag: FavoriteTag): DBTag {
  return {
    tagId: tag.tag_id.toString(),
    name: tag.tag_name || "未知标签",
    source: TagSource.USER,
    createdAt: Date.now()
  };
}

/**
 * 批量将API标签转换为数据库标签模型
 */
export function toDBTags(tags: FavoriteTag[]): DBTag[] {
  return tags.map(tag => toDBTag(tag));
}
