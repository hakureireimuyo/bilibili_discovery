
/**
 * 数据访问适配器
 * 负责适配API数据源
 */

import type { IVideoDataSource, IFavoriteDataSource } from "./types.js";

/**
 * B站API视频数据源适配器
 */
export class BiliApiVideoDataSource implements IVideoDataSource {
  constructor(
    private getVideoDetailFn: (bvid: string) => Promise<any>,
    private getVideoTagsFn: (bvid: string) => Promise<Array<{ tag_id: number; tag_name: string }>>
  ) {}

  async getVideoDetail(bvid: string): Promise<any> {
    return this.getVideoDetailFn(bvid);
  }

  async getVideoTags(bvid: string): Promise<Array<{ tag_id: number; tag_name: string }>> {
    return this.getVideoTagsFn(bvid);
  }
}

/**
 * B站API收藏数据源适配器
 */
export class BiliApiFavoriteDataSource implements IFavoriteDataSource {
  constructor(
    private getAllFavoriteVideosFn: (up_mid: number) => Promise<Array<{ bvid: string; intro: string }>>,
    private getFavoriteFoldersFn?: (up_mid: number) => Promise<Array<{ id: number; title: string; media_count: number }>>
  ) {}

  async getAllFavoriteVideos(up_mid: number): Promise<Array<{ bvid: string; intro: string }>> {
    return this.getAllFavoriteVideosFn(up_mid);
  }

  async getFavoriteFolders(up_mid: number): Promise<Array<{ id: number; title: string; media_count: number }>> {
    if (!this.getFavoriteFoldersFn) {
      throw new Error("getFavoriteFoldersFn not provided");
    }
    return this.getFavoriteFoldersFn(up_mid);
  }
}
