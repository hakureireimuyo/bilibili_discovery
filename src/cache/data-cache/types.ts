
/**
 * 数据缓存类型定义
 */

import type { Video, VideoStats, VideoHotness } from '../../database/types/video.js';
import type { Collection, CollectionItem } from '../../database/types/collection.js';
import type { Creator } from '../../database/types/creator.js';
import type { Image } from '../../database/types/image.js';
import type { ID } from '../../database/types/base.js';

/**
 * 视频完整数据
 * 包含视频的所有相关信息
 */
export interface VideoData {
  /** 视频基础信息 */
  video: Video;
  /** 视频统计信息 */
  stats?: VideoStats;
  /** 视频热度信息 */
  hotness?: VideoHotness;
  /** 创作者信息 */
  creator?: Creator;
  /** 封面图像 */
  coverImage?: Image;
}

/**
 * 收藏夹完整数据
 * 包含收藏夹的所有相关信息
 */
export interface CollectionData {
  /** 收藏夹信息 */
  collection: Collection;
  /** 收藏项列表 */
  items: CollectionItem[];
  /** 视频数据映射 */
  videos: Map<ID, VideoData>;
}

/**
 * 数据加载选项
 */
export interface DataLoadOptions {
  /** 是否加载统计信息 */
  loadStats?: boolean;
  /** 是否加载热度信息 */
  loadHotness?: boolean;
  /** 是否加载创作者信息 */
  loadCreator?: boolean;
  /** 是否加载封面图像 */
  loadCoverImage?: boolean;
  /** 是否预加载下一页 */
  preloadNext?: boolean;
  /** 预加载数量 */
  preloadCount?: number;
}

/**
 * 数据缓存配置
 */
export interface DataCacheConfig {
  /** 最大缓存数量 */
  maxSize: number;
  /** 预加载配置 */
  preloadConfig: {
    /** 是否启用预加载 */
    enabled: boolean;
    /** 预加载数量 */
    count: number;
  };
}
