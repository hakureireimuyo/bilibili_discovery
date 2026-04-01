
/**
 * 数据处理器
 * 负责处理从content script收集的数据，并写入数据库
 */

import { 
  VideoCollectData, 
  WatchEventCollectData, 
  CreatorCollectData,
  FavoriteStatusEvent,
  UPPageData 
} from '../types.js';
import { 
  CreatorRepositoryImpl 
} from '../../database/implementations/creator-repository.impl.js';
import { 
  VideoRepositoryImpl 
} from '../../database/implementations/video-repository.impl.js';
import { 
  WatchEventRepositoryImpl 
} from '../../database/implementations/watch-event-repository.impl.js';
import { 
  TagRepositoryImpl 
} from '../../database/implementations/tag-repository.impl.js';
import { 
  ImageRepositoryImpl 
} from '../../database/implementations/image-repository.impl.js';
import {
  UPInteractionRepositoryImpl
} from '../../database/implementations/up-interaction-repository.impl.js';
import {
  DailyWatchStatsRepositoryImpl
} from '../../database/implementations/daily-watch-stats-repository.impl.js';
import { 
  Platform,
  TagSource,
  ID
} from '../../database/types/base.js';
import { 
  Video,
  Creator,
  WatchEvent
} from '../../database/types/index.js';
import { dbManager } from '../../database/indexeddb/index.js';
import { logger } from '../../utils/logger.js';
/**
 * 数据处理器类
 */
export class DataProcessor {
  private creatorRepo: CreatorRepositoryImpl;
  private videoRepo: VideoRepositoryImpl;
  private watchEventRepo: WatchEventRepositoryImpl;
  private tagRepo: TagRepositoryImpl;
  private imageRepo: ImageRepositoryImpl;
  private upInteractionRepo: UPInteractionRepositoryImpl;
  private dailyWatchStatsRepo: DailyWatchStatsRepositoryImpl;

  private dbInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.imageRepo = new ImageRepositoryImpl();
    this.creatorRepo = new CreatorRepositoryImpl(this.imageRepo);
    this.videoRepo = new VideoRepositoryImpl();
    this.watchEventRepo = new WatchEventRepositoryImpl();
    this.tagRepo = new TagRepositoryImpl();
    this.upInteractionRepo = new UPInteractionRepositoryImpl();
    this.dailyWatchStatsRepo = new DailyWatchStatsRepositoryImpl();
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDbInitialized(): Promise<void> {
    if (this.dbInitialized) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = dbManager.init()
        .then(() => {
          this.dbInitialized = true;
          logger.debug('[DataProcessor] Database initialized successfully');
        })
        .catch(error => {
          console.error('[DataProcessor] Database initialization failed:', error);
          this.initPromise = null; // 允许重试
          throw error;
        });
    }

    await this.initPromise;
  }

  /**
   * 处理UP主数据
   * 对比数据是否发生变化，决定是否需要更新
   */
  async processCreatorData(data: CreatorCollectData): Promise<void> {
    logger.debug('[DataProcessor] 处理UP主数据:', data);

    // 验证必要字段
    if (!data.name || data.name.trim() === '') {
      console.warn('[DataProcessor] UP主名称为空，跳过处理:', data.creatorId);
      return;
    }

    // 确保数据库已初始化
    await this.ensureDbInitialized();

    // 查询数据库中是否已存在该UP主
    const existingCreator = await this.creatorRepo.getCreator(data.creatorId);
    logger.debug('[DataProcessor] 数据库中的UP主记录:', existingCreator);

    if (existingCreator) {
      // UP主已存在，检查是否需要更新
      const needsUpdate = 
        existingCreator.name !== data.name ||
        existingCreator.avatarUrl !== data.avatarUrl ||
        existingCreator.isFollowing !== data.isFollowing;

      logger.debug('[DataProcessor] 是否需要更新:', needsUpdate);
      logger.debug('[DataProcessor] 数据对比:', {
        名称: { 旧: existingCreator.name, 新: data.name },
        头像: { 旧: existingCreator.avatarUrl, 新: data.avatarUrl },
        关注状态: { 旧: existingCreator.isFollowing, 新: data.isFollowing }
      });

      if (needsUpdate) {
        logger.debug('[DataProcessor] UP主数据发生变化，需要更新:', {
          creatorId: data.creatorId,
          oldName: existingCreator.name,
          newName: data.name,
          oldAvatarUrl: existingCreator.avatarUrl,
          newAvatarUrl: data.avatarUrl,
          oldIsFollowing: existingCreator.isFollowing,
          newIsFollowing: data.isFollowing
        });

        // 更新UP主信息
        const updatedCreator: Creator = {
          ...existingCreator,
          name: data.name,
          avatarUrl: data.avatarUrl,
          description: data.description,
          isFollowing: data.isFollowing,
          followTime: data.isFollowing ? (data.followTime || Date.now()) : existingCreator.followTime,
          updatedAt: Date.now()
        };

        await this.creatorRepo.upsertCreator(updatedCreator);
        logger.debug('[DataProcessor] UP主数据已更新');

        // 如果头像URL发生变化，下载并存储新头像
        if (existingCreator.avatarUrl !== data.avatarUrl && data.avatarUrl) {
          await this.downloadAndSaveAvatar(data.creatorId, data.avatarUrl);
        }
      } else {
        logger.debug('[DataProcessor] UP主数据未发生变化，跳过更新');
      }
    } else {
      // UP主不存在，创建新的UP主记录
      logger.debug('[DataProcessor] UP主不存在，创建新记录:', data);

      // 先创建UP主记录（不包含头像）
      const newCreator: Creator = {
        creatorId: data.creatorId,
        platform: data.platform,
        name: data.name,
        avatar: 0, // 初始为0，稍后更新
        avatarUrl: data.avatarUrl,
        isLogout: 0,
        description: data.description,
        createdAt: Date.now(),
        followTime: data.followTime || Date.now(),
        isFollowing: data.isFollowing,
        tagWeights: [],
        updatedAt: Date.now()
      };

      await this.creatorRepo.upsertCreator(newCreator);
      logger.debug('[DataProcessor] 新UP主记录已创建');

      // UP主记录创建后，再下载并存储头像
      if (data.avatarUrl) {
        await this.downloadAndSaveAvatar(data.creatorId, data.avatarUrl);
      }

      // 检查该UP主是否存在交互数据，没有则创建
      await this.ensureUPInteractionExists(data.creatorId, data.platform);
    }
  }

  /**
   * 处理视频数据
   * 对比数据是否发生变化，决定是否需要更新
   */
  async processVideoData(data: VideoCollectData): Promise<void> {
    logger.debug('[DataProcessor] 处理视频数据:', data);

    // 验证必要字段
    if (!data.creatorName || data.creatorName.trim() === '') {
      console.warn('[DataProcessor] 视频数据中UP主名称为空，跳过处理:', data.bv);
      return;
    }

    // 确保数据库已初始化
    await this.ensureDbInitialized();

    // 首先确保UP主存在
    // 查询数据库中是否已存在该UP主，以保留关注状态
    const existingCreator = await this.creatorRepo.getCreator(data.creatorId);
    logger.debug('[DataProcessor] 数据库中已存在的UP主:', existingCreator);

    const creatorData = {
      creatorId: data.creatorId,
      platform: Platform.BILIBILI,
      name: data.creatorName || '',
      avatarUrl: data.creatorAvatarUrl || '',
      description: '',
      // 如果UP主已存在，保留原有的关注状态和关注时间
      isFollowing: existingCreator?.isFollowing ?? 0,
      followTime: existingCreator?.followTime ?? 0
    };

    logger.debug('[DataProcessor] 准备处理的UP主数据:', creatorData);
    await this.processCreatorData(creatorData);

    // 查询数据库中是否已存在该视频
    // 这里需要通过BV号查询，但Video表没有BV号索引
    // 暂时通过creatorId获取该UP主的所有视频，然后查找匹配的BV号
    const creatorVideos = await this.videoRepo.getCreatorVideos(
      data.creatorId,
      Platform.BILIBILI,
      { page: 0, pageSize: 1000 }
    );

    // 查找匹配的视频
    const existingVideo = creatorVideos.items.find(v => v.bv === data.bv);

    if (existingVideo) {
      // 视频已存在，检查是否需要更新
      const needsUpdate = 
        existingVideo.title !== data.title ||
        existingVideo.description !== data.description;

      if (needsUpdate) {
        logger.debug('[DataProcessor] 视频数据发生变化，需要更新:', {
          videoId: existingVideo.videoId,
          bv: data.bv,
          oldTitle: existingVideo.title,
          newTitle: data.title,
          oldDescription: existingVideo.description,
          newDescription: data.description
        });

        // 更新视频信息
        const updatedVideo: Video = {
          ...existingVideo,
          title: data.title,
          description: data.description || ''
        };

        await this.videoRepo.upsertVideo(updatedVideo);

        // 处理视频标签 - 无论是否有标签,都更新
        if (data.tags) {
          await this.processVideoTags(existingVideo.videoId, data.tags);
          // 将视频标签添加到UP主的系统标签
          await this.addTagsToCreator(data.creatorId, data.tags);
        }
      } else {
        logger.debug('[DataProcessor] 视频数据未发生变化，跳过更新');
      }
    } else {
      // 视频不存在，创建新的视频记录
      logger.debug('[DataProcessor] 视频不存在，创建新记录:', data);

      // 处理视频标签
      const tagIds = data.tags && data.tags.length > 0 
        ? await this.createTags(data.tags) 
        : [];

      // 下载并存储封面图片
      let picture: ID | undefined;
      if (data.coverUrl) {
        picture = await this.downloadAndSaveCover(data.coverUrl);
      }

      const newVideo: Video = {
        videoId: 0, // 由createVideo自动生成
        bv: data.bv,
        platform: Platform.BILIBILI,
        creatorId: data.creatorId,
        title: data.title,
        description: data.description || '',
        duration: data.duration,
        publishTime: data.publishTime || Date.now(),
        tags: tagIds,
        createdAt: Date.now(),
        coverUrl: data.coverUrl,
        picture: picture || 0,
        isInvalid: false
      };

      const createdVideo = await this.videoRepo.createVideo(newVideo);

      // 将视频标签添加到UP主的系统标签
      if (data.tags && data.tags.length > 0) {
        await this.addTagsToCreator(data.creatorId, data.tags);
      }
    }
  }

  /**
   * 处理观看事件数据
   * 每个视频只有一个观看事件，持续更新累计观看时间和最近观看时间
   */
  async processWatchEventData(data: WatchEventCollectData): Promise<void> {
    logger.debug('[DataProcessor] 处理观看事件数据:', data);

    // 确保数据库已初始化
    await this.ensureDbInitialized();

    // 首先确保UP主和视频存在
    if (data.creatorId) {
      await this.processCreatorData({
        creatorId: data.creatorId,
        platform: Platform.BILIBILI,
        name: '',
        avatarUrl: '',
        description: '',
        isFollowing: 0,
        followTime: 0
      });
    }

    // 查找视频ID
    const videoId = await this.findVideoIdByBv(data.bv);
    if (!videoId) {
      console.warn('[DataProcessor] 视频不存在，无法记录观看事件:', data.bv);
      return;
    }

    // 查询该视频的观看事件
    const existingEvent = await this.watchEventRepo.getWatchEventByVideoId(videoId);

    if (existingEvent) {
      // 存在观看事件，更新观看时长和进度
      logger.debug('[DataProcessor] 更新现有观看事件:', existingEvent.eventId);

      const updatedWatchDuration = existingEvent.watchDuration + data.watchDuration;
      const updatedProgress = data.videoDuration > 0 ? data.progress : existingEvent.progress;
      const updatedIsComplete = updatedProgress >= 0.9 ? 1 : 0;

      await this.watchEventRepo.updateWatchEvent(existingEvent.eventId, {
        watchDuration: updatedWatchDuration,
        progress: updatedProgress,
        isComplete: updatedIsComplete,
        endTime: data.endTime
      });
    } else {
      // 不存在观看事件，创建新的观看事件
      logger.debug('[DataProcessor] 创建新的观看事件');

      const watchEvent: Omit<WatchEvent, 'eventId'> = {
        platform: Platform.BILIBILI,
        videoId,
        creatorId: data.creatorId || videoId, // 如果没有creatorId，使用videoId
        watchTime: data.watchTime,
        watchDuration: data.watchDuration,
        videoDuration: data.videoDuration,
        progress: data.progress,
        isComplete: data.isComplete,
        endTime: data.endTime
      };

      await this.watchEventRepo.recordWatchEvent(watchEvent);
    }

    // 同步更新UP主的总观看时长
    if (data.creatorId) {
      await this.upInteractionRepo.recordWatch(
        data.creatorId,
        data.watchDuration,
        data.watchTime || Date.now()
      );
    }

    // 更新每日观看统计
    await this.updateDailyWatchStats(data);
  }

  /**
   * 处理收藏事件数据
   */
  async processFavoriteEventData(data: FavoriteStatusEvent): Promise<void> {
    logger.debug('[DataProcessor] 处理收藏事件数据:', data);
    // TODO: 实现收藏数据的处理
    // 需要查看CollectionRepositoryImpl和CollectionItemRepositoryImpl的实现
  }

  /**
   * 处理UP页面数据
   */
  async processUPPageData(data: UPPageData): Promise<void> {
    logger.debug('[DataProcessor] 处理UP页面数据:', data);

    // 验证必要字段
    if (!data.name || data.name.trim() === '') {
      console.warn('[DataProcessor] UP页面数据中UP主名称为空，跳过处理:', data.mid);
      return;
    }

    // 处理UP主数据
    // 查询数据库中是否已存在该UP主，以保留关注状态
    const existingCreator = await this.creatorRepo.getCreator(data.mid);

    await this.processCreatorData({
      creatorId: data.mid,
      platform: Platform.BILIBILI,
      name: data.name,
      avatarUrl: data.face,
      description: data.sign,
      // 如果UP主已存在，保留原有的关注状态和关注时间
      isFollowing: existingCreator?.isFollowing ?? 0,
      followTime: existingCreator?.followTime ?? 0
    });

    // TODO: 处理视频列表数据
    // data.videos 中的视频可以批量创建
  }

  /**
   * 创建标签
   */
  private async createTags(tagNames: string[]): Promise<ID[]> {
    logger.debug('[DataProcessor] 创建标签:', tagNames);
    // 确保数据库已初始化
    await this.ensureDbInitialized();
    return await this.tagRepo.createTags(tagNames, TagSource.SYSTEM);
  }

  /**
   * 处理视频标签
   */
  private async processVideoTags(videoId: ID, tagNames: string[]): Promise<void> {
    logger.debug('[DataProcessor] 处理视频标签:', { videoId, tagNames });

    // 确保数据库已初始化
    await this.ensureDbInitialized();

    // 创建或获取标签ID
    const tagIds = await this.createTags(tagNames);

    // 更新视频标签
    await this.videoRepo.updateVideoTags(videoId, tagIds);
  }

  /**
   * 将标签添加到UP主
   */
  private async addTagsToCreator(creatorId: ID, tagNames: string[]): Promise<void> {
    logger.debug('[DataProcessor] 添加标签到UP主:', { creatorId, tagNames });

    // 确保数据库已初始化
    await this.ensureDbInitialized();

    // 创建或获取标签ID
    const tagIds = await this.createTags(tagNames);

    // 获取UP主当前的手动标签
    const existingTags = await this.creatorRepo.getUPManualTags(creatorId);

    // 合并标签，避免重复
    const existingTagIds = new Set(existingTags);
    const newTagIds = tagIds.filter(tagId => !existingTagIds.has(tagId));

    // 只添加新的标签
    if (newTagIds.length > 0) {
      logger.debug('[DataProcessor] 添加新标签到UP主:', newTagIds);

      // 批量获取标签信息
      const tags = await this.tagRepo.getTags(newTagIds);
      const tagMap = new Map(tags.map(t => [t.tagId, t]));

      for (const tagId of newTagIds) {
        const tag = tagMap.get(tagId);
        if (tag) {
          // 直接调用addTag，让它处理重复逻辑
          await this.creatorRepo.addTag(creatorId, tag);
        }
      }
    } else {
      logger.debug('[DataProcessor] 所有标签已存在，跳过添加');
    }
  }

  /**
   * 下载并保存UP主头像
   */
  private async downloadAndSaveAvatar(creatorId: ID, avatarUrl: string): Promise<ID | undefined> {
    // 确保数据库已初始化
    await this.ensureDbInitialized();
    try {
      logger.debug('[DataProcessor] 下载UP主头像:', avatarUrl);
      const response = await fetch(avatarUrl);
      if (response.ok) {
        const blob = await response.blob();
        await this.creatorRepo.saveAvatarBinary(creatorId, blob);
        // 重新获取UP主信息以获取头像ID
        const updatedCreator = await this.creatorRepo.getCreator(creatorId);
        return updatedCreator?.avatar;
      }
    } catch (error) {
      console.error('[DataProcessor] 下载UP主头像失败:', error);
    }
    return undefined;
  }

  /**
   * 下载并保存视频封面
   */
  private async downloadAndSaveCover(coverUrl: string): Promise<ID | undefined> {
    // 确保数据库已初始化
    await this.ensureDbInitialized();
    try {
      logger.debug('[DataProcessor] 下载视频封面:', coverUrl);
      const response = await fetch(coverUrl);
      if (response.ok) {
        const blob = await response.blob();
        // 创建图片记录
        const image = await this.imageRepo.createImage({
          purpose: 'cover' as any,
          data: blob
        });
        return image.metadata.id;
      }
    } catch (error) {
      console.error('[DataProcessor] 下载视频封面失败:', error);
    }
    return undefined;
  }

  /**
   * 通过BV号查找视频ID
   * 由于Video表没有BV号索引，需要遍历查询
   */
  private async findVideoIdByBv(bv: string): Promise<ID | undefined> {
    // 确保数据库已初始化
    await dbManager.init();
    // 暂时通过获取所有视频来查找
    // TODO: 优化这个查询，可以考虑添加BV号索引
    const allVideos = await this.videoRepo.getAllVideos();
    const video = allVideos.find(v => v.bv === bv);
    return video?.videoId;
  }

  /**
   * 确保UP主交互数据存在
   * 如果不存在则创建新的交互记录
   */
  private async ensureUPInteractionExists(creatorId: ID, platform: Platform): Promise<void> {
    // 确保数据库已初始化
    await this.ensureDbInitialized();

    // 检查UP主交互数据是否存在
    const existingInteraction = await this.upInteractionRepo.getInteraction(creatorId);

    if (!existingInteraction) {
      // 不存在则创建新的交互记录
      const now = Date.now();
      const newInteraction = {
        interactionId: now,
        platform,
        creatorId,
        totalWatchDuration: 0,
        totalWatchCount: 0,
        likeCount: 0,
        coinCount: 0,
        favoriteCount: 0,
        commentCount: 0,
        lastWatchTime: now,
        firstWatchTime: now,
        updateTime: now
      };

      await this.upInteractionRepo.upsertInteraction(newInteraction);
      logger.debug('[DataProcessor] UP主交互数据已创建:', creatorId);
    }
  }

  /**
   * 更新每日观看统计
   * @param data 观看事件数据
   */
  private async updateDailyWatchStats(data: WatchEventCollectData): Promise<void> {
    logger.debug('[DataProcessor] 更新每日观看统计:', data);

    // 确保数据库已初始化
    await this.ensureDbInitialized();

    // 生成日期键，格式为 YYYY-MM-DD
    const watchTime = data.watchTime || Date.now();
    const date = new Date(watchTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    // 收集UP主ID和视频ID
    const creatorIds: ID[] = [];
    const videoIds: ID[] = [];

    if (data.creatorId) {
      creatorIds.push(data.creatorId);
    }

    // 查找视频ID
    const videoId = await this.findVideoIdByBv(data.bv);
    if (videoId) {
      videoIds.push(videoId);
    }

    // 判断是否完整观看
    const isComplete = data.isComplete === 1 || data.progress >= 0.9;

    // 记录每日观看统计
    await this.dailyWatchStatsRepo.recordWatch(
      Platform.BILIBILI,
      dateKey,
      data.watchDuration,
      creatorIds,
      videoIds,
      isComplete
    );

    logger.debug('[DataProcessor] 每日观看统计已更新:', {
      dateKey,
      watchDuration: data.watchDuration,
      creatorIds,
      videoIds,
      isComplete
    });
  }
}
