/**
 * 收藏同步服务
 * 负责从B站同步收藏数据到本地数据库
 */

import { Platform } from "../../../database/types/base.js";
import type { CollectionType } from "../../../database/types/collection.js";
import type {
  CollectedFavoriteFolder,
  FavoriteFolderLike,
  FavoriteSearchParams,
  FavoriteSyncConfig,
  FavoriteSyncResult,
  FavoriteTag,
  FavoriteVideoDetail,
  FavoriteVideoEntry,
  IFavoriteSyncDependencies,
  SyncProgress,
  SyncProgressCallback
} from "./types.js";
import { DEFAULT_FAVORITE_SYNC_CONFIG } from "./config.js";
import { toDBCreator, toDBTag, toDBVideo, toInvalidVideo, toDBTags } from "./data-converters.js";

const BILIBILI = Platform.BILIBILI;
const SEARCH_PAGE_SIZE = 1000;
const LOCAL_ITEMS_PAGE_SIZE = 10000;
const REMOTE_PAGE_SIZE = 20;
const MAX_FETCH_LIMIT = 1000;
const MAX_CONSECUTIVE_EXISTING_PAGES = 5;
const TAG_BATCH_SIZE = 50; // 批量处理标签的数量

type StopChecker = (() => Promise<boolean>) | undefined;

interface FolderContext {
  collectionId: string;
  title: string;
  mediaCount: number;
  type: CollectionType;
  description: string;
  isCollectedFolder: boolean;
  remoteId: number;
}

interface FolderState {
  localVideoCount: number;
  localVideoIds: Set<string>;
  expectedNewCount: number;
}

interface FetchPlan {
  currentPage: number;
  hasJumped: boolean;
  allFetchedCount: number;
  consecutiveExistingCount: number;
  videosToSync: FavoriteVideoEntry[];
}

interface SyncContext {
  totalFolders: number;
  processedFolders: number;
  totalSynced: number;
  totalToSync: number;
  progressCallback?: SyncProgressCallback;
}

/**
 * 收藏同步服务类
 */
export class FavoriteSyncService {
  private readonly config: FavoriteSyncConfig;
  private syncContext: SyncContext | null = null;

  constructor(
    private readonly dependencies: IFavoriteSyncDependencies,
    config: Partial<FavoriteSyncConfig> = {}
  ) {
    this.config = { ...DEFAULT_FAVORITE_SYNC_CONFIG, ...config };
  }

  /**
   * 同步收藏视频
   * @param up_mid 用户ID
   * @param shouldStop 停止检查器
   * @param progressCallback 进度回调
   * @returns 同步结果
   */
  async syncFavoriteVideos(
    up_mid: number,
    shouldStop?: StopChecker,
    progressCallback?: SyncProgressCallback
  ): Promise<FavoriteSyncResult> {
    const result: FavoriteSyncResult = {
      syncedCount: 0,
      failedVideos: []
    };

    try {
      // 初始化同步上下文
      const folders = await this.dependencies.favoriteDataSource.getFavoriteFolders(up_mid);
      const collectedFolders = await this.dependencies.favoriteDataSource.getCollectedFolders(up_mid);
      const allFolders = [...folders, ...collectedFolders];
      
      this.syncContext = {
        totalFolders: allFolders.length,
        processedFolders: 0,
        totalSynced: 0,
        totalToSync: allFolders.reduce((sum, f) => sum + f.media_count, 0),
        progressCallback
      };

      if (this.config.createMultipleCollections) {
        await this.syncIntoSeparateCollections(allFolders, result, shouldStop);
      } else {
        await this.syncIntoDefaultCollection(up_mid, result, shouldStop);
      }

      return result;
    } catch (error) {
      console.error("[FavoriteSync] Error syncing favorite videos:", error);
      throw error;
    } finally {
      this.syncContext = null;
    }
  }

  async searchFavoriteVideos(params: FavoriteSearchParams): Promise<FavoriteVideoDetail[]> {
    const targetCollectionId = params.collectionId ?? this.config.defaultCollectionId;
    const collection = await this.dependencies.collectionRepository.getCollection(targetCollectionId);

    if (!collection) {
      return [];
    }

    const { items } = await this.dependencies.collectionItemRepository.getCollectionVideos(collection.collectionId, {
      page: 0,
      pageSize: SEARCH_PAGE_SIZE
    });

    const videoIds = items.map(item => item.videoId);
    const videos = await this.dependencies.videoRepository.getVideos(videoIds, BILIBILI);
    const itemMap = new Map(items.map(item => [item.videoId, item]));

    return videos
      .map(video => ({
        ...video,
        addedAt: itemMap.get(video.videoId)?.addedAt
      }))
      .filter(video => this.matchesSearchParams(video, params));
  }

  private async syncIntoSeparateCollections(
    folders: FavoriteFolderLike[],
    result: FavoriteSyncResult,
    shouldStop?: StopChecker
  ): Promise<void> {
    for (const folder of folders) {
      if (await this.shouldStopSync(shouldStop, "before processing folder")) {
        break;
      }

      await this.syncFolder(folder, result, shouldStop);
      
      if (this.syncContext) {
        this.syncContext.processedFolders++;
        this.updateProgress(folder.title, 0, folder.media_count);
      }
    }
  }

  private async syncIntoDefaultCollection(
    upMid: number,
    result: FavoriteSyncResult,
    shouldStop?: StopChecker
  ): Promise<void> {
    const collection = await this.getOrCreateDefaultCollection();
    if (!collection) {
      throw new Error("Failed to create or get collection");
    }

    const favoriteVideos = await this.dependencies.favoriteDataSource.getAllFavoriteVideos(upMid, shouldStop);
    await this.processBatches(favoriteVideos, collection.collectionId, result, shouldStop);
  }

  private async syncFolder(
    folder: FavoriteFolderLike,
    result: FavoriteSyncResult,
    shouldStop?: StopChecker
  ): Promise<void> {
    const context = this.createFolderContext(folder);
    const collection = await this.getOrCreateCollection(
      context.collectionId,
      context.title,
      context.description,
      context.type
    );

    if (!collection) {
      console.warn(`[FavoriteSync] Failed to resolve collection for folder ${context.title}`);
      return;
    }

    const state = await this.buildFolderState(context);
    if (state.expectedNewCount <= 0) {
      console.log(`[FavoriteSync] Folder ${context.title} is already up to date`);
      return;
    }

    console.log(`[FavoriteSync] Syncing ${context.title}: ${state.expectedNewCount} new videos expected`);

    const fetchedVideos = await this.collectNewVideos(context, state, shouldStop);
    if (fetchedVideos.length === 0) {
      console.warn(
        `[FavoriteSync] No new videos found for ${context.title} despite remote count ${context.mediaCount}`
      );
      return;
    }

    await this.processBatches(fetchedVideos, context.collectionId, result, shouldStop, context.title);
  }

  private createFolderContext(folder: FavoriteFolderLike): FolderContext {
    const isCollectedFolder = this.isCollectedFolder(folder);

    return {
      collectionId: String(folder.id),
      title: folder.title,
      mediaCount: folder.media_count,
      type: isCollectedFolder ? "subscription" : "user",
      description: isCollectedFolder
        ? `从UP主"${folder.upper.name}"的合集"${folder.title}"同步的收藏视频`
        : `从B站收藏夹"${folder.title}"同步的收藏视频`,
      isCollectedFolder,
      remoteId: folder.id
    };
  }

  private async buildFolderState(context: FolderContext): Promise<FolderState> {
    const localVideoCount = await this.dependencies.collectionItemRepository.countCollectionItems(context.collectionId);
    
    // 获取本地视频ID集合
    const localVideoIds = new Set<string>();
    let page = 0;
    
    while (true) {
      const { items, total } = await this.dependencies.collectionItemRepository.getCollectionVideos(context.collectionId, {
        page,
        pageSize: LOCAL_ITEMS_PAGE_SIZE
      });
      
      if (items.length === 0 || items.length >= total) {
        break;
      }
      
      items.forEach(item => localVideoIds.add(item.videoId));
      page++;
    }

    return {
      localVideoCount,
      localVideoIds,
      expectedNewCount: Math.max(0, context.mediaCount - localVideoCount)
    };
  }

  private async collectNewVideos(
    context: FolderContext,
    state: FolderState,
    shouldStop?: StopChecker
  ): Promise<FavoriteVideoEntry[]> {
    const plan: FetchPlan = {
      currentPage: 1,
      hasJumped: false,
      allFetchedCount: 0,
      consecutiveExistingCount: 0,
      videosToSync: []
    };

    const maxFetchLimit = Math.min(state.expectedNewCount * 2, MAX_FETCH_LIMIT);
    const firstPageVideos = await this.fetchFolderVideos(context, plan.currentPage);

    if (firstPageVideos.length === 0) {
      return [];
    }

    this.consumeFetchedPage(firstPageVideos, state.localVideoIds, state.expectedNewCount, plan);

    if (plan.videosToSync.length === 0 && state.localVideoCount > 0 && firstPageVideos.length === REMOTE_PAGE_SIZE) {
      const jumpPage = Math.floor(state.localVideoCount / REMOTE_PAGE_SIZE);
      if (jumpPage > 1) {
        plan.currentPage = jumpPage;
        plan.hasJumped = true;
        plan.consecutiveExistingCount = 0;
      }
    }

    while (plan.videosToSync.length < state.expectedNewCount && plan.allFetchedCount < maxFetchLimit) {
      if (await this.shouldStopSync(shouldStop, "while fetching folder videos")) {
        break;
      }

      plan.currentPage += 1;
      const videos = await this.fetchFolderVideos(context, plan.currentPage);
      if (videos.length === 0) {
        break;
      }

      const hadNewVideo = this.consumeFetchedPage(videos, state.localVideoIds, state.expectedNewCount, plan);

      if (
        plan.hasJumped &&
        !hadNewVideo &&
        plan.consecutiveExistingCount >= MAX_CONSECUTIVE_EXISTING_PAGES * REMOTE_PAGE_SIZE
      ) {
        break;
      }

      if (videos.length < REMOTE_PAGE_SIZE) {
        break;
      }
    }

    return plan.videosToSync;
  }

  private consumeFetchedPage(
    videos: FavoriteVideoEntry[],
    localVideoIds: Set<string>,
    expectedNewCount: number,
    plan: FetchPlan
  ): boolean {
    plan.allFetchedCount += videos.length;

    let hadNewVideo = false;
    for (const video of videos) {
      if (localVideoIds.has(video.bvid)) {
        plan.consecutiveExistingCount += 1;
        continue;
      }

      plan.videosToSync.push(video);
      plan.consecutiveExistingCount = 0;
      hadNewVideo = true;

      if (plan.videosToSync.length >= expectedNewCount) {
        break;
      }
    }

    return hadNewVideo;
  }

  private async processBatches(
    videos: FavoriteVideoEntry[],
    collectionId: string,
    result: FavoriteSyncResult,
    shouldStop?: StopChecker,
    folderTitle?: string
  ): Promise<void> {
    let syncedInFolder = 0;
    
    for (let index = 0; index < videos.length; index += this.config.batchSize) {
      if (await this.shouldStopSync(shouldStop, "before processing batch")) {
        return;
      }

      const batch = videos.slice(index, index + this.config.batchSize);
      const shouldStopBatch = await this.processBatch(
        batch,
        collectionId,
        result,
        shouldStop,
        folderTitle
      );
      
      syncedInFolder += batch.length;
      
      if (folderTitle) {
        this.updateProgress(folderTitle, syncedInFolder, videos.length);
      }
      
      if (shouldStopBatch) {
        return;
      }
    }
  }

  private async processBatch(
    batch: FavoriteVideoEntry[],
    collectionId: string,
    result: FavoriteSyncResult,
    shouldStop?: StopChecker,
    folderTitle?: string
  ): Promise<boolean> {
    for (const favoriteVideo of batch) {
      if (await this.shouldStopSync(shouldStop, "during batch processing")) {
        return true;
      }

      try {
        await this.syncSingleVideo(collectionId, favoriteVideo, result, folderTitle);
      } catch (error) {
        console.error(`[FavoriteSync] Error processing video ${favoriteVideo.bvid}:`, error);
        this.recordFailure(result, favoriteVideo.bvid, error);
      }
    }

    return false;
  }

  private async syncSingleVideo(
    collectionId: string,
    favoriteVideo: FavoriteVideoEntry,
    result: FavoriteSyncResult,
    folderTitle?: string
  ): Promise<void> {
    // 更新当前处理的视频
    if (folderTitle) {
      this.updateProgress(folderTitle, 0, 0, favoriteVideo.bvid);
    }
    
    const alreadyInCollection = await this.dependencies.collectionItemRepository.isVideoInCollection(
      collectionId,
      favoriteVideo.bvid
    );
    if (alreadyInCollection) {
      return;
    }

    const videoDetail = await this.dependencies.videoDataSource.getVideoDetail(favoriteVideo.bvid);
    if (!videoDetail) {
      await this.persistInvalidVideo(collectionId, favoriteVideo.bvid, result, "无法获取视频详情");
      return;
    }

    const videoTags = await this.dependencies.videoDataSource.getVideoTags(favoriteVideo.bvid);
    await this.ensureCreatorExists(videoDetail.owner.mid, videoDetail.owner.name);
    const tagIds = await this.ensureTagsExist(videoTags);

    await this.dependencies.videoRepository.upsertVideo(toDBVideo(videoDetail, tagIds));
    
    // 添加到收藏夹
    try {
      await this.dependencies.collectionItemRepository.addVideoToCollection(collectionId, favoriteVideo.bvid, BILIBILI);
      result.syncedCount += 1;
    } catch (error) {
      this.recordFailure(result, favoriteVideo.bvid, error);
    }
  }

  private async persistInvalidVideo(
    collectionId: string,
    bvid: string,
    result: FavoriteSyncResult,
    reason?: string
  ): Promise<void> {
    await this.dependencies.videoRepository.upsertVideo(toInvalidVideo(bvid, undefined, reason));
    await this.addVideoToCollection(collectionId, bvid, result);
  }

  private async addVideoToCollection(
    collectionId: string,
    bvid: string,
    result: FavoriteSyncResult
  ): Promise<void> {
    try {
      await this.dependencies.collectionItemRepository.addVideoToCollection(collectionId, bvid, BILIBILI);
      result.syncedCount += 1;
    } catch (error) {
      this.recordFailure(result, bvid, error);
    }
  }

  private async ensureCreatorExists(mid: number, name: string): Promise<void> {
    const creatorId = String(mid);
    const existing = await this.dependencies.creatorRepository.getCreator(creatorId, BILIBILI);

    if (!existing) {
      await this.dependencies.creatorRepository.upsertCreator(toDBCreator(mid, name));
    }
  }

  /**
   * 批量确保标签存在
   * 优化：一次性查询所有标签，然后批量创建不存在的标签
   */
  private async ensureTagsExist(tags: FavoriteTag[]): Promise<string[]> {
    if (tags.length === 0) {
      return [];
    }

    const tagIds = tags.map(tag => String(tag.tag_id));
    
    // 批量查询已存在的标签
    const existingTags = new Map<string, boolean>();
    for (let i = 0; i < tagIds.length; i += TAG_BATCH_SIZE) {
      const batchIds = tagIds.slice(i, i + TAG_BATCH_SIZE);
      for (const id of batchIds) {
        const existing = await this.dependencies.tagRepository.getTag(id);
        existingTags.set(id, !!existing);
      }
    }

    // 批量创建不存在的标签
    const tagsToCreate: Array<Omit<typeof tags[0], "tag_id">> = [];
    for (const tag of tags) {
      const tagId = String(tag.tag_id);
      if (!existingTags.get(tagId)) {
        const { tag_id: _, ...tagWithoutId } = tag;
        tagsToCreate.push(tagWithoutId);
      }
    }

    if (tagsToCreate.length > 0) {
      const dbTags = toDBTags(tagsToCreate.map(t => ({ ...t, tag_id: parseInt(tagIds[tagsToCreate.indexOf(t)]) })));
      for (const dbTag of dbTags) {
        try {
          await this.dependencies.tagRepository.createTag(dbTag);
        } catch (error) {
          console.error(`[FavoriteSync] Failed to create tag ${dbTag.name}:`, error);
        }
      }
    }

    return tagIds;
  }

  private async fetchFolderVideos(context: FolderContext, page: number): Promise<FavoriteVideoEntry[]> {
    return context.isCollectedFolder
      ? this.dependencies.favoriteDataSource.getSeasonVideos(context.remoteId, page, REMOTE_PAGE_SIZE)
      : this.dependencies.favoriteDataSource.getFavoriteVideos(context.remoteId, page, REMOTE_PAGE_SIZE);
  }

  private async getOrCreateCollection(
    collectionId: string,
    name: string,
    description: string,
    type: CollectionType
  ) {
    let collection = await this.dependencies.collectionRepository.getCollection(collectionId);

    if (!collection) {
      await this.dependencies.collectionRepository.createCollectionWithId(collectionId, {
        platform: BILIBILI,
        name,
        description,
        createdAt: Date.now(),
        lastUpdate: Date.now(),
        type
      });
      collection = await this.dependencies.collectionRepository.getCollection(collectionId);
    }

    return collection;
  }

  private getOrCreateDefaultCollection() {
    return this.getOrCreateCollection(
      this.config.defaultCollectionId,
      this.config.defaultCollectionName,
      this.config.defaultCollectionDescription,
      "user"
    );
  }

  private matchesSearchParams(video: FavoriteVideoDetail, params: FavoriteSearchParams): boolean {
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      const title = video.title.toLowerCase();
      const description = video.description.toLowerCase();
      if (!title.includes(keyword) && !description.includes(keyword)) {
        return false;
      }
    }

    if (params.tagId && !video.tags.includes(params.tagId)) {
      return false;
    }

    if (params.creatorId && video.creatorId !== params.creatorId) {
      return false;
    }

    return true;
  }

  private async shouldStopSync(shouldStop: StopChecker, context: string): Promise<boolean> {
    if (!shouldStop) {
      return false;
    }

    const stopped = await shouldStop();
    if (stopped) {
      console.log(`[FavoriteSync] Sync stopped by user (${context})`);
    }

    return stopped;
  }

  private isCollectedFolder(folder: FavoriteFolderLike): folder is CollectedFavoriteFolder {
    return "upper" in folder;
  }

  private recordFailure(result: FavoriteSyncResult, bvid: string, error: unknown): void {
    result.failedVideos.push({
      bvid,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  /**
   * 更新同步进度
   */
  private updateProgress(
    currentFolder: string,
    currentFolderSynced: number,
    currentFolderTotal: number,
    currentVideo?: string
  ): void {
    if (!this.syncContext || !this.syncContext.progressCallback) {
      return;
    }

    const progress: SyncProgress = {
      currentFolder,
      currentFolderSynced,
      currentFolderTotal,
      totalSynced: this.syncContext.totalSynced,
      totalToSync: this.syncContext.totalToSync,
      currentVideo
    };

    this.syncContext.progressCallback(progress);
  }
}
