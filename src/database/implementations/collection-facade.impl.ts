/**
 * CollectionFacade 实现
 * 职责：提供收藏相关的复杂业务逻辑，直接对UI层提供服务
 * 包括按标签过滤、按标题查询、分页获取等操作
 */

import { Collection, CollectionItem } from '../types/collection.js';
import { Video } from '../types/video.js';
import { Platform, PaginationParams, PaginationResult } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * CollectionFacade 实现类
 */
export class CollectionFacade {
  constructor(
    private collectionRepo: ICollectionRepository,
    private collectionItemRepo: ICollectionItemRepository,
    private videoRepo: IVideoRepository
  ) {}

  /**
   * 获取收藏夹列表
   */
  async getCollections(platform: Platform): Promise<Collection[]> {
    return this.collectionRepo.getAllCollections(platform);
  }

  /**
   * 获取收藏夹详情
   */
  async getCollection(collectionId: string): Promise<Collection | null> {
    return this.collectionRepo.getCollection(collectionId);
  }

  /**
   * 搜索收藏夹（按标题）
   */
  async searchCollections(platform: Platform, keyword: string): Promise<Collection[]> {
    const allCollections = await this.getCollections(platform);
    const lowerKeyword = keyword.toLowerCase();
    return allCollections.filter(collection =>
      collection.name.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 按标签过滤收藏夹
   */
  async filterCollectionsByTags(platform: Platform, tagIds: string[]): Promise<Collection[]> {
    const allCollections = await this.getCollections(platform);
    
    if (!tagIds || tagIds.length === 0) {
      return allCollections;
    }

    return allCollections.filter(collection => {
      if (!collection.tags || collection.tags.length === 0) {
        return false;
      }
      return tagIds.some(tagId => collection.tags!.includes(tagId));
    });
  }

  /**
   * 获取收藏项列表（分页）
   */
  async getCollectionItems(params: CollectionItemQueryParams): Promise<PaginationResult<CollectionItemDetail>> {
    const { collectionId, tagIds, titleKeyword, pagination, sortOrder = 'default' } = params;
    const { page, pageSize } = pagination;

    // 获取所有收藏项
    let items: CollectionItem[];
    if (collectionId) {
      items = await this.collectionRepo.getCollectionItems(collectionId);
    } else {
      // 获取所有收藏夹中的收藏项
      const allCollections = await this.getAllCollectionsItems();
      items = allCollections;
    }

    // 获取所有视频信息
    const videoIds = [...new Set(items.map(item => item.videoId))];
    const allVideos = await this.getAllVideosMap();
    
    // 过滤掉不存在的视频
    items = items.filter(item => allVideos.has(item.videoId));

    // 构建收藏项详细信息
    let itemDetails: CollectionItemDetail[] = items.map(item => ({
      itemId: item.itemId,
      collectionId: item.collectionId,
      videoId: item.videoId,
      addedAt: item.addedAt,
      note: item.note,
      order: item.order,
      video: allVideos.get(item.videoId)!
    }));

    // 按标签过滤
    if (tagIds && tagIds.length > 0) {
      itemDetails = itemDetails.filter(detail => {
        if (!detail.video.tags || detail.video.tags.length === 0) {
          return false;
        }
        return tagIds.some(tagId => detail.video.tags.includes(tagId));
      });
    }

    // 按标题过滤
    if (titleKeyword) {
      const lowerKeyword = titleKeyword.toLowerCase();
      itemDetails = itemDetails.filter(detail =>
        detail.video.title.toLowerCase().includes(lowerKeyword)
      );
    }

    // 排序
    itemDetails = this.sortItems(itemDetails, sortOrder);

    // 分页
    const total = itemDetails.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedItems = itemDetails.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages
    };
  }

  /**
   * 获取收藏夹中的所有收藏项
   */
  async getCollectionItemsByCollectionId(collectionId: string): Promise<CollectionItemDetail[]> {
    const items = await this.collectionRepo.getCollectionItems(collectionId);
    const allVideos = await this.getAllVideosMap();

    return items
      .filter(item => allVideos.has(item.videoId))
      .map(item => ({
        itemId: item.itemId,
        collectionId: item.collectionId,
        videoId: item.videoId,
        addedAt: item.addedAt,
        note: item.note,
        order: item.order,
        video: allVideos.get(item.videoId)!
      }));
  }

  /**
   * 检查视频是否在收藏夹中
   */
  async hasVideoInCollection(collectionId: string, videoId: string): Promise<boolean> {
    return this.collectionRepo.hasVideoInCollection(collectionId, videoId);
  }

  /**
   * 添加视频到收藏夹
   */
  async addVideoToCollection(collectionId: string, videoId: string, note?: string): Promise<string> {
    return this.collectionRepo.addItemToCollection(collectionId, {
      videoId,
      note
    });
  }

  /**
   * 从收藏夹中移除视频
   */
  async removeVideoFromCollection(collectionId: string, videoId: string): Promise<void> {
    await this.collectionRepo.removeVideoFromCollection(collectionId, videoId);
  }

  /**
   * 批量添加视频到收藏夹
   */
  async addVideosToCollection(collectionId: string, videoIds: string[]): Promise<string[]> {
    const items = videoIds.map(videoId => ({ videoId }));
    return this.collectionRepo.addItemsToCollection(collectionId, items);
  }

  /**
   * 批量从收藏夹中移除视频
   */
  async removeVideosFromCollection(collectionId: string, videoIds: string[]): Promise<void> {
    const items = await this.collectionRepo.getCollectionItems(collectionId);
    const itemIds = items
      .filter(item => videoIds.includes(item.videoId))
      .map(item => item.itemId);
    
    await this.collectionRepo.removeItemsFromCollection(collectionId, itemIds);
  }

  /**
   * 清空收藏夹
   */
  async clearCollection(collectionId: string): Promise<void> {
    await this.collectionRepo.clearCollection(collectionId);
  }

  /**
   * 创建收藏夹
   */
  async createCollection(collection: Omit<Collection, 'collectionId'>): Promise<string> {
    return this.collectionRepo.createCollection(collection);
  }

  /**
   * 更新收藏夹
   */
  async updateCollection(
    collectionId: string,
    updates: Partial<Omit<Collection, 'collectionId' | 'createdAt'>>
  ): Promise<void> {
    await this.collectionRepo.updateCollection(collectionId, updates);
  }

  /**
   * 删除收藏夹
   */
  async deleteCollection(collectionId: string): Promise<void> {
    await this.collectionRepo.deleteCollection(collectionId);
  }

  /**
   * 更新收藏项备注
   */
  async updateItemNote(itemId: string, note: string): Promise<void> {
    await this.collectionItemRepo.updateNote(itemId, note);
  }

  /**
   * 更新收藏项排序
   */
  async updateItemOrder(itemId: string, order: number): Promise<void> {
    await this.collectionItemRepo.updateOrder(itemId, order);
  }

  /**
   * 获取所有收藏夹中的收藏项
   */
  private async getAllCollectionsItems(): Promise<CollectionItem[]> {
    const allItems: CollectionItem[] = [];
    const collections = await DBUtils.getAll<Collection>(STORE_NAMES.COLLECTIONS);
    
    for (const collection of collections) {
      const items = await this.collectionRepo.getCollectionItems(collection.collectionId);
      allItems.push(...items);
    }
    
    return allItems;
  }

  /**
   * 获取所有视频的映射
   */
  private async getAllVideosMap(): Promise<Map<string, Video>> {
    const allVideos = await this.videoRepo.getAllVideos();
    const videoMap = new Map<string, Video>();
    
    for (const video of allVideos) {
      videoMap.set(video.videoId, video);
    }
    
    return videoMap;
  }

  /**
   * 排序收藏项
   */
  private sortItems(items: CollectionItemDetail[], sortOrder: 'default' | 'time' | 'duration'): CollectionItemDetail[] {
    switch (sortOrder) {
      case 'time':
        return [...items].sort((a, b) => b.addedAt - a.addedAt);
      case 'duration':
        return [...items].sort((a, b) => b.video.duration - a.video.duration);
      case 'default':
      default:
        return [...items].sort((a, b) => {
          // 先按收藏夹排序
          if (a.collectionId !== b.collectionId) {
            return a.collectionId.localeCompare(b.collectionId);
          }
          // 同一收藏夹内按order排序，没有order的按addedAt
          const aOrder = a.order ?? a.addedAt;
          const bOrder = b.order ?? b.addedAt;
          return aOrder - bOrder;
        });
    }
  }
}
