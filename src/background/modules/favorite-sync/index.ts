
/**
 * 收藏同步模块
 * 负责从B站同步收藏数据到本地数据库
 */

import { getAllFavoriteVideos, getVideoDetail, getVideoTagsDetail, getFavoriteFolders, getFavoriteVideos, getCollectedFolders, getCollectedVideos, getSeasonVideos } from "../../../api/bili-api.js";
import { VideoRepository } from "../../../database/implementations/video-repository.impl.js";
import { CollectionRepository } from "../../../database/implementations/collection-repository.impl.js";
import { CollectionItemRepository } from "../../../database/implementations/collection-item-repository.impl.js";
import { CreatorRepository } from "../../../database/implementations/creator-repository.impl.js";
import { TagRepository } from "../../../database/implementations/tag-repository.impl.js";
import { FavoriteSyncService } from "./favorite-sync-service.js";
import { BiliApiVideoDataSource, BiliApiFavoriteDataSource } from "./data-adapters.js";
import {DEFAULT_FAVORITE_SYNC_CONFIG } from './config.js'
import type { FavoriteVideoDetail, CancellationToken, SyncProgressCallback } from "./types.js";

// 创建单例服务实例
let syncServiceInstance: FavoriteSyncService | null = null;

/**
 * 获取收藏同步服务实例（单例模式）
 */
function getSyncService(): FavoriteSyncService {
  if (!syncServiceInstance) {
    // 获取默认配置
    const { requestInterval } = DEFAULT_FAVORITE_SYNC_CONFIG;
    
    // 创建数据源适配器，只在获取收藏夹视频列表数据的时候生效，视频信息获取不使用间隔
    const videoDataSource = new BiliApiVideoDataSource(getVideoDetail, getVideoTagsDetail, 0);
    const favoriteDataSource = new BiliApiFavoriteDataSource(
          getAllFavoriteVideos, 
          getFavoriteFolders, 
          getFavoriteVideos, 
          getCollectedFolders, 
          getCollectedVideos,
          getSeasonVideos,
          requestInterval
        );

    // 创建依赖对象
    const dependencies = {
      videoDataSource,
      favoriteDataSource,
      videoRepository: new VideoRepository(),
      collectionRepository: new CollectionRepository(),
      collectionItemRepository: new CollectionItemRepository(),
      creatorRepository: new CreatorRepository(),
      tagRepository: new TagRepository()
    };

    syncServiceInstance = new FavoriteSyncService(dependencies);
  }
  return syncServiceInstance;
}

/**
 * 重置服务实例
 * 用于测试或需要重新初始化服务的场景
 */
export function resetSyncService(): void {
  syncServiceInstance = null;
}

/**
 * 同步收藏夹数据（简化版）
 * @param up_mid 用户ID
 * @returns 同步的视频数量
 */
export async function syncFavoriteVideos(up_mid: number): Promise<number> {
  const service = getSyncService();
  const result = await service.syncFavoriteVideos(up_mid);
  return result.syncedCount;
}

/**
 * 同步收藏夹数据（完整版，支持取消和进度回调）
 * @param up_mid 用户ID
 * @param cancellationToken 取消令牌
 * @param progressCallback 进度回调
 * @returns 同步结果
 */
export async function syncFavoriteVideosWithProgress(
  up_mid: number,
  cancellationToken?: CancellationToken,
  progressCallback?: SyncProgressCallback
): Promise<import("./types.js").FavoriteSyncResult> {
  const service = getSyncService();
  const shouldStop = cancellationToken?.createStopChecker();
  return await service.syncFavoriteVideos(up_mid, shouldStop, progressCallback);
}

/**
 * 搜索收藏视频
 * @param collectionId 收藏夹ID（可选）
 * @param keyword 搜索关键词（可选）
 * @param tagId 标签ID（可选）
 * @param creatorId UP主ID（可选）
 * @returns 搜索结果
 */
export async function searchFavoriteVideos(
  collectionId?: string,
  keyword?: string,
  tagId?: string,
  creatorId?: string
): Promise<FavoriteVideoDetail[]> {
  const service = getSyncService();
  return service.searchFavoriteVideos({ collectionId, keyword, tagId, creatorId });
}

// 导出服务类和类型，供需要高级功能的模块使用
export { BiliApiVideoDataSource, BiliApiFavoriteDataSource } from "./data-adapters.js";
export { toDBVideo, toDBCreator, toDBTag, toDBTags } from "./data-converters.js";
export { DEFAULT_FAVORITE_SYNC_CONFIG } from "./config.js";
export { FavoriteSyncService } from "./favorite-sync-service.js";
export type {
  FavoriteSyncConfig,
  FavoriteSyncResult,
  FavoriteSearchParams,
  FavoriteVideoDetail,
  IVideoDataSource,
  IFavoriteDataSource,
  IFavoriteSyncDependencies,
  SyncProgress,
  SyncProgressCallback,
  CancellationToken
} from "./types.js";

// 导出取消令牌类
export { CancellationToken } from "./types.js";
