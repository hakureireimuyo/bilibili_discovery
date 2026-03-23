/**
 * CollectionItemRepository 实现
 * 职责：仅管理收藏项自身数据，不涉及收藏夹的任何操作
 * 能力边界：仅支持对自己和代表视频的信息获取
 */

// 接口已移除，直接实现功能
import { CollectionItem } from '../types/collection.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * CollectionItemRepository 实现类
 */
export class CollectionItemRepository {

  async getItem(itemId: string): Promise<CollectionItem | null> {
    return DBUtils.get<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      itemId
    );
  }

  async getItemByCollectionAndVideo(
    collectionId: string,
    videoId: string
  ): Promise<CollectionItem | null> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    return items.find(item => item.videoId === videoId) || null;
  }

  async getVideoId(itemId: string): Promise<string | null> {
    const item = await this.getItem(itemId);
    return item?.videoId || null;
  }

  async getCollectionId(itemId: string): Promise<string | null> {
    const item = await this.getItem(itemId);
    return item?.collectionId || null;
  }

  async getAddedAt(itemId: string): Promise<number | null> {
    const item = await this.getItem(itemId);
    return item?.addedAt || null;
  }

  async getNote(itemId: string): Promise<string | null> {
    const item = await this.getItem(itemId);
    return item?.note || null;
  }

  async getOrder(itemId: string): Promise<number | null> {
    const item = await this.getItem(itemId);
    return item?.order || null;
  }

  async updateNote(itemId: string, note: string): Promise<void> {
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error(`CollectionItem not found: ${itemId}`);
    }

    const updated: CollectionItem = {
      ...item,
      note
    };

    await DBUtils.put(STORE_NAMES.COLLECTION_ITEMS, updated);
  }

  async updateOrder(itemId: string, order: number): Promise<void> {
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error(`CollectionItem not found: ${itemId}`);
    }

    const updated: CollectionItem = {
      ...item,
      order
    };

    await DBUtils.put(STORE_NAMES.COLLECTION_ITEMS, updated);
  }
}