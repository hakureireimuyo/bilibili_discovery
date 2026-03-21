
/**
 * 收藏同步模块类型定义
 */

import type { Video as DBVideo } from "../../../database/types/video.js";
import type { Creator as DBCreator } from "../../../database/types/creator.js";
import type { Tag as DBTag } from "../../../database/types/semantic.js";

/**
 * 收藏同步配置
 */
export interface FavoriteSyncConfig {
  /** 默认收藏夹ID */
  defaultCollectionId: string;
  /** 默认收藏夹名称 */
  defaultCollectionName: string;
  /** 默认收藏夹描述 */
  defaultCollectionDescription: string;
  /** 每次同步的批次大小 */
  batchSize: number;
  /** 是否为每个B站收藏夹创建对应的本地收藏夹 */
  createMultipleCollections: boolean;
  /** 请求间隔时间（毫秒），用于避免触发风控 */
  requestInterval: number;
}

/**
 * 收藏同步结果
 */
export interface FavoriteSyncResult {
  /** 同步的视频数量 */
  syncedCount: number;
  /** 失败的视频列表 */
  failedVideos: Array<{ bvid: string; error: string }>;
}

/**
 * 收藏视频搜索参数
 */
export interface FavoriteSearchParams {
  /** 收藏夹ID */
  collectionId?: string;
  /** 搜索关键词 */
  keyword?: string;
  /** 标签ID */
  tagId?: string;
  /** UP主ID */
  creatorId?: string;
}

/**
 * 收藏视频详情（包含收藏项信息）
 */
export type FavoriteVideoDetail = DBVideo & {
  /** 添加到收藏夹的时间 */
  addedAt?: number;
  /** 封面图（兼容字段） */
  picture?: string;
};

/**
 * 视频数据源接口
 */
export interface IVideoDataSource {
  /** 获取视频详情 */
  getVideoDetail(bvid: string): Promise<any>;
  /** 获取视频标签 */
  getVideoTags(bvid: string): Promise<Array<{ tag_id: number; tag_name: string }>>;
}

/**
 * 收藏数据源接口
 */
export interface IFavoriteDataSource {
  /** 获取所有收藏视频 */
  getAllFavoriteVideos(up_mid: number, shouldStop?: () => Promise<boolean>): Promise<Array<{ bvid: string; intro: string }>>;
  /** 获取收藏夹列表 */
  getFavoriteFolders(up_mid: number): Promise<Array<{ id: number; title: string; media_count: number }>>;
  /** 获取收藏夹视频 */
  getFavoriteVideos(media_id: number, pn: number, ps: number): Promise<Array<{ bvid: string; intro: string }>>;
}

/**
 * 收藏同步依赖接口
 */
export interface IFavoriteSyncDependencies {
  /** 视频数据源 */
  videoDataSource: IVideoDataSource;
  /** 收藏数据源 */
  favoriteDataSource: IFavoriteDataSource;
  /** 视频仓库 */
  videoRepository: any;
  /** 收藏夹仓库 */
  collectionRepository: any;
  /** 收藏项仓库 */
  collectionItemRepository: any;
  /** UP主仓库 */
  creatorRepository: any;
  /** 标签仓库 */
  tagRepository: any;
}
