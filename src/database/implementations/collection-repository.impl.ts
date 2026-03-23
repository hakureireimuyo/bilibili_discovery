/**
 * CollectionRepository 实现
 * 职责：管理收藏夹及其收藏项的所有操作
 * 包括收藏夹的CRUD以及收藏项的添加/移除/删除，并自动维护计数器等信息
 */

// 接口已移除，直接实现功能
import { Collection, CollectionItem } from '../types/collection.js';
import { Platform } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * CollectionRepository 实现类
 */
export class CollectionRepository {
  /**
   * 创建收藏夹
   */
  async createCollection(collection: Omit<Collection, 'collectionId'>): Promise<string> {
    const collectionId = `collection_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newCollection: Collection = {
      collectionId,
      ...collection,
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };
    await DBUtils.add(STORE_NAMES.COLLECTIONS, newCollection);
    return collectionId;
  }

  /**
   * 使用指定ID创建收藏夹
   */
  async createCollectionWithId(collectionId: string, collection: Omit<Collection, 'collectionId'>): Promise<void> {
    const newCollection: Collection = {
      collectionId,
      ...collection,
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };
    await DBUtils.add(STORE_NAMES.COLLECTIONS, newCollection);
  }

  /**
   * 获取收藏夹
   */
  async getCollection(collectionId: string): Promise<Collection | null> {
    return DBUtils.get<Collection>(STORE_NAMES.COLLECTIONS, collectionId);
  }

  /**
   * 获取所有收藏夹
   */
  async getAllCollections(platform: Platform): Promise<Collection[]> {
    const allCollections = await DBUtils.getByIndex<Collection>(
      STORE_NAMES.COLLECTIONS,
      'platform',
      platform
    );
    return allCollections.sort((a, b) => b.lastUpdate - a.lastUpdate);
  }

  /**
   * 更新收藏夹
   */
  async updateCollection(
    collectionId: string,
    updates: Partial<Omit<Collection, 'collectionId' | 'createdAt'>>
  ): Promise<void> {
    const existing = await this.getCollection(collectionId);
    if (!existing) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    const updated: Collection = {
      ...existing,
      ...updates,
      lastUpdate: Date.now()
    };

    await DBUtils.put(STORE_NAMES.COLLECTIONS, updated);
  }

  /**
   * 删除收藏夹及其所有收藏项
   */
  async deleteCollection(collectionId: string): Promise<void> {
    // 先删除收藏夹中的所有收藏项
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    
    if (items.length > 0) {
      const itemIds = items.map(item => item.itemId);
      await DBUtils.deleteBatch(STORE_NAMES.COLLECTION_ITEMS, itemIds);
    }
    
    // 再删除收藏夹本身
    await DBUtils.delete(STORE_NAMES.COLLECTIONS, collectionId);
  }

  /**
   * 检查收藏夹名称是否已存在
   */
  async collectionNameExists(
    platform: Platform,
    name: string,
    excludeId?: string
  ): Promise<boolean> {
    const allCollections = await this.getAllCollections(platform);
    const lowerName = name.toLowerCase();

    return allCollections.some(collection =>
      collection.collectionId !== excludeId &&
      collection.name.toLowerCase() === lowerName
    );
  }

  /**
   * 添加收藏项到收藏夹
   * 自动更新收藏夹的videoCount和lastAddedAt
   */
  async addItemToCollection(
    collectionId: string,
    item: Omit<CollectionItem, 'itemId' | 'collectionId' | 'addedAt'>
  ): Promise<string> {
    // 检查收藏夹是否存在
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    // 检查视频是否已在收藏夹中
    const existingItems = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    
    const existingItem = existingItems.find(i => i.videoId === item.videoId);
    if (existingItem) {
      throw new Error(`Video already exists in collection: ${item.videoId}`);
    }

    // 创建收藏项
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const addedAt = Date.now();
    
    const newItem: CollectionItem = {
      itemId,
      collectionId,
      videoId: item.videoId,
      addedAt,
      note: item.note,
      order: item.order
    };

    await DBUtils.add(STORE_NAMES.COLLECTION_ITEMS, newItem);

    // 更新收藏夹的计数器和最后添加时间
    await this.updateCollection(collectionId, {
      videoCount: (collection.videoCount || 0) + 1,
      lastAddedAt: addedAt
    });

    return itemId;
  }

  /**
   * 批量添加收藏项到收藏夹
   * 自动更新收藏夹的videoCount和lastAddedAt
   */
  async addItemsToCollection(
    collectionId: string,
    items: Omit<CollectionItem, 'itemId' | 'collectionId' | 'addedAt'>[]
  ): Promise<string[]> {
    // 检查收藏夹是否存在
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    // 获取收藏夹中现有的收藏项
    const existingItems = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    
    const existingVideoIds = new Set(existingItems.map(i => i.videoId));
    const addedAt = Date.now();
    const itemIds: string[] = [];

    // 过滤掉已存在的视频
    const newItems = items.filter(item => !existingVideoIds.has(item.videoId));

    // 批量创建收藏项
    const itemsToAdd: CollectionItem[] = newItems.map(item => {
      const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      itemIds.push(itemId);
      
      return {
        itemId,
        collectionId,
        videoId: item.videoId,
        addedAt,
        note: item.note,
        order: item.order
      };
    });

    if (itemsToAdd.length > 0) {
      await DBUtils.addBatch(STORE_NAMES.COLLECTION_ITEMS, itemsToAdd);

      // 更新收藏夹的计数器和最后添加时间
      await this.updateCollection(collectionId, {
        videoCount: (collection.videoCount || 0) + itemsToAdd.length,
        lastAddedAt: addedAt
      });
    }

    return itemIds;
  }

  /**
   * 从收藏夹中移除收藏项
   * 自动更新收藏夹的videoCount
   */
  async removeItemFromCollection(
    collectionId: string,
    itemId: string
  ): Promise<void> {
    // 检查收藏夹是否存在
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    // 检查收藏项是否存在
    const item = await DBUtils.get<CollectionItem>(STORE_NAMES.COLLECTION_ITEMS, itemId);
    if (!item) {
      throw new Error(`CollectionItem not found: ${itemId}`);
    }

    if (item.collectionId !== collectionId) {
      throw new Error(`Item does not belong to collection: ${collectionId}`);
    }

    // 删除收藏项
    await DBUtils.delete(STORE_NAMES.COLLECTION_ITEMS, itemId);

    // 更新收藏夹的计数器
    const newCount = Math.max(0, (collection.videoCount || 0) - 1);
    await this.updateCollection(collectionId, {
      videoCount: newCount
    });
  }

  /**
   * 批量从收藏夹中移除收藏项
   * 自动更新收藏夹的videoCount
   */
  async removeItemsFromCollection(
    collectionId: string,
    itemIds: string[]
  ): Promise<void> {
    if (!itemIds.length) return;

    // 检查收藏夹是否存在
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    // 获取所有要删除的收藏项
    const items = await Promise.all(
      itemIds.map(id => DBUtils.get<CollectionItem>(STORE_NAMES.COLLECTION_ITEMS, id))
    );

    // 过滤掉不存在的项和不属于该收藏夹的项
    const validItems = items.filter(
      item => item && item.collectionId === collectionId
    ) as CollectionItem[];

    if (validItems.length === 0) {
      return;
    }

    // 批量删除收藏项
    const validItemIds = validItems.map(item => item.itemId);
    await DBUtils.deleteBatch(STORE_NAMES.COLLECTION_ITEMS, validItemIds);

    // 更新收藏夹的计数器
    const newCount = Math.max(0, (collection.videoCount || 0) - validItems.length);
    await this.updateCollection(collectionId, {
      videoCount: newCount
    });
  }

  /**
   * 从收藏夹中删除视频（通过videoId）
   * 自动更新收藏夹的videoCount
   */
  async removeVideoFromCollection(
    collectionId: string,
    videoId: string
  ): Promise<void> {
    // 检查收藏夹是否存在
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    // 查找要删除的收藏项
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    const itemToDelete = items.find(item => item.videoId === videoId);
    if (!itemToDelete) {
      throw new Error(`Video not found in collection: ${videoId}`);
    }

    // 删除收藏项
    await DBUtils.delete(STORE_NAMES.COLLECTION_ITEMS, itemToDelete.itemId);

    // 更新收藏夹的计数器
    const newCount = Math.max(0, (collection.videoCount || 0) - 1);
    await this.updateCollection(collectionId, {
      videoCount: newCount
    });
  }

  /**
   * 获取收藏夹中的所有收藏项
   */
  async getCollectionItems(collectionId: string): Promise<CollectionItem[]> {
    return DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
  }

  /**
   * 检查视频是否已在收藏夹中
   */
  async hasVideoInCollection(
    collectionId: string,
    videoId: string
  ): Promise<boolean> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    
    return items.some(item => item.videoId === videoId);
  }

  /**
   * 清空收藏夹（删除所有收藏项）
   * 自动更新收藏夹的videoCount
   */
  async clearCollection(collectionId: string): Promise<void> {
    // 检查收藏夹是否存在
    const collection = await this.getCollection(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    // 获取所有收藏项
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );

    if (items.length === 0) {
      return;
    }

    // 批量删除收藏项
    const itemIds = items.map(item => item.itemId);
    await DBUtils.deleteBatch(STORE_NAMES.COLLECTION_ITEMS, itemIds);

    // 更新收藏夹的计数器
    await this.updateCollection(collectionId, {
      videoCount: 0
    });
  }
}
