
/**
 * 收藏同步服务
 * 负责从B站同步收藏数据到本地数据库
 */

import { Platform } from "../../../database/types/base.js";
import type { FavoriteSyncConfig, FavoriteSyncResult, FavoriteSearchParams, FavoriteVideoDetail, IFavoriteSyncDependencies } from "./types.js";
import { DEFAULT_FAVORITE_SYNC_CONFIG } from "./config.js";
import { toDBVideo, toDBCreator, toDBTag } from "./data-converters.js";

const BILIBILI = Platform.BILIBILI;

/**
 * 收藏同步服务类
 */
export class FavoriteSyncService {
  private config: FavoriteSyncConfig;

  constructor(
    private dependencies: IFavoriteSyncDependencies,
    config: Partial<FavoriteSyncConfig> = {}
  ) {
    this.config = { ...DEFAULT_FAVORITE_SYNC_CONFIG, ...config };
  }

  /**
   * 同步收藏夹数据
   * @param up_mid 用户ID
   * @param shouldStop 停止同步的回调函数
   * @returns 同步结果
   */
  async syncFavoriteVideos(up_mid: number, shouldStop?: () => boolean): Promise<FavoriteSyncResult> {
    console.log("[FavoriteSync] Start syncing favorite videos for user:", up_mid);

    const result: FavoriteSyncResult = {
      syncedCount: 0,
      failedVideos: []
    };

    try {
      // 获取所有收藏视频
      const favoriteVideos = await this.dependencies.favoriteDataSource.getAllFavoriteVideos(up_mid);
      console.log(`[FavoriteSync] Found ${favoriteVideos.length} favorite videos`);

      // 获取或创建收藏夹
      let collection;
      if (this.config.createMultipleCollections) {
        // 获取B站收藏夹列表
        const folders = await this.dependencies.favoriteDataSource.getFavoriteFolders(up_mid);
        console.log(`[FavoriteSync] Found ${folders.length} favorite folders`);
        
        // 为每个B站收藏夹创建对应的本地收藏夹
        for (const folder of folders) {
          // 使用B站API返回的收藏夹ID作为本地收藏夹ID
          const collectionId = folder.id.toString();
          const folderCollection = await this.getOrCreateCollection(collectionId, folder.title, `从B站收藏夹"${folder.title}"同步的收藏视频`);
          if (folderCollection) {
            // 过滤出属于该收藏夹的视频
            const folderVideos = favoriteVideos.filter(v => v.intro === folder.id.toString());
            console.log(`[FavoriteSync] Processing folder "${folder.title}" with ${folderVideos.length} videos`);
            
            // 批量处理收藏视频
            for (let i = 0; i < folderVideos.length; i += this.config.batchSize) {
              // 检查是否应该停止同步
              if (shouldStop && shouldStop()) {
                console.log("[FavoriteSync] Sync stopped by user");
                break;
              }
              
              const batch = folderVideos.slice(i, i + this.config.batchSize);
              await this.processBatch(batch, folderCollection.collectionId, result, shouldStop);
            }
          }
        }
      } else {
        // 获取或创建默认收藏夹
        collection = await this.getOrCreateDefaultCollection();
        if (!collection) {
          throw new Error("Failed to create or get collection");
        }

        // 批量处理收藏视频
        for (let i = 0; i < favoriteVideos.length; i += this.config.batchSize) {
          // 检查是否应该停止同步
          if (shouldStop && shouldStop()) {
            console.log("[FavoriteSync] Sync stopped by user");
            break;
          }
          
          const batch = favoriteVideos.slice(i, i + this.config.batchSize);
          await this.processBatch(batch, collection.collectionId, result, shouldStop);
        }
      }

      console.log(`[FavoriteSync] Synced ${result.syncedCount} new videos`);
      return result;
    } catch (error) {
      console.error("[FavoriteSync] Error syncing favorite videos:", error);
      throw error;
    }
  }

  /**
   * 搜索收藏视频
   * @param params 搜索参数
   * @returns 搜索结果
   */
  async searchFavoriteVideos(params: FavoriteSearchParams): Promise<FavoriteVideoDetail[]> {
    const { collectionId, keyword, tagId, creatorId } = params;

    // 如果没有指定收藏夹ID，使用默认收藏夹
    const targetCollectionId = collectionId || this.config.defaultCollectionId;
    const collection = await this.dependencies.collectionRepository.getCollection(targetCollectionId);

    if (!collection) {
      return [];
    }

    // 获取收藏夹中的所有视频
    const { items } = await this.dependencies.collectionItemRepository.getCollectionVideos(
      collection.collectionId,
      { page: 0, pageSize: 1000 }
    );

    // 获取视频详情
    const videoIds = items.map((item: any) => item.videoId);
    const videos = await this.dependencies.videoRepository.getVideos(videoIds, BILIBILI);

    // 创建视频ID到收藏项的映射
    const itemMap = new Map(items.map((item: any) => [item.videoId, item]));

    // 合并视频详情和收藏项信息
    let merged = videos.map((video: any) => ({
      ...video,
      addedAt: (itemMap.get(video.videoId) as any)?.addedAt,
      picture: video.coverUrl
    }));

    // 应用过滤条件
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      merged = merged.filter((v: any) =>
        v.title.toLowerCase().includes(lowerKeyword) ||
        v.description.toLowerCase().includes(lowerKeyword)
      );
    }

    if (tagId) {
      merged = merged.filter((v: any) => v.tags.includes(tagId));
    }

    if (creatorId) {
      merged = merged.filter((v: any) => v.creatorId === creatorId);
    }

    return merged;
  }

  /**
   * 获取或创建收藏夹
   */
  private async getOrCreateCollection(collectionId: string, name: string, description: string) {
    let collection = await this.dependencies.collectionRepository.getCollection(collectionId);

    if (!collection) {
      // 使用指定的ID创建收藏夹
      await this.dependencies.collectionRepository.createCollectionWithId(collectionId, {
        platform: BILIBILI,
        name,
        description,
        createdAt: Date.now(),
        lastUpdate: Date.now()
      });
      collection = await this.dependencies.collectionRepository.getCollection(collectionId);
    }

    return collection;
  }

  /**
   * 获取或创建默认收藏夹
   */
  private async getOrCreateDefaultCollection() {
    return this.getOrCreateCollection(
      this.config.defaultCollectionId,
      this.config.defaultCollectionName,
      this.config.defaultCollectionDescription
    );
  }

  /**
   * 批量处理收藏视频
   */
  private async processBatch(
    batch: Array<{ bvid: string; intro: string }>,
    collectionId: string,
    result: FavoriteSyncResult,
    shouldStop?: () => boolean
  ): Promise<void> {
    for (const favVideo of batch) {
      // 检查是否应该停止同步
      if (shouldStop && shouldStop()) {
        console.log("[FavoriteSync] Sync stopped by user during batch processing");
        break;
      }
      try {
        // 获取视频详细信息
        const videoDetail = await this.dependencies.videoDataSource.getVideoDetail(favVideo.bvid);
        if (!videoDetail) {
          console.warn(`[FavoriteSync] Failed to get video detail for ${favVideo.bvid}`);
          result.failedVideos.push({ bvid: favVideo.bvid, error: "Failed to get video detail" });
          continue;
        }

        // 获取视频标签
        const videoTags = await this.dependencies.videoDataSource.getVideoTags(favVideo.bvid);

        // 确保UP主存在
        await this.ensureCreatorExists(videoDetail.owner.mid, videoDetail.owner.name);

        // 确保标签存在
        const tagIds = await this.ensureTagsExist(videoTags);

        // 保存视频信息
        const video = toDBVideo(videoDetail, tagIds);
        await this.dependencies.videoRepository.upsertVideo(video);

        // 添加到收藏夹
        const isInCollection = await this.dependencies.collectionItemRepository.isVideoInCollection(
          collectionId,
          favVideo.bvid
        );

        if (!isInCollection) {
          await this.dependencies.collectionItemRepository.addVideoToCollection(
            collectionId,
            favVideo.bvid,
            BILIBILI
          );
          result.syncedCount++;
        }
      } catch (error) {
        console.error(`[FavoriteSync] Error processing video ${favVideo.bvid}:`, error);
        result.failedVideos.push({ 
          bvid: favVideo.bvid, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * 确保UP主存在
   */
  private async ensureCreatorExists(mid: number, name: string): Promise<void> {
    const creatorId = mid.toString();
    const existing = await this.dependencies.creatorRepository.getCreator(creatorId, BILIBILI);

    if (!existing) {
      const creator = toDBCreator(mid, name);
      await this.dependencies.creatorRepository.upsertCreator(creator);
    }
  }

  /**
   * 确保标签存在
   */
  private async ensureTagsExist(tags: { tag_id: number; tag_name: string }[]): Promise<string[]> {
    const tagIds: string[] = [];

    for (const tag of tags) {
      const tagId = tag.tag_id.toString();
      const existing = await this.dependencies.tagRepository.getTag(tagId);

      if (!existing) {
        const dbTag = toDBTag(tag);
        await this.dependencies.tagRepository.createTag(dbTag);
      }

      tagIds.push(tagId);
    }

    return tagIds;
  }
}
