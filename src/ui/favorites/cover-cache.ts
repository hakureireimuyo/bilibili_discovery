import type { AggregatedVideo } from "./types.js";
import { VideoRepository } from "../../database/implementations/video-repository.impl.js";
import { Platform } from "../../database/types/base.js";
import { LRUCache } from "./cache.js";
import { AsyncTaskCache } from "./async-task-cache.js";
import { getVideoDetail } from "../../api/bili-api.js";

const videoRepository = new VideoRepository();
const BILIBILI = Platform.BILIBILI;

const pictureCache = new LRUCache<string, string>(100);
const pictureTasks = new AsyncTaskCache<string, string | null>();

// 用于缓存视频详情的请求，避免重复请求
const videoDetailTasks = new AsyncTaskCache<string, string | null>();

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function savePictureToDatabase(videoId: string, picture: string, url?: string) {
  await videoRepository.updateVideoPicture(videoId, BILIBILI, picture, url);
}

export async function fetchAndCachePicture(
  video: AggregatedVideo
): Promise<string | null> {
  // 首先检查内存缓存
  const cached = pictureCache.get(video.videoId);
  if (cached) {
    return cached;
  }

  return pictureTasks.getOrCreate(video.videoId, async () => {
    try {
      // 先从数据库获取缓存的图片
      const dbVideo = await videoRepository.getVideo(video.videoId, BILIBILI);
      if (dbVideo?.picture) {
        // 数据库中有缓存的图片，直接使用
        pictureCache.set(video.videoId, dbVideo.picture);
        return dbVideo.picture;
      }

      // 如果 coverUrl 未定义，尝试获取视频详情
      let coverUrl = video.coverUrl;
      if (!coverUrl) {
        console.log(`[CoverCache] No coverUrl for ${video.videoId}, fetching video detail...`);
        const videoDetail = await getVideoDetail(video.videoId);
        if (videoDetail?.pic) {
          coverUrl = videoDetail.pic;
          // 更新数据库中的 coverUrl
          await videoRepository.upsertVideo({
            ...dbVideo!,
            coverUrl: coverUrl
          });
        } else {
          console.warn(`[CoverCache] Failed to get video detail for ${video.videoId}`);
          return null;
        }
      }

      // 从网络下载图片（带重试机制）
      const blob = await fetchPictureWithRetry(coverUrl, 3, 1000);
      const picture = await blobToDataUrl(blob);

      // 更新内存缓存
      pictureCache.set(video.videoId, picture);

      // 保存到数据库（传入 URL 用于判断是否为同一图片）
      await savePictureToDatabase(video.videoId, picture, coverUrl);
      return picture;
    } catch (e) {
      console.warn("[CoverCache] failed:", video.videoId, e);
      return null;
    }
  });
}

/**
 * 带重试机制的图片下载函数
 */
async function fetchPictureWithRetry(
  url: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Blob> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.blob();
    } catch (error) {
      lastError = error as Error;
      console.warn(`[CoverCache] Attempt ${attempt}/${maxRetries} failed:`, url, error);

      // 如果不是最后一次尝试，等待一段时间后重试
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  // 所有尝试都失败，抛出最后一个错误
  throw lastError || new Error('Failed to fetch picture');
}

export function bindCoverImage(
  img: HTMLImageElement,
  video: AggregatedVideo
): void {
  const cached = pictureCache.get(video.videoId);

  if (cached) {
    img.src = cached;
    return;
  }

  // 如果 video 对象中已经有 picture 字段，直接使用
  if (video.picture) {
    img.src = video.picture;
    pictureCache.set(video.videoId, video.picture);
    return;
  }

  if (!video.coverUrl) {
    // 即使没有 coverUrl，也尝试获取并缓存图片
    void fetchAndCachePicture(video).then((p) => {
      if (p) {
        img.src = p;
      }
    });
    return;
  }

  // 先使用 coverUrl 显示图片
  img.src = video.coverUrl;

  // 异步获取并缓存图片
  void fetchAndCachePicture(video).then((p) => {
    if (p && img.src !== p) {
      img.src = p;
    }
  });
}

export function bindCoverImageWithLazyLoad(
  img: HTMLImageElement,
  video: AggregatedVideo
): void {
  img.loading = "lazy";
  img.decoding = "async";

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          bindCoverImage(img, video);
          observer.unobserve(img);
        }
      }
    },
    { rootMargin: "50px", threshold: 0.01 }
  );

  observer.observe(img);
}