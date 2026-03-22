/**
 * VideoRepository 实现
 * 实现视频相关的数据库操作
 */

import { IVideoRepository } from '../interfaces/video/video-repository.interface.js';
import { Video } from '../types/video.js';
import { Platform, PaginationParams, PaginationResult, TimeRange } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';
import { compressToTarget, shouldCompress} from '../../utls/image-compression.js'

/**
 * VideoRepository 实现类
 */
export class VideoRepository implements IVideoRepository {
  /**
   * 创建或更新视频信息
   */
  async upsertVideo(video: Video): Promise<void> {
    await DBUtils.put(STORE_NAMES.VIDEOS, video);
  }

  /**
   * 批量创建或更新视频信息
   */
  async upsertVideos(videos: Video[]): Promise<void> {
    await DBUtils.putBatch(STORE_NAMES.VIDEOS, videos);
  }

  /**
   * 获取视频信息
   */
  async getVideo(videoId: string, platform: Platform): Promise<Video | null> {
    const video = await DBUtils.get<Video>(STORE_NAMES.VIDEOS, videoId);
    if (!video || video.platform !== platform) {
      return null;
    }
    return video;
  }

  /**
   * 获取多个视频信息
   */
  async getVideos(videoIds: string[], platform: Platform): Promise<Video[]> {
    const allVideos = await DBUtils.getBatch<Video>(
      STORE_NAMES.VIDEOS,
      videoIds
    );
    return allVideos.filter(v => v.platform === platform && !v.isInvalid);
  }

  /**
   * 获取创作者的视频列表
   */
  async getCreatorVideos(
    creatorId: string,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>> {
    const allVideos = await DBUtils.getByIndex<Video>(
      STORE_NAMES.VIDEOS,
      'creatorId',
      creatorId
    );

    const filtered = allVideos.filter(v => v.platform === platform && !v.isInvalid);
    const sorted = filtered.sort((a, b) => b.publishTime - a.publishTime);

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      total: sorted.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(sorted.length / pagination.pageSize)
    };
  }

  /**
   * 按标签查询视频
   */
  async getVideosByTags(
    tagIds: string[],
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>> {
    const allVideos = await DBUtils.getAll<Video>(STORE_NAMES.VIDEOS);

    const filtered = allVideos.filter(v => 
      v.platform === platform && !v.isInvalid && v.tags.some(tag => tagIds.includes(tag))
    );

    const sorted = filtered.sort((a, b) => b.publishTime - a.publishTime);

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      total: sorted.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(sorted.length / pagination.pageSize)
    };
  }

  /**
   * 按时间范围查询视频
   */
  async getVideosByTimeRange(
    timeRange: TimeRange,
    platform: Platform,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>> {
    const allVideos = await DBUtils.getAll<Video>(STORE_NAMES.VIDEOS);

    const filtered = allVideos.filter(v =>
      v.platform === platform && !v.isInvalid &&
      v.publishTime >= timeRange.startTime &&
      v.publishTime <= timeRange.endTime
    );

    const sorted = filtered.sort((a, b) => b.publishTime - a.publishTime);

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      total: sorted.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(sorted.length / pagination.pageSize)
    };
  }

  /**
   * 搜索视频
   */
  async searchVideos(
    platform: Platform,
    keyword: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<Video>> {
    const allVideos = await DBUtils.getByIndex<Video>(
      STORE_NAMES.VIDEOS,
      'platform',
      platform
    );

    const lowerKeyword = keyword.toLowerCase();
    const filtered = allVideos.filter(v =>
      !v.isInvalid && (
        v.title.toLowerCase().includes(lowerKeyword) ||
        v.description.toLowerCase().includes(lowerKeyword)
      )
    );

    const sorted = filtered.sort((a, b) => b.publishTime - a.publishTime);

    const start = pagination.page * pagination.pageSize;
    const end = start + pagination.pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      total: sorted.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(sorted.length / pagination.pageSize)
    };
  }

  /**
   * 删除视频
   */
  async deleteVideo(videoId: string, platform: Platform): Promise<void> {
    await DBUtils.delete(STORE_NAMES.VIDEOS, videoId);
  }

  /**
   * 更新视频标签
   */
  async updateVideoTags(videoId: string, platform: Platform, tags: string[]): Promise<void> {
    const video = await this.getVideo(videoId, platform);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const updated: Video = {
      ...video,
      tags
    };

    await this.upsertVideo(updated);
  }

  /**
   * 更新视频封面缓存
   * @param videoId 视频ID
   * @param platform 平台
   * @param picture 图片数据（base64）
   * @param url 图片URL（可选，用于判断是否为同一图片）
   */
  async updateVideoPicture(
    videoId: string,
    platform: Platform,
    picture: string,
    url?: string
  ): Promise<void> {
    const video = await this.getVideo(videoId, platform);
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // 如果提供了 URL，通过 URL 判断是否为同一图片
    // 只有当 URL 相同且 picture 已存在时才跳过
    if (url && video.coverUrl === url && video.picture) {
      console.log(`[VideoRepository] Picture already cached for ${videoId}`);
      return;
    }

    let finalPicture = picture;

    try {
      // 判断是否需要压缩
      if (await shouldCompress(picture)) {
        finalPicture = await compressToTarget(picture);
      }
    } catch (e) {
      console.warn("[VideoRepository] compress failed:", videoId, e);
      // 出错时 fallback 原图
    }

    await this.upsertVideo({
      ...video,
      picture: finalPicture
    });
  }

  /**
   * 获取所有视频
   */
  async getAllVideos(): Promise<Video[]> {
    return DBUtils.getAll<Video>(STORE_NAMES.VIDEOS);
  }

  /**
 * 扫描数据库并压缩已有图片
 */
  async compressAllVideoPictures(
    platform: Platform,
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    const allVideos = await DBUtils.getAll<Video>(STORE_NAMES.VIDEOS);

    let processed = 0;
    const total = allVideos.length;

    for (const video of allVideos) {
      if (video.platform !== platform || video.isInvalid || !video.picture) {
        processed++;
        continue;
      }

      try {
        if (await shouldCompress(video.picture)) {
          const compressed = await compressToTarget(video.picture);

          await DBUtils.put(STORE_NAMES.VIDEOS, {
            ...video,
            picture: compressed
          });
        }
      } catch (e) {
        console.warn("[VideoRepository] batch compress failed:", video.videoId, e);
      }

      processed++;

      // 进度回调（可用于 UI）
      onProgress?.(processed, total);
    }
  }

}
