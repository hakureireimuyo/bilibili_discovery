/**
 * 数据访问适配器
 * 负责适配API数据源
 */

import type { CollectedFolder } from "../../../api/bili-api.js";
import type {
  CollectedFavoriteFolder,
  FavoriteFolder,
  FavoriteTag,
  FavoriteVideoApiDetail,
  FavoriteVideoEntry,
  IFavoriteDataSource,
  IVideoDataSource
} from "./types.js";

class RequestThrottler {
  private lastRequestTime = 0;
  private pendingPromise: Promise<void> | null = null;

  constructor(private readonly requestInterval: number) {}

  async wait(): Promise<void> {
    if (this.requestInterval <= 0) {
      return;
    }

    // 如果已经有等待中的请求，直接复用
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.requestInterval) {
      this.pendingPromise = new Promise(resolve => {
        setTimeout(() => {
          this.lastRequestTime = Date.now();
          this.pendingPromise = null;
          resolve();
        }, this.requestInterval - elapsed);
      });
      return this.pendingPromise;
    }

    this.lastRequestTime = Date.now();
  }
}

/**
 * B站API视频数据源适配器
 */
export class BiliApiVideoDataSource implements IVideoDataSource {
  private readonly throttler: RequestThrottler;

  constructor(
    private readonly getVideoDetailFn: (bvid: string) => Promise<FavoriteVideoApiDetail | null>,
    private readonly getVideoTagsFn: (bvid: string) => Promise<FavoriteTag[]>,
    requestInterval = 2500
  ) {
    this.throttler = new RequestThrottler(requestInterval);
  }

  async getVideoDetail(bvid: string): Promise<FavoriteVideoApiDetail | null> {
    try {
      await this.throttler.wait();
      return await this.getVideoDetailFn(bvid);
    } catch (error) {
      console.error(`[BiliApiVideoDataSource] Failed to get video detail for ${bvid}:`, error);
      return null;
    }
  }

  async getVideoTags(bvid: string): Promise<FavoriteTag[]> {
    try {
      await this.throttler.wait();
      return await this.getVideoTagsFn(bvid);
    } catch (error) {
      console.error(`[BiliApiVideoDataSource] Failed to get video tags for ${bvid}:`, error);
      return [];
    }
  }
}

/**
 * B站API收藏数据源适配器
 */
export class BiliApiFavoriteDataSource implements IFavoriteDataSource {
  private readonly throttler: RequestThrottler;

  constructor(
    private readonly getAllFavoriteVideosFn: (upMid: number) => Promise<FavoriteVideoEntry[]>,
    private readonly getFavoriteFoldersFn?: (upMid: number) => Promise<FavoriteFolder[]>,
    private readonly getFavoriteVideosFn?: (
      mediaId: number,
      page: number,
      pageSize: number
    ) => Promise<FavoriteVideoEntry[]>,
    private readonly getCollectedFoldersFn?: (upMid: number) => Promise<CollectedFolder[]>,
    private readonly getCollectedVideosFn?: (
      mediaId: number,
      page: number,
      pageSize: number
    ) => Promise<FavoriteVideoEntry[]>,
    private readonly getSeasonVideosFn?: (
      seasonId: number,
      page: number,
      pageSize: number
    ) => Promise<FavoriteVideoEntry[]>,
    requestInterval = 2500
  ) {
    this.throttler = new RequestThrottler(requestInterval);
  }

  async getAllFavoriteVideos(
    upMid: number,
    shouldStop?: () => Promise<boolean>
  ): Promise<FavoriteVideoEntry[]> {
    const folders = await this.getFavoriteFolders(upMid);
    const allVideos: FavoriteVideoEntry[] = [];
    const pageSize = 20;

    for (const folder of folders) {
      let page = 1;

      while (true) {
        if (shouldStop && (await shouldStop())) {
          return allVideos;
        }

        const videos = await this.getFavoriteVideos(folder.id, page, pageSize);
        if (videos.length === 0) {
          break;
        }

        allVideos.push(
          ...videos.map(video => ({
            bvid: video.bvid,
            intro: String(folder.id)
          }))
        );

        if (videos.length < pageSize) {
          break;
        }

        page += 1;
      }
    }

    return allVideos;
  }

  async getFavoriteFolders(upMid: number): Promise<FavoriteFolder[]> {
    if (!this.getFavoriteFoldersFn) {
      throw new Error("getFavoriteFoldersFn not provided");
    }

    try {
      await this.throttler.wait();
      return await this.getFavoriteFoldersFn(upMid);
    } catch (error) {
      console.error(`[BiliApiFavoriteDataSource] Failed to get favorite folders for user ${upMid}:`, error);
      return [];
    }
  }

  async getFavoriteVideos(mediaId: number, page: number, pageSize: number): Promise<FavoriteVideoEntry[]> {
    if (!this.getFavoriteVideosFn) {
      throw new Error("getFavoriteVideosFn not provided");
    }

    try {
      await this.throttler.wait();
      return await this.getFavoriteVideosFn(mediaId, page, pageSize);
    } catch (error) {
      console.error(`[BiliApiFavoriteDataSource] Failed to get videos for folder ${mediaId} page ${page}:`, error);
      return [];
    }
  }

  async getCollectedFolders(upMid: number): Promise<CollectedFavoriteFolder[]> {
    if (!this.getCollectedFoldersFn) {
      throw new Error("getCollectedFoldersFn not provided");
    }

    try {
      await this.throttler.wait();
      const collectedFolders = await this.getCollectedFoldersFn(upMid);

      return collectedFolders.map(folder => ({
        id: folder.id,
        title: folder.title,
        media_count: folder.media_count,
        upper: {
          mid: folder.upper.mid,
          name: folder.upper.name
        }
      }));
    } catch (error) {
      console.error(`[BiliApiFavoriteDataSource] Failed to get collected folders for user ${upMid}:`, error);
      return [];
    }
  }

  async getCollectedVideos(mediaId: number, page: number, pageSize: number): Promise<FavoriteVideoEntry[]> {
    if (!this.getCollectedVideosFn) {
      throw new Error("getCollectedVideosFn not provided");
    }

    try {
      await this.throttler.wait();
      return await this.getCollectedVideosFn(mediaId, page, pageSize);
    } catch (error) {
      console.error(`[BiliApiFavoriteDataSource] Failed to get collected videos for folder ${mediaId} page ${page}:`, error);
      return [];
    }
  }

  async getSeasonVideos(seasonId: number, page: number, pageSize: number): Promise<FavoriteVideoEntry[]> {
    if (!this.getSeasonVideosFn) {
      throw new Error("getSeasonVideosFn not provided");
    }

    try {
      await this.throttler.wait();
      return await this.getSeasonVideosFn(seasonId, page, pageSize);
    } catch (error) {
      console.error(`[BiliApiFavoriteDataSource] Failed to get season videos for season ${seasonId} page ${page}:`, error);
      return [];
    }
  }
}
