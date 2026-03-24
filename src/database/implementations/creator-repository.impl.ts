/**
 * CreatorRepository 实现
 * 实现创作者相关的数据库操作
 * 专门针对IndexedDB优化，只提供获取全部数据、分页获取数据以及基于索引的增删改查方法
 */

import { Creator } from '../types/creator.js';
import { Platform, PaginationParams, PaginationResult } from '../types/base.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';
import { ImageRepository } from './image-repository.impl.js';
import {ImagePurpose } from '../types/image.js'

/**
 * CreatorRepository 实现类
 * 专门针对IndexedDB优化，避免复杂条件查询过滤排序等低效操作
 */
export class CreatorRepository {
  /**
   * ImageRepository依赖
   */
  private imageRepository: ImageRepository;

  /**
   * 构造函数
   * @param imageRepository 图片仓库实例
   */
  constructor(imageRepository?: ImageRepository) {
    this.imageRepository = imageRepository || new ImageRepository();
  }
  /**
   * 创建或更新创作者信息
   * 基于主键索引的创建或更新操作
   */
  async upsertCreator(creator: Creator): Promise<void> {
    await DBUtils.put(STORE_NAMES.CREATORS, creator);
  }

  /**
   * 批量创建或更新创作者信息
   * 基于主键索引的批量创建或更新操作
   */
  async upsertCreators(creators: Creator[]): Promise<void> {
    await DBUtils.putBatch(STORE_NAMES.CREATORS, creators);
  }

  /**
   * 获取单个创作者信息
   * 基于复合索引(creatorId+platform)的查询
   */
  async getCreator(creatorId: string, platform: Platform): Promise<Creator | null> {
    const creators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'creatorId',
      creatorId
    );
    return creators.find(c => c.platform === platform) || null;
  }

  /**
   * 批量获取多个创作者信息
   * 基于主键索引的批量查询
   */
  async getCreators(creatorIds: string[], platform: Platform): Promise<Creator[]> {
    const allCreators = await DBUtils.getBatch<Creator>(
      STORE_NAMES.CREATORS,
      creatorIds
    );
    return allCreators.filter(c => c.platform === platform);
  }

  /**
   * 获取指定平台的全部创作者
   * 基于platform索引的查询
   */
  async getAllCreators(platform: Platform): Promise<Creator[]> {
    return await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'platform',
      platform
    );
  }

  /**
   * 获取分页后的创作者数据
   * 基于平台索引和游标的分页查询
   */
  async getPaginatedCreators(
    platform: Platform,
    params: PaginationParams = { page: 1, pageSize: 20 }
  ): Promise<PaginationResult<Creator>> {
    const { page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;
    let totalCount = 0;
    const results: Creator[] = [];

    // 使用游标遍历实现分页，避免一次性获取全部数据
    await DBUtils.cursor<Creator>(
      STORE_NAMES.CREATORS,
      (value, cursor) => {
        // 计总数
        totalCount++;

        // 跳过前面的数据
        if (cursor.primaryKey && typeof cursor.primaryKey === 'number' && cursor.primaryKey < offset) {
          cursor.continue();
          return;
        }

        // 收集当前页数据
        if (results.length < pageSize) {
          results.push(value);
          cursor.continue();
        } else {
          // 停止遍历
          return false;
        }
      },
      'platform',
      IDBKeyRange.only(platform)
    );

    return {
      items: results,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    };
  }

  /**
   * 获取已关注的创作者
   * 基于isFollowing索引的查询
   */
  async getFollowingCreators(platform: Platform): Promise<Creator[]> {
    const allCreators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'isFollowing',
      1
    );
    return allCreators.filter(c => c.platform === platform);
  }

  /**
   * 获取已关注的创作者(分页)
   * 基于isFollowing索引和游标的分页查询
   */
  async getPaginatedFollowingCreators(
    platform: Platform,
    params: PaginationParams = { page: 1, pageSize: 20 }
  ): Promise<PaginationResult<Creator>> {
    const { page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;
    let totalCount = 0;
    const results: Creator[] = [];

    // 使用游标遍历实现分页，避免一次性获取全部数据
    await DBUtils.cursor<Creator>(
      STORE_NAMES.CREATORS,
      (value, cursor) => {
        // 只处理指定平台的已关注创作者
        if (value.platform === platform) {
          totalCount++;

          // 跳过前面的数据
          if (totalCount <= offset) {
            cursor.continue();
            return;
          }

          // 收集当前页数据
          if (results.length < pageSize) {
            results.push(value);
            cursor.continue();
          } else {
            // 停止遍历
            return false;
          }
        } else {
          cursor.continue();
        }
      },
      'isFollowing',
      IDBKeyRange.only(1)
    );

    return {
      items: results,
      total: totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    };
  }

  /**
   * 更新创作者关注状态
   * 先查询再更新，基于主键索引
   */
  async updateFollowStatus(creatorId: string, platform: Platform, isFollowing: number): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    const updated: Creator = {
      ...creator,
      isFollowing,
      followTime: isFollowing ? Date.now() : creator.followTime
    };

    await this.upsertCreator(updated);
  }

  /**
   * 更新创作者标签权重
   * 先查询再更新，基于主键索引
   */
  async updateTagWeights(
    creatorId: string,
    platform: Platform,
    tagWeights: Creator['tagWeights']
  ): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    // 合并现有标签权重
    const existingMap = new Map(
      creator.tagWeights.map(tw => [tw.tagId, tw])
    );

    tagWeights.forEach(tw => {
      const existing = existingMap.get(tw.tagId);
      if (existing) {
        // 如果已存在，合并计数
        existing.count += tw.count;
      } else {
        // 如果不存在，添加新标签
        existingMap.set(tw.tagId, tw);
      }
    });

    const updated: Creator = {
      ...creator,
      tagWeights: Array.from(existingMap.values())
    };

    await this.upsertCreator(updated);
  }

  /**
   * 获取创作者的手动标签ID列表
   * @param creatorId 创作者ID
   * @param platform 平台类型
   * @returns 用户手动添加的标签ID列表
   */
  async getUPManualTags(creatorId: string, platform: Platform): Promise<string[]> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      return [];
    }
    // 返回所有用户手动添加的标签（source 为 'user'）
    return creator.tagWeights
      .filter(tw => tw.source === 'user')
      .map(tw => tw.tagId);
  }

  /**
   * 删除创作者
   * 基于主键索引的删除操作
   */
  async deleteCreator(creatorId: string, platform: Platform): Promise<void> {
    await DBUtils.delete(STORE_NAMES.CREATORS, creatorId);
  }

  /**
   * 标记创作者为已注销
   * 先查询再更新，基于主键索引
   */
  async markCreatorAsLogout(creatorId: string, platform: Platform): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    const updated: Creator = {
      ...creator,
      isLogout: 1
    };

    await this.upsertCreator(updated);
  }

  /**
   * 获取指定平台的创作者数量
   * 基于platform索引的计数
   */
  async getCreatorCount(platform: Platform): Promise<number> {
    return await DBUtils.countByIndex(STORE_NAMES.CREATORS, 'platform', platform);
  }

  /**
   * 获取已关注创作者数量
   * 基于isFollowing索引的计数
   */
  async getFollowedCount(platform: Platform): Promise<number> {
    return await DBUtils.countByIndex(STORE_NAMES.CREATORS, 'isFollowing', 1);
  }

  /**
   * 获取未关注创作者数量
   * 基于isFollowing索引的计数
   */
  async getUnfollowedCount(platform: Platform): Promise<number> {
    return await DBUtils.countByIndex(STORE_NAMES.CREATORS, 'isFollowing', 0);
  }

  /**
   * 更新创作者头像URL
   * 先查询再更新，基于主键索引
   */
  async updateAvatarUrl(creatorId: string, platform: Platform, avatarUrl: string): Promise<void> {
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    const updated: Creator = {
      ...creator,
      avatarUrl
    };

    await this.upsertCreator(updated);
  }

  /**
   * 获取创作者头像二进制数据
   * 如果本地没有头像数据，会尝试从URL下载并存储
   */
  async getAvatarBinary(creatorId: string, platform: Platform): Promise<Blob | null> {
    // 先获取创作者信息
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      return null;
    }

    // 检查本地是否有缓存的二进制数据
    if (creator.avatar) {
      try {
        // 使用存储的图片ID获取完整图片数据
        const fullImage = await this.imageRepository.getImage(creator.avatar);
        if (fullImage) {
          // 更新图片的访问时间
          await this.imageRepository.updateImageMetadata(creator.avatar, {
            lastAccessTime: Date.now()
          });
          return fullImage.data.data;
        }
      } catch (error) {
        console.error(`[CreatorRepository] Failed to fetch avatar binary for ${creatorId}:`, error);
      }
    }

    // 如果没有缓存，从URL下载
    if (creator.avatarUrl) {
      try {
        const response = await fetch(creator.avatarUrl);
        if (response.ok) {
          const blob = await response.blob();
          
          // 存储二进制数据
          await this.saveAvatarBinary(creatorId, platform, blob);
          
          return blob;
        }
      } catch (error) {
        console.error(`[CreatorRepository] Failed to fetch avatar binary for ${creatorId}:`, error);
      }
    }
    
    return null;
  }

  /**
   * 保存创作者头像二进制数据
   * 将二进制数据存储到images_data表中，并更新creator表的avatar字段
   */
  async saveAvatarBinary(creatorId: string, platform: Platform, avatarBlob: Blob): Promise<void> {
    // 先获取创作者信息
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }
    
    // 使用ImageRepository存储二进制数据
    const purpose = ImagePurpose.AVATAR;
    
    // 存储二进制数据
    const image = await this.imageRepository.createImage({
      purpose,
      data: avatarBlob
    });
    
    // 更新创作者信息，将avatar设置为图片ID
    const updated: Creator = {
      ...creator,
      avatar: image.metadata.id // 存储图片ID
    };
    
    await this.upsertCreator(updated);
  }

  /**
   * 删除创作者头像二进制数据
   * 同时清除images_data表中的对应数据
   */
  async deleteAvatarBinary(creatorId: string, platform: Platform): Promise<void> {
    // 先获取创作者信息
    const creator = await this.getCreator(creatorId, platform);
    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }
    
    // 如果有头像数据，删除它
    if (creator.avatar) {
      try {
        // 删除图片
        await this.imageRepository.deleteImage(creator.avatar);
      } catch (error) {
        console.error(`[CreatorRepository] Failed to delete avatar binary for ${creatorId}:`, error);
      }
    }
    
    // 更新创作者信息，将avatar重置为空
    const updated: Creator = {
      ...creator,
      avatar: '',
      avatarUrl: creator.avatarUrl // 保留URL，以便重新下载
    };
    
    await this.upsertCreator(updated);
  }
}
