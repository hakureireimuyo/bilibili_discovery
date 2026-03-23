/**
 * ImageRepository（分表重构版）
 */

// 接口已移除，直接实现功能
import { Image, ImageMetadata, ImageData, ImagePurpose } from '../types/image.js';
import { PaginationParams, PaginationResult } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';
import { compressImage, shouldCompress } from '../../utls/image-utils.js';

function generateId(): string {
  return crypto.randomUUID();
}

export class ImageRepository {

  /**
   * 访问时间更新阈值（避免频繁写）
   */
  private ACCESS_UPDATE_THRESHOLD = 60_000; // 1分钟

  private normalizeTimeUpdate(lastAccessTime: number): boolean {
    return Date.now() - lastAccessTime > this.ACCESS_UPDATE_THRESHOLD;
  }

  /**
   * 创建图像
   */
  async createImage(
    image: Omit<ImageMetadata, 'id' | 'createdAt' | 'lastAccessTime' | 'dataId'> & { data: Blob }
  ): Promise<Image> {

    const now = Date.now();

    const metadataId = generateId();
    const dataId = generateId();

    // 压缩
    let finalData: Blob;
    try {
      const dataUrl = await this.blobToDataUrl(image.data);
      if (await shouldCompress(dataUrl, image.purpose)) {
        finalData = await compressImage(dataUrl, image.purpose);
      } else {
        finalData = image.data;
      }
    } catch {
      finalData = image.data;
    }

    const metadata: ImageMetadata = {
      id: metadataId,
      purpose: image.purpose,
      createdAt: now,
      lastAccessTime: now,
      dataId
    };

    const data: ImageData = {
      id: dataId,
      data: finalData
    };

    // ⚠️ 顺序写入（可升级为事务）
    await DBUtils.add(STORE_NAMES.IMAGES_DATA, data);
    await DBUtils.add(STORE_NAMES.IMAGES_METADATA, metadata);

    return {
      metadata,
      data
    };
  }

  /**
   * 获取图像（按需加载）
   */
  async getImage(id: string): Promise<Image | null> {
    const metadata = await DBUtils.get<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      id
    );

    if (!metadata) return null;

    const data = await DBUtils.get<ImageData>(
      STORE_NAMES.IMAGES_DATA,
      metadata.dataId
    );

    if (!data) return null;

    // 节流更新访问时间
    if (this.normalizeTimeUpdate(metadata.lastAccessTime)) {
      await DBUtils.put(STORE_NAMES.IMAGES_METADATA, {
        ...metadata,
        lastAccessTime: Date.now()
      });
    }

    return {
      metadata,
      data
    };
  }

  /**
   * 批量获取（优化访问时间更新）
   */
  async getImages(ids: string[]): Promise<Image[]> {
    const metas = await DBUtils.getBatch<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      ids
    );

    const dataIds = metas.map(m => m.dataId);

    const datas = await DBUtils.getBatch<ImageData>(
      STORE_NAMES.IMAGES_DATA,
      dataIds
    );

    const dataMap = new Map(datas.map(d => [d.id, d]));

    const now = Date.now();
    const needUpdate: ImageMetadata[] = [];

    const result: Image[] = [];

    for (const meta of metas) {
      const data = dataMap.get(meta.dataId);
      if (!data) continue;

      if (now - meta.lastAccessTime > this.ACCESS_UPDATE_THRESHOLD) {
        needUpdate.push({
          ...meta,
          lastAccessTime: now
        });
      }

      result.push({
        metadata: meta,
        data
      });
    }

    if (needUpdate.length > 0) {
      await DBUtils.putBatch(STORE_NAMES.IMAGES_METADATA, needUpdate);
    }

    return result;
  }

  /**
   * 按用途查询（只查 metadata，不加载 Blob）
   */
  async getImagesByPurpose(
    purpose: ImagePurpose,
    pagination: PaginationParams
  ): Promise<PaginationResult<ImageMetadata>> {

    const items: ImageMetadata[] = [];
    let total = 0;

    const offset = pagination.page * pagination.pageSize;
    let skipped = 0;

    await DBUtils.cursor<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      (value) => {
        if (value.purpose !== purpose) return;

        total++;

        if (skipped < offset) {
          skipped++;
          return;
        }

        if (items.length < pagination.pageSize) {
          items.push(value);
        } else {
          return false;
        }
      },
      'lastAccessTime',
      undefined,
      'prev'
    );

    return {
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize)
    };
  }

  /**
   * 更新图像数据
   */
  async updateImageData(id: string, newData: Blob): Promise<void> {
    const metadata = await DBUtils.get<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      id
    );
    if (!metadata) throw new Error('Image not found');

    let finalData: Blob;

    try {
      const dataUrl = await this.blobToDataUrl(newData);
      if (await shouldCompress(dataUrl, metadata.purpose)) {
        finalData = await compressImage(dataUrl, metadata.purpose);
      } else {
        finalData = newData;
      }
    } catch {
      finalData = newData;
    }

    await DBUtils.put(STORE_NAMES.IMAGES_DATA, {
      id: metadata.dataId,
      data: finalData
    });

    if (this.normalizeTimeUpdate(metadata.lastAccessTime)) {
      await DBUtils.put(STORE_NAMES.IMAGES_METADATA, {
        ...metadata,
        lastAccessTime: Date.now()
      });
    }
  }

  /**
   * 删除图像（双表删除）
   */
  async deleteImage(id: string): Promise<void> {
    const metadata = await DBUtils.get<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      id
    );

    if (!metadata) return;

    await DBUtils.delete(STORE_NAMES.IMAGES_METADATA, id);
    await DBUtils.delete(STORE_NAMES.IMAGES_DATA, metadata.dataId);
  }

  /**
   * 批量删除
   */
  async deleteImages(ids: string[]): Promise<void> {
    const metas = await DBUtils.getBatch<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      ids
    );

    const dataIds = metas.map(m => m.dataId);

    await DBUtils.deleteBatch(STORE_NAMES.IMAGES_METADATA, ids);
    await DBUtils.deleteBatch(STORE_NAMES.IMAGES_DATA, dataIds);
  }

  /**
   * 清理过期数据（只扫描 metadata）
   */
  async cleanupExpiredImages(expireTime: number): Promise<number> {
    const expiredMetaIds: string[] = [];
    const expiredDataIds: string[] = [];

    const range = IDBKeyRange.upperBound(expireTime);

    await DBUtils.cursor<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      (value) => {
        expiredMetaIds.push(value.id);
        expiredDataIds.push(value.dataId);
      },
      'lastAccessTime',
      range
    );

    if (expiredMetaIds.length > 0) {
      await DBUtils.deleteBatch(STORE_NAMES.IMAGES_METADATA, expiredMetaIds);
      await DBUtils.deleteBatch(STORE_NAMES.IMAGES_DATA, expiredDataIds);
    }

    return expiredMetaIds.length;
  }

  /**
   * 获取所有图像
   */
  async getAllImages(): Promise<Image[]> {
    const items: Image[] = [];
    
    await DBUtils.cursor<ImageMetadata>(
      STORE_NAMES.IMAGES_METADATA,
      (metadata) => {
        const dataPromise = DBUtils.get<ImageData>(
          STORE_NAMES.IMAGES_DATA,
          metadata.dataId
        );
        
        dataPromise.then(data => {
          if (data) {
            items.push({
              metadata,
              data
            });
          }
        });
        
        return true;
      }
    );
    
    return items;
  }

  /**
   * 辅助：Blob → DataURL
   */
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('blobToDataUrl failed'));
      reader.readAsDataURL(blob);
    });
  }
}