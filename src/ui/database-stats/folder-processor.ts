/**
 * 收藏夹处理器（简化版）
 * 专注于避免重复获取视频tag
 */

import { VideoRepositoryImpl } from "../../database/implementations/video-repository.impl.js";
import { CreatorRepositoryImpl } from "../../database/implementations/creator-repository.impl.js";
import { CollectionRepositoryImpl } from "../../database/implementations/collection-repository.impl.js";
import { CollectionItemRepositoryImpl } from "../../database/implementations/collection-item-repository.impl.js";
import { TagRepositoryImpl } from "../../database/implementations/tag-repository.impl.js";
import { getFavoriteVideos, getCollectedVideos, getSeasonVideos } from "../../api/favorite.js";
import { getVideoTagsDetail } from "../../api/video.js";
import { RateLimitError } from "../../api/request.js";

import type {
  FavoriteFolderInfo,
  FavoriteVideoInfo,
  SubscribedFavoriteFolderInfo,
  SubscribedFavoriteVideoInfo
} from "../../api/types.js";

import { Platform, TagSource } from "../../database/types/base.js";
import type { Video } from "../../database/types/video.js";
import type { ProgressCallback } from "./types.js";

/**
 * 通用视频结构（统一抽象）
 */
type NormalizedVideo = {
  bvid: string;
  title: string;
  intro: string;
  duration: number;
  pubtime: number;
  cover: string;
  upper: {
    mid: number;
    name: string;
    face?: string;
  };
};

/**
 * 视频获取策略
 */
type FetchStrategy<TFolder, TVideo> = {
  fetchVideos: (folderId: string, page: number, pageSize: number) => Promise<TVideo[]>;
  fetchAllVideos?: (folderId: string) => Promise<TVideo[]>;
  normalizeVideo: (video: TVideo) => NormalizedVideo;
  getDescription: (folder: TFolder) => string;
};

export class FolderProcessor {
  private videoRepo = new VideoRepositoryImpl();
  private creatorRepo = new CreatorRepositoryImpl();
  private collectionRepo = new CollectionRepositoryImpl();
  private collectionItemRepo = new CollectionItemRepositoryImpl();
  private tagRepo = new TagRepositoryImpl();

  /**
   * 处理收藏夹核心逻辑
   */
  private async processFolderCore<TFolder, TVideo>(
    folder: TFolder & { id: number | string; title: string; media_count: number },
    strategy: FetchStrategy<TFolder, TVideo>,
    onProgress: ProgressCallback,
    abortSignal: AbortSignal,
    folderType: "user" | "subscription" = "user"
  ) {
    const folderId = Number(folder.id);

    // 确保收藏夹存在
    const localCollection = await this.collectionRepo.getCollection(folderId);
    if (!localCollection) {
      await this.collectionRepo.createCollectionWithId(folderId, {
        platform: Platform.BILIBILI,
        name: folder.title,
        description: strategy.getDescription(folder),
        type: folderType,
        createdAt: Date.now(),
        lastUpdate: Date.now(),
        videoCount: folder.media_count
      });
    }

    // 判断是否需要获取视频
    // 如果本地数据库中的videoCount与API返回的media_count相同，则跳过获取
    if (localCollection && localCollection.videoCount === folder.media_count) {
      onProgress(1, folder.media_count, `收藏夹已存在且视频数量一致，跳过获取`);
      return;
    }

    // 获取所有视频
    const totalVideos: TVideo[] = [];

    try {
      if (abortSignal.aborted) throw new Error("AbortError");

      // 如果提供了fetchAllVideos方法，则一次性获取所有视频（适用于订阅收藏夹）
      if (strategy.fetchAllVideos) {
        const videos = await strategy.fetchAllVideos(String(folder.id));
        totalVideos.push(...videos);
        onProgress(0, totalVideos.length, `已获取 ${totalVideos.length} 个视频`);
      } else {
        // 否则使用分页获取（适用于普通收藏夹）
        let page = 1;
        const pageSize = 20;
        const maxPage = Math.ceil(folder.media_count / pageSize); // 计算最大页数

        while (page <= maxPage) {
          if (abortSignal.aborted) throw new Error("AbortError");

          const videos = await strategy.fetchVideos(String(folder.id), page, pageSize);
          if (videos.length === 0) break;

          totalVideos.push(...videos);
          onProgress(0, totalVideos.length, `已获取 ${totalVideos.length} 个视频`);

          if (videos.length < pageSize) break;
          page++;
        }
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      throw error;
    }

    // 处理每个视频
    for (let i = 0; i < totalVideos.length; i++) {
      if (abortSignal.aborted) throw new Error("AbortError");

      const raw = totalVideos[i];
      const video = strategy.normalizeVideo(raw);

      onProgress(i + 1, totalVideos.length, `正在处理视频: ${video.title}`);

      const isInvalid = video.title === "已失效视频";
      const creatorId = Number(video.upper.mid);

      // 处理创作者
      let creator = await this.creatorRepo.getCreator(creatorId);
      if (!creator) {
        creator = {
          creatorId,
          platform: Platform.BILIBILI,
          name: video.upper.name || "",
          avatar: 0,
          avatarUrl: video.upper.face || "",
          isLogout: 0,
          description: "",
          createdAt: Date.now(),
          followTime: Date.now(),
          isFollowing: 0,
          tagWeights: []
        };
        await this.creatorRepo.upsertCreator(creator);
      }

      // 检查视频是否已存在
      const existingVideo = await this.videoRepo.getVideoByBv(video.bvid);
      let videoId: number;
      const isNewVideo = !existingVideo;
      const hasTags = existingVideo?.tags && existingVideo.tags.length > 0;

      // 准备视频数据
      const videoData = {
        bv: video.bvid,
        platform: Platform.BILIBILI,
        creatorId,
        title: video.title,
        description: video.intro,
        duration: video.duration,
        publishTime: video.pubtime,
        tags: existingVideo?.tags || [],
        coverUrl: video.cover,
        isInvalid
      };

      if (existingVideo) {
        // 视频已存在，更新基本信息（不覆盖tags）
        const updated: Video = { ...existingVideo, ...videoData } as Video;
        await this.videoRepo.upsertVideo(updated);
        videoId = updated.videoId;

        // 如果视频已存在但没有tags，且视频未失效，则尝试获取tags
        if (!hasTags && !isInvalid) {
          try {
            const tags = await getVideoTagsDetail(video.bvid);
            if (tags?.length) {
              const tagIds: number[] = [];
              for (const t of tags) {
                const tagId = Number(t.tag_id);
                await this.tagRepo.createTagWithId(tagId, t.tag_name, TagSource.SYSTEM);
                tagIds.push(tagId);
              }
              await this.videoRepo.updateVideoTags(videoId, tagIds);
              
              // 将视频的tag信息添加到up主的tag信息中
              const tagWeights = tagIds.map(tagId => ({
                tagId,
                source: TagSource.SYSTEM,
                count: 1,
                createdAt: Date.now()
              }));
              await this.creatorRepo.updateTagWeights(creatorId, tagWeights);
            }
          } catch (e) {
            console.error("tag fetch error:", e);
          }
        }
      } else {
        // 新视频，创建并获取tags
        const created = await this.videoRepo.createVideo(videoData);
        videoId = created.videoId;

        // 只对新视频且没有失效时获取tags
        if (!isInvalid) {
          try {
            const tags = await getVideoTagsDetail(video.bvid);
            if (tags?.length) {
              const tagIds: number[] = [];
              for (const t of tags) {
                const tagId = Number(t.tag_id);
                await this.tagRepo.createTagWithId(tagId, t.tag_name, TagSource.SYSTEM);
                tagIds.push(tagId);
              }
              await this.videoRepo.updateVideoTags(videoId, tagIds);
              
              // 将视频的tag信息添加到up主的tag信息中
              const tagWeights = tagIds.map(tagId => ({
                tagId,
                source: TagSource.SYSTEM,
                count: 1,
                createdAt: Date.now()
              }));
              await this.creatorRepo.updateTagWeights(creatorId, tagWeights);
            }
          } catch (e) {
            console.error("tag fetch error:", e);
          }
        }
      }

      // 检查收藏项是否已存在于当前收藏夹
      const itemExists = await this.collectionRepo.hasVideoInCollection(folderId, videoId);
      if (!itemExists) {
        // 收藏项不存在，添加到收藏夹（自动维护计数器）
        try {
          await this.collectionRepo.addItemToCollection(folderId, {
            videoId,
            order: i
          });
        } catch (e) {
          // 如果添加失败（可能是重复），忽略错误
          console.error('Add item to collection error:', e);
        }
      }
    }
  }

  /**
   * 处理普通收藏夹
   */
  async processFolder(
    folder: FavoriteFolderInfo,
    onProgress: ProgressCallback,
    abortSignal: AbortSignal
  ) {
    return this.processFolderCore(folder, {
      fetchVideos: getFavoriteVideos,
      normalizeVideo: (v: FavoriteVideoInfo): NormalizedVideo => ({
        bvid: v.bvid,
        title: v.title,
        intro: v.intro || "",
        duration: v.duration,
        pubtime: v.pubtime,
        cover: v.cover,
        upper: {
          mid: Number(v.upper.mid),
          name: v.upper.name || "",
          face: v.upper.face
        }
      }),
      getDescription: () => "从B站导入的收藏夹"
    }, onProgress, abortSignal, "user");
  }

  /**
   * 处理订阅的收藏夹
   */
  async processCollectedFolder(
    folder: SubscribedFavoriteFolderInfo,
    onProgress: ProgressCallback,
    abortSignal: AbortSignal
  ) {
    return this.processFolderCore(folder, {
      fetchVideos: getSeasonVideos,
      fetchAllVideos: (seasonId: string) => getSeasonVideos(seasonId, 1, 1000),
      normalizeVideo: (v: SubscribedFavoriteVideoInfo): NormalizedVideo => ({
        bvid: v.bvid,
        title: v.title,
        intro: "",
        duration: v.duration,
        pubtime: v.pubtime,
        cover: v.cover,
        upper: {
          mid: Number(v.upper.mid),
          name: v.upper.name
        }
      }),
      getDescription: (f) => `从B站订阅的收藏夹: ${f.intro}`
    }, onProgress, abortSignal, "subscription");
  }
}