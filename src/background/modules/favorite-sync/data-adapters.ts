
/**
 * 数据访问适配器
 * 负责适配API数据源
 */

import type { IVideoDataSource, IFavoriteDataSource } from "./types.js";

/**
 * B站API视频数据源适配器
 */
export class BiliApiVideoDataSource implements IVideoDataSource {
  private requestInterval: number = 2500; // 默认2.5秒间隔
  private lastRequestTime: number = 0;

  constructor(
    private getVideoDetailFn: (bvid: string) => Promise<any>,
    private getVideoTagsFn: (bvid: string) => Promise<Array<{ tag_id: number; tag_name: string }>>,
    requestInterval?: number
  ) {
    if (requestInterval !== undefined) {
      this.requestInterval = requestInterval;
    }
  }

  /**
   * 确保请求间隔，避免触发风控
   */
  private async ensureRequestInterval(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.requestInterval) {
      const delay = this.requestInterval - elapsed;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  async getVideoDetail(bvid: string): Promise<any> {
    await this.ensureRequestInterval();
    return this.getVideoDetailFn(bvid);
  }

  async getVideoTags(bvid: string): Promise<Array<{ tag_id: number; tag_name: string }>> {
    await this.ensureRequestInterval();
    return this.getVideoTagsFn(bvid);
  }
}

/**
 * B站API收藏数据源适配器
 */
/**
 * B站API收藏数据源适配器
 */
export class BiliApiFavoriteDataSource implements IFavoriteDataSource {
  private requestInterval: number = 2500; // 默认2.5秒间隔
  private lastRequestTime: number = 0;

  constructor(
    private getAllFavoriteVideosFn: (up_mid: number) => Promise<Array<{ bvid: string; intro: string }>>,
    private getFavoriteFoldersFn?: (up_mid: number) => Promise<Array<{ id: number; title: string; media_count: number }>>,
    private getFavoriteVideosFn?: (media_id: number, pn: number, ps: number) => Promise<Array<{ bvid: string; intro: string }>>,
    requestInterval?: number
  ) {
    if (requestInterval !== undefined) {
      this.requestInterval = requestInterval;
    }
  }

  /**
   * 确保请求间隔，避免触发风控
   */
  private async ensureRequestInterval(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    console.log(`[BiliApiFavoriteDataSource] Request interval check: elapsed ${elapsed}ms, required ${this.requestInterval}ms`);

    if (elapsed < this.requestInterval) {
      const delay = this.requestInterval - elapsed;
      console.log(`[BiliApiFavoriteDataSource] Waiting ${delay}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    console.log(`[BiliApiFavoriteDataSource] Request interval updated: ${this.lastRequestTime}`);
  }

  async getAllFavoriteVideos(up_mid: number, shouldStop?: () => Promise<boolean>): Promise<Array<{ bvid: string; intro: string }>> {
    console.log(`[BiliApiFavoriteDataSource] Fetching all favorite videos for user ${up_mid}`);
    console.log(`[BiliApiFavoriteDataSource] shouldStop function provided: ${!!shouldStop}`);

    // 先获取所有收藏夹
    const folders = await this.getFavoriteFolders(up_mid);
    console.log(`[BiliApiFavoriteDataSource] Found ${folders.length} folders`);

    const allVideos: Array<{ bvid: string; intro: string }> = [];

    // 遍历所有收藏夹，获取其中的视频
    for (const folder of folders) {
      console.log(`[BiliApiFavoriteDataSource] Fetching videos for folder ${folder.id} (${folder.title})`);
      let page = 1;
      const pageSize = 20;

      while (true) {
        // 检查是否应该停止同步
        if (shouldStop) {
          const shouldStopValue = await shouldStop();
          console.log(`[BiliApiFavoriteDataSource] Checking shouldStop: ${shouldStopValue}`);
          if (shouldStopValue) {
            console.log(`[BiliApiFavoriteDataSource] Stopping fetch for folder ${folder.id}`);
            return allVideos;
          }
        }

        console.log(`[BiliApiFavoriteDataSource] Fetching page ${page} for folder ${folder.id}`);
        const videos = await this.getFavoriteVideos(folder.id, page, pageSize);
        console.log(`[BiliApiFavoriteDataSource] Got ${videos.length} videos from page ${page}`);

        if (videos.length === 0) {
          console.log(`[BiliApiFavoriteDataSource] No more videos for folder ${folder.id}`);
          break;
        }

        // 为每个视频添加收藏夹 ID
        const videosWithFolderId = videos.map(v => ({
          bvid: v.bvid,
          intro: folder.id.toString() // 使用收藏夹 ID 作为 intro
        }));

        console.log(`[BiliApiFavoriteDataSource] Added ${videosWithFolderId.length} videos to allVideos (total: ${allVideos.length + videosWithFolderId.length})`);
        allVideos.push(...videosWithFolderId);

        // 如果获取的视频数小于页大小，说明已经没有更多视频
        if (videos.length < pageSize) {
          break;
        }
        page++;
      }
    }

    console.log(`[BiliApiFavoriteDataSource] Total videos fetched: ${allVideos.length}`);
    console.log(`[BiliApiFavoriteDataSource] Sample videos:`, allVideos.slice(0, 3));
    console.log(`[BiliApiFavoriteDataSource] Returning allVideos`);
    return allVideos;
  }

  async getFavoriteFolders(up_mid: number): Promise<Array<{ id: number; title: string; media_count: number }>> {
    if (!this.getFavoriteFoldersFn) {
      throw new Error("getFavoriteFoldersFn not provided");
    }
    await this.ensureRequestInterval();
    return this.getFavoriteFoldersFn(up_mid);
  }

  async getFavoriteVideos(media_id: number, pn: number, ps: number): Promise<Array<{ bvid: string; intro: string }>> {
    console.log(`[BiliApiFavoriteDataSource] getFavoriteVideos called: media_id=${media_id}, pn=${pn}, ps=${ps}`);
    if (!this.getFavoriteVideosFn) {
      throw new Error("getFavoriteVideosFn not provided");
    }
    await this.ensureRequestInterval();
    console.log(`[BiliApiFavoriteDataSource] Calling getFavoriteVideosFn`);
    const result = await this.getFavoriteVideosFn(media_id, pn, ps);
    console.log(`[BiliApiFavoriteDataSource] getFavoriteVideosFn returned ${result.length} videos`);
    return result;
  }
}

