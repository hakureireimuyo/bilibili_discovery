/**
 * CollectionItemRepository 实现
 * 实现收藏项相关的数据库操作
 */

import { ICollectionItemRepository } from '../interfaces/collection/collection-item-repository.interface.js';
import { Collection, CollectionItem } from '../types/collection.js';
import { PaginationParams, PaginationResult } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * CollectionItemRepository 实现类
 */
export class CollectionItemRepository implements ICollectionItemRepository {
  /**
   * 向收藏夹添加视频
   */
  async addVideoToCollection(
    collectionId: string,
    videoId: string,
    platform: string,
    note?: string
  ): Promise<string> {

    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const item: CollectionItem = {
      itemId,
      collectionId,
      videoId,
      addedAt: Date.now(),
      note,
      order: Date.now()
    };


    try {
      await DBUtils.add(STORE_NAMES.COLLECTION_ITEMS, item);
    } catch (error) {
      console.error(`[CollectionItemRepository] Error adding item to database:`, error);
      throw error;
    }

    // 更新收藏夹的lastUpdate时间
    await this.updateCollectionLastUpdate(collectionId);

    return itemId;
  }

  /**
   * 批量添加视频到收藏夹
   */
  async addVideosToCollection(
    collectionId: string,
    videoIds: string[],
    platform: string
  ): Promise<string[]> {
    const itemIds: string[] = [];
    const items: CollectionItem[] = videoIds.map(videoId => {
      const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      itemIds.push(itemId);
      return {
        itemId,
        collectionId,
        videoId,
        addedAt: Date.now(),
        order: Date.now()
      };
    });

    await DBUtils.addBatch(STORE_NAMES.COLLECTION_ITEMS, items);
    await this.updateCollectionLastUpdate(collectionId);

    return itemIds;
  }

  /**
   * 从收藏夹移除视频
   */
  async removeVideoFromCollection(collectionId: string, videoId: string): Promise<void> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    const toDelete = items.find(item => item.videoId === videoId);
    if (toDelete) {
      await DBUtils.delete(STORE_NAMES.COLLECTION_ITEMS, toDelete.itemId);
      await this.updateCollectionLastUpdate(collectionId);
    }
  }

  /**
   * 批量从收藏夹移除视频
   */
  async removeVideosFromCollection(collectionId: string, videoIds: string[]): Promise<void> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    const toDelete = items
      .filter(item => videoIds.includes(item.videoId))
      .map(item => item.itemId);

    if (toDelete.length > 0) {
      await DBUtils.deleteBatch(STORE_NAMES.COLLECTION_ITEMS, toDelete);
      await this.updateCollectionLastUpdate(collectionId);
    }
  }

  /**
   * 获取收藏夹的视频列表
   */
  async getCollectionVideos(
    collectionId: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<CollectionItem>> {
    const allItems = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    const sorted = allItems.sort((a, b) => b.addedAt - a.addedAt);

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
   * 检查视频是否在收藏夹中
   */
  async isVideoInCollection(collectionId: string, videoId: string): Promise<boolean> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    const isInCollection = items.some(item => item.videoId === videoId);
    return isInCollection;
  }

  /**
   * 获取视频所在的收藏夹列表
   */
  async getVideoCollections(videoId: string, platform: string): Promise<Collection[]> {
    // TODO: 需要注入 CollectionRepository 来获取收藏夹信息
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'videoId',
      videoId
    );

    // 返回收藏夹ID列表，需要在外部转换为Collection对象
    const collectionIds = items.map(item => item.collectionId);
    return [] as Collection[];
  }

  /**
   * 更新收藏项
   */
  async updateCollectionItem(
    itemId: string,
    updates: Partial<Omit<CollectionItem, 'itemId' | 'collectionId' | 'addedAt'>>
  ): Promise<void> {
    const existing = await DBUtils.get<CollectionItem>(STORE_NAMES.COLLECTION_ITEMS, itemId);
    if (!existing) {
      throw new Error(`Collection item not found: ${itemId}`);
    }

    const updated: CollectionItem = {
      ...existing,
      ...updates
    };

    await DBUtils.put(STORE_NAMES.COLLECTION_ITEMS, updated);
    await this.updateCollectionLastUpdate(existing.collectionId);
  }

  /**
   * 获取收藏项
   */
  async getCollectionItem(itemId: string): Promise<CollectionItem | null> {
    return DBUtils.get<CollectionItem>(STORE_NAMES.COLLECTION_ITEMS, itemId);
  }

  /**
   * 获取收藏项数量
   */
  async countCollectionItems(collectionId: string): Promise<number> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    return items.length;
  }

  /**
   * 清空收藏夹
   */
  async clearCollection(collectionId: string): Promise<void> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    const itemIds = items.map(item => item.itemId);
    if (itemIds.length > 0) {
      await DBUtils.deleteBatch(STORE_NAMES.COLLECTION_ITEMS, itemIds);
      await this.updateCollectionLastUpdate(collectionId);
    }
  }

  /**
   * 重新排序收藏项
   */
  async reorderCollectionItems(
    collectionId: string,
    itemOrders: Map<string, number>
  ): Promise<void> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    const updatedItems = items.map(item => ({
      ...item,
      order: itemOrders.get(item.itemId) ?? item.order
    }));

    await DBUtils.putBatch(STORE_NAMES.COLLECTION_ITEMS, updatedItems);
    await this.updateCollectionLastUpdate(collectionId);
  }

  /**
   * 搜索收藏项
   */
  async searchCollectionItems(
    collectionId: string,
    keyword: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<CollectionItem>> {
    const allItems = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    const lowerKeyword = keyword.toLowerCase();
    const filtered = allItems.filter(item =>
      item.note?.toLowerCase().includes(lowerKeyword)
    );

    const sorted = filtered.sort((a, b) => b.addedAt - a.addedAt);

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
   * 更新收藏夹的lastUpdate时间
   */
  private async updateCollectionLastUpdate(collectionId: string): Promise<void> {
    // TODO: 需要注入 CollectionRepository 来更新收藏夹
    // 这里暂时留空，实际实现需要依赖注入或服务定位
  }
}
