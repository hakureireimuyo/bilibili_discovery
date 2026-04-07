/**
 * CollectionRepositoryImpl 实现
 * 职责：管理收藏夹及其收藏项的所有操作
 * 设计原则：基于IndexedDB特性，只实现高效操作
 * - 支持基于主键和索引的增删改查
 * - 支持分页获取数据
 * - 避免需要全量数据的复杂查询、过滤、排序等操作
 * - 自动维护收藏夹的计数器和时间戳
 */

import { Collection, CollectionItem } from '../types/collection.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';
import { generateId } from './id-generator.js';
import { ID } from '../types/base.js';
/**
 * CollectionRepositoryImpl 实现类
 */
export class CollectionRepositoryImpl {
  /**
   * 创建收藏夹
   * @param collection 收藏夹数据（不包含collectionId）
   * @returns 创建的收藏夹ID
   */
  async createCollection(collection: Omit<Collection, 'collectionId'>): Promise<ID> {
    const collectionId = generateId();
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
   * @param collectionId 收藏夹ID
   * @param collection 收藏夹数据
   */
  async createCollectionWithId(collectionId: ID, collection: Omit<Collection, 'collectionId'>): Promise<void> {
    const newCollection: Collection = {
      collectionId,
      ...collection,
      createdAt: Date.now(),
      lastUpdate: Date.now()
    };
    await DBUtils.add(STORE_NAMES.COLLECTIONS, newCollection);
  }

  /**
   * 根据主键获取收藏夹
   * @param collectionId 收藏夹ID
   */
  async getCollection(collectionId: ID): Promise<Collection | null> {
    return DBUtils.get<Collection>(STORE_NAMES.COLLECTIONS, collectionId);
  }

  /**
   * 获取所有收藏夹
   * 注意：此方法会获取全部数据，请谨慎使用
   */
  async getAllCollections(): Promise<Collection[]> {
    return DBUtils.getAll<Collection>(STORE_NAMES.COLLECTIONS);
  }

  /**
   * 获取收藏夹（分页）
   * @param offset 偏移量
   * @param limit 每页数量
   */
  async getCollectionsPaginated(offset: number, limit: number): Promise<Collection[]> {
    const collections: Collection[] = [];
    let skipped = 0;

    await DBUtils.cursor<Collection>(
      STORE_NAMES.COLLECTIONS,
      (value) => {
        if (skipped < offset) {
          skipped++;
          return;
        }
        collections.push(value);
        return collections.length < limit;
      }
    );

    return collections;
  }

  /**
   * 根据名称获取收藏夹
   * 基于name索引查询
   * @param name 收藏夹名称
   */
  async getCollectionsByName(name: string): Promise<Collection[]> {
    return DBUtils.getByIndex<Collection>(
      STORE_NAMES.COLLECTIONS,
      'name',
      name
    );
  }

  /**
   * 根据平台获取收藏夹
   * 基于platform索引查询
   * @param platform 平台类型
   */
  async getCollectionsByPlatform(platform: string): Promise<Collection[]> {
    return DBUtils.getByIndex<Collection>(
      STORE_NAMES.COLLECTIONS,
      'platform',
      platform
    );
  }

  /**
   * 根据平台获取收藏夹（分页）
   * @param platform 平台类型
   * @param offset 偏移量
   * @param limit 每页数量
   */
  async getCollectionsByPlatformPaginated(
    platform: string,
    offset: number,
    limit: number
  ): Promise<Collection[]> {
    const collections: Collection[] = [];
    let skipped = 0;

    await DBUtils.cursor<Collection>(
      STORE_NAMES.COLLECTIONS,
      (value) => {
        if (skipped < offset) {
          skipped++;
          return;
        }
        collections.push(value);
        return collections.length < limit;
      },
      'platform',
      IDBKeyRange.only(platform)
    );

    return collections;
  }


  /**
   * 更新收藏夹
   * @param collectionId 收藏夹ID
   * @param updates 要更新的字段
   */
  async updateCollection(
    collectionId: ID,
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
   * @param collectionId 收藏夹ID
   */
  async deleteCollection(collectionId: ID): Promise<void> {
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
   * 添加收藏项到收藏夹
   * 自动更新收藏夹的videoCount和lastAddedAt
   * @param collectionId 收藏夹ID
   * @param item 收藏项数据
   * @returns 创建的收藏项ID
   */
  async addItemToCollection(
    collectionId: ID,
    item: Omit<CollectionItem, 'itemId' | 'collectionId' | 'addedAt'>
  ): Promise<ID> {
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
    const itemId = generateId();
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
   * @param collectionId 收藏夹ID
   * @param items 收藏项数据列表
   * @returns 创建的收藏项ID列表
   */
  async addItemsToCollection(
    collectionId: ID,
    items: Omit<CollectionItem, 'itemId' | 'collectionId' | 'addedAt'>[]
  ): Promise<ID[]> {
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
    const itemIds: ID[] = [];

    // 过滤掉已存在的视频
    const newItems = items.filter(item => !existingVideoIds.has(item.videoId));

    // 批量创建收藏项
    const itemsToAdd: CollectionItem[] = newItems.map(item => {
      const itemId = generateId();
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
   * @param collectionId 收藏夹ID
   * @param itemId 收藏项ID
   */
  async removeItemFromCollection(
    collectionId: ID,
    itemId: ID
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
   * @param collectionId 收藏夹ID
   * @param itemIds 收藏项ID列表
   */
  async removeItemsFromCollection(
    collectionId: ID,
    itemIds: ID[]
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
   * @param collectionId 收藏夹ID
   * @param videoId 视频ID
   */
  async removeVideoFromCollection(
    collectionId: ID,
    videoId: ID
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
   * 基于collectionId索引查询
   * @param collectionId 收藏夹ID
   * @returns 收藏项列表
   */
  async getCollectionItems(collectionId: ID): Promise<CollectionItem[]> {
    return DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
  }

  /**
   * 批量获取多个收藏夹中的收藏项
   * @param collectionIds 收藏夹ID列表
   * @returns 以收藏夹ID为键的收藏项映射
   */
  async getCollectionItemsByCollectionIds(collectionIds: ID[]): Promise<Map<ID, CollectionItem[]>> {
    const result = new Map<ID, CollectionItem[]>();

    await Promise.all(
      collectionIds.map(async (collectionId) => {
        const items = await DBUtils.getByIndex<CollectionItem>(
          STORE_NAMES.COLLECTION_ITEMS,
          'collectionId',
          collectionId
        );
        result.set(collectionId, items);
      })
    );

    return result;
  }

  /**
   * 获取收藏夹中的收藏项（分页）
   * 基于collectionId索引查询
   * @param collectionId 收藏夹ID
   * @param offset 偏移量
   * @param limit 每页数量
   * @returns 收藏项列表
   */
  async getCollectionItemsPaginated(
    collectionId: ID,
    offset: number,
    limit: number
  ): Promise<CollectionItem[]> {
    const items: CollectionItem[] = [];
    let skipped = 0;

    await DBUtils.cursor<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      (value) => {
        if (skipped < offset) {
          skipped++;
          return;
        }
        items.push(value);
        return items.length < limit;
      },
      'collectionId',
      IDBKeyRange.only(collectionId)
    );

    return items;
  }

  /**
   * 获取收藏夹中特定视频的收藏项
   * 基于collectionId索引查询后过滤
   * @param collectionId 收藏夹ID
   * @param videoId 视频ID
   * @returns 收藏项，如果不存在则返回null
   */
  async getItemByCollectionAndVideo(
    collectionId: ID,
    videoId: ID
  ): Promise<CollectionItem | null> {
    const items = await DBUtils.getByIndex<CollectionItem>(
      STORE_NAMES.COLLECTION_ITEMS,
      'collectionId',
      collectionId
    );
    return items.find(item => item.videoId === videoId) || null;
  }

  /**
   * 检查视频是否已在收藏夹中
   * 基于collectionId索引查询后过滤
   * @param collectionId 收藏夹ID
   * @param videoId 视频ID
   * @returns 是否存在
   */
  async hasVideoInCollection(
    collectionId: ID,
    videoId: ID
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
   * @param collectionId 收藏夹ID
   */
  async clearCollection(collectionId: ID): Promise<void> {
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
