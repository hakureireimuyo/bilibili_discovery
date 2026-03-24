/**
 * 图片加载管理器
 * 实现图片的按需加载和缓存
 */

import { ImageCache } from '../cache/image-cache/image-cache.js';
import { ImageRepository } from '../database/implementations/image-repository.impl.js';

/**
 * 图片加载选项
 */
export interface ImageLoadOptions {
  /** 图片用途 */
  purpose?: string;
  /** 图片宽度 */
  width?: number;
  /** 图片高度 */
  height?: number;
  /** 是否使用缓存 */
  useCache?: boolean;
}

/**
 * 图片加载结果
 */
export interface ImageLoadResult {
  /** 图片数据(Blob) */
  data: Blob;
  /** 是否来自缓存 */
  fromCache: boolean;
}

/**
 * 图片加载管理器
 */
export class ImageLoader {
  private imageCache: ImageCache;
  private imageRepository: ImageRepository;
  private loadingPromises: Map<string, Promise<string>> = new Map();

  constructor(
    maxCacheCount: number = 100
  ) {
    this.imageCache = new ImageCache(maxCacheCount);
    this.imageRepository = new ImageRepository();
  }

  /**
   * 加载图片
   * @param imageId 图片ID
   * @param options 加载选项
   * @returns 图片数据
   */
  async loadImage(
    imageId: string,
    options: ImageLoadOptions = {}
  ): Promise<ImageLoadResult> {
    const { useCache = true } = options;

    // 检查缓存
    if (useCache && this.imageCache.has(imageId)) {
      const cachedData = this.imageCache.get(imageId);
      if (cachedData) {
        return {
          data: cachedData,
          fromCache: true
        };
      }
    }

    // 防止重复加载同一张图片
    if (this.loadingPromises.has(imageId)) {
      const data = await this.loadingPromises.get(imageId)!;
      return {
        data,
        fromCache: false
      };
    }

    // 开始加载
    const loadPromise = this.loadImageFromDB(imageId);
    this.loadingPromises.set(imageId, loadPromise);

    try {
      const data = await loadPromise;

      // 存入缓存
      if (useCache) {
        this.imageCache.set(imageId, data);
      }

      return {
        data,
        fromCache: false
      };
    } finally {
      this.loadingPromises.delete(imageId);
    }
  }

  /**
   * 从数据库加载图片
   */
  private async loadImageFromDB(imageId: string): Promise<string> {
    const image = await this.imageRepository.getImage(imageId);
    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    // 将Blob转换为base64
    return this.blobToBase64(image.data.data);
  }

  /**
   * 批量加载图片
   * @param imageIds 图片ID列表
   * @param options 加载选项
   * @returns 图片数据映射
   */
  async loadImages(
    imageIds: string[],
    options: ImageLoadOptions = {}
  ): Promise<Map<string, ImageLoadResult>> {
    const results = new Map<string, ImageLoadResult>();

    // 并行加载所有图片
    const promises = imageIds.map(async (imageId) => {
      try {
        const result = await this.loadImage(imageId, options);
        results.set(imageId, result);
      } catch (error) {
        console.error(`[ImageLoader] Failed to load image ${imageId}:`, error);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * 预加载图片
   * @param imageIds 图片ID列表
   * @param options 加载选项
   */
  async preloadImages(
    imageIds: string[],
    options: ImageLoadOptions = {}
  ): Promise<void> {
    await this.loadImages(imageIds, options);
  }

  /**
   * 清除图片缓存
   * @param imageIds 图片ID列表(不传则清除所有)
   */
  clearCache(imageIds?: string[]): void {
    if (imageIds) {
      imageIds.forEach(id => this.imageCache.delete(id));
    } else {
      this.imageCache.clear();
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.imageCache.getStats();
  }

  /**
   * Blob转base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('blobToBase64 failed'));
      reader.readAsDataURL(blob);
    });
  }
}

// 导出单例实例
export const imageLoader = new ImageLoader();
