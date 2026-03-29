import type { CollectionItem, CollectionType } from "../types/collection.js";
import type { Creator } from "../types/creator.js";
import type { FavoriteVideoEntry } from "../types/favorite-video.js";
import type { Tag } from "../types/semantic.js";
import type { Video } from "../types/video.js";
import type { FavoriteVideoIndex, TagIndex } from "../query-server/cache/types.js";
import { CacheManager } from "../query-server/cache/cache-manager.js";
import { CollectionRepositoryImpl, CreatorRepository, Platform, TagRepository, VideoRepository, type ID } from "../index.js";
import type { IDataRepository } from "../query-server/book/base-book-manager.js";

interface AggregatedFavoriteItem {
  latestItem: CollectionItem;
  collectionIds: ID[];
  collectionNames: string[];
  collectionTypes: CollectionType[];
}

export class FavoriteVideoRepository implements IDataRepository<FavoriteVideoEntry> {
  private readonly cacheManager = CacheManager.getInstance();
  private readonly dataCache = this.cacheManager.getFavoriteVideoDataCache();
  private readonly indexCache = this.cacheManager.getFavoriteVideoIndexCache();
  private readonly collectionRepo = new CollectionRepositoryImpl();
  private readonly videoRepo = new VideoRepository();
  private readonly creatorRepo = new CreatorRepository();
  private readonly tagRepo = new TagRepository();

  async getById(id: number): Promise<FavoriteVideoEntry | null> {
    const cached = this.dataCache.get(id);
    if (cached) {
      return cached;
    }

    const allEntries = await this.getAll();
    return allEntries.find(entry => entry.favoriteEntryId === id) ?? null;
  }

  async getByIds(ids: number[]): Promise<FavoriteVideoEntry[]> {
    if (ids.length === 0) {
      return [];
    }

    console.log('[FavoriteVideoRepository] getByIds called with ids:', ids.length);

    const result = new Map<ID, FavoriteVideoEntry>();
    const missingIds: ID[] = [];

    ids.forEach((id) => {
      const cached = this.dataCache.get(id);
      if (cached) {
        result.set(id, cached);
      } else {
        missingIds.push(id);
      }
    });

    console.log('[FavoriteVideoRepository] getByIds cache hit:', result.size, 'missing:', missingIds.length);

    if (missingIds.length > 0) {
      // 从索引缓存中获取缺失的索引
      const missingIndexes = missingIds
        .map(id => this.indexCache.get(id))
        .filter((index): index is FavoriteVideoIndex => index !== undefined);

      console.log('[FavoriteVideoRepository] getByIds found in index cache:', missingIndexes.length);

      // 从视频仓库、创作者仓库和标签仓库获取完整数据
      const videoIds = missingIndexes.map(index => index.videoId);
      const videos = await this.videoRepo.getVideos(videoIds);
      const creatorIds = Array.from(new Set(missingIndexes.map(index => index.creatorId)));
      const creators = await this.creatorRepo.getCreators(creatorIds);
      const tagIds = Array.from(new Set(missingIndexes.flatMap(index => index.tags)));
      const tags = await this.tagRepo.getTags(tagIds);

      // 构建 FavoriteVideoEntry
      missingIndexes.forEach(index => {
        const video = videos.get(index.videoId);
        const creator = creators.get(index.creatorId);
        if (!video || video.isInvalid) {
          return;
        }

        const entry: FavoriteVideoEntry = {
          favoriteEntryId: index.favoriteEntryId,
          videoId: index.videoId,
          platform: index.platform,
          bv: video.bv,
          title: index.title,
          description: video.description,
          creatorId: index.creatorId,
          creatorName: creator?.name ?? `UP ${index.creatorId}`,
          duration: video.duration,
          publishTime: video.publishTime,
          tags: index.tags,
          tagNames: index.tags.map(tagId => tags.get(tagId)?.name ?? ''),
          coverUrl: video.coverUrl,
          picture: video.picture,
          addedAt: index.addedAt,
          collectionIds: index.collectionIds,
          collectionNames: [], // 需要从 CollectionRepository 获取
          collectionTypes: index.collectionTypes
        };

        result.set(index.favoriteEntryId, entry);
        this.dataCache.set(index.favoriteEntryId, entry);
      });
    }

    const finalResult = ids.map(id => result.get(id)).filter((entry): entry is FavoriteVideoEntry => Boolean(entry));
    console.log('[FavoriteVideoRepository] getByIds final result:', finalResult.length);

    return finalResult;
  }

  async getAll(): Promise<FavoriteVideoEntry[]> {
    // 优化：先检查索引缓存，如果已有索引则只返回已缓存的数据
    if (this.indexCache.size() > 0 && this.dataCache.size() > 0) {
      console.log('[FavoriteVideoRepository] getAll returning cached data:', this.dataCache.size());
      return this.dataCache.values();
    }

    console.log('[FavoriteVideoRepository] getAll building cache from scratch');

    // 首次加载：构建索引缓存
    const collections = await this.collectionRepo.getCollectionsByPlatform(Platform.BILIBILI);
    const collectionMap = new Map(
      collections.map(collection => [collection.collectionId, collection])
    );

    const itemsByCollection = await this.collectionRepo.getCollectionItemsByCollectionIds(
      collections.map(collection => collection.collectionId)
    );

    const aggregated = new Map<ID, AggregatedFavoriteItem>();
    itemsByCollection.forEach((items, collectionId) => {
      const collection = collectionMap.get(collectionId);
      if (!collection) {
        return;
      }

      items.forEach((item) => {
        const existing = aggregated.get(item.videoId);
        if (!existing) {
          aggregated.set(item.videoId, {
            latestItem: item,
            collectionIds: [collectionId],
            collectionNames: [collection.name],
            collectionTypes: [collection.type ?? "user"]
          });
          return;
        }

        existing.collectionIds.push(collectionId);
        existing.collectionNames.push(collection.name);
        if (!existing.collectionTypes.includes(collection.type ?? "user")) {
          existing.collectionTypes.push(collection.type ?? "user");
        }
        if (item.addedAt > existing.latestItem.addedAt) {
          existing.latestItem = item;
        }
      });
    });

    console.log('[FavoriteVideoRepository] getAll aggregated items:', aggregated.size);

    const videoIds = Array.from(aggregated.keys());
    const videos = await this.videoRepo.getVideos(videoIds);
    const creators = await this.creatorRepo.getCreators(
      Array.from(new Set(Array.from(videos.values()).map(video => video.creatorId)))
    );
    const tagIds = Array.from(new Set(Array.from(videos.values()).flatMap(video => video.tags)));
    const tags = await this.tagRepo.getTags(tagIds);

    console.log('[FavoriteVideoRepository] getAll videos:', videos.size, 'creators:', creators.size, 'tags:', tags.size);

    // 确保 TagIndex 缓存被加载
    await this.ensureTagIndexCache(tagIds);

    const entries: FavoriteVideoEntry[] = [];
    const cacheEntries = new Map<ID, FavoriteVideoEntry>();
    const indexEntries = new Map<ID, FavoriteVideoIndex>();
    let skippedCount = 0;

    videoIds.forEach((videoId) => {
      const video = videos.get(videoId);
      const aggregate = aggregated.get(videoId);
      if (!video || !aggregate || video.isInvalid) {
        skippedCount++;
        return;
      }

      const creator = creators.get(video.creatorId);
      const entry = this.toEntry(video, creator ?? null, aggregate, tags);
      entries.push(entry);
      cacheEntries.set(entry.favoriteEntryId, entry);
      indexEntries.set(entry.favoriteEntryId, this.toIndex(entry));
    });

    console.log('[FavoriteVideoRepository] getAll skipped invalid videos:', skippedCount, 'valid entries:', entries.length);

    // 批量设置缓存
    this.dataCache.setBatch(cacheEntries);
    this.indexCache.setBatch(indexEntries);

    return entries;
  }

  private toEntry(
    video: Video,
    creator: Creator | null,
    aggregate: AggregatedFavoriteItem,
    tagsMap: Map<ID, Tag>
  ): FavoriteVideoEntry {
    const resolvedTags = video.tags
      .map((tagId) => {
        const tag = tagsMap.get(tagId);
        if (!tag) {
          return null;
        }

        return {
          tagId,
          tagName: tag.name
        };
      })
      .filter((item): item is { tagId: ID; tagName: string } => item !== null);

    return {
      favoriteEntryId: video.videoId,
      videoId: video.videoId,
      platform: video.platform,
      bv: video.bv,
      title: video.title,
      description: video.description,
      creatorId: video.creatorId,
      creatorName: creator?.name ?? `UP ${video.creatorId}`,
      duration: video.duration,
      publishTime: video.publishTime,
      tags: resolvedTags.map(item => item.tagId),
      tagNames: resolvedTags.map(item => item.tagName),
      coverUrl: video.coverUrl,
      picture: video.picture,
      addedAt: aggregate.latestItem.addedAt,
      collectionIds: [...aggregate.collectionIds],
      collectionNames: [...aggregate.collectionNames],
      collectionTypes: [...aggregate.collectionTypes]
    };
  }

  private toIndex(entry: FavoriteVideoEntry): FavoriteVideoIndex {
    return {
      favoriteEntryId: entry.favoriteEntryId,
      videoId: entry.videoId,
      platform: entry.platform,
      title: entry.title,
      creatorId: entry.creatorId,
      collectionIds: entry.collectionIds,
      collectionTypes: entry.collectionTypes,
      tags: entry.tags,
      addedAt: entry.addedAt
    };
  }

  private async ensureTagIndexCache(tagIds: ID[]): Promise<void> {
    const tagIndexCache = this.cacheManager.getTagIndexCache();

    // 检查是否需要加载标签索引
    const missingTagIds = tagIds.filter(tagId => !tagIndexCache.get(tagId));
    if (missingTagIds.length === 0) {
      return;
    }

    // 从数据库获取标签数据
    const tags = await this.tagRepo.getTags(missingTagIds);

    // 构建标签索引
    const indexEntries = new Map<ID, TagIndex>();
    tags.forEach((tag) => {
      indexEntries.set(tag.tagId, {
        tagId: tag.tagId,
        name: tag.name,
        source: tag.source
      });
    });

    // 批量设置标签索引缓存
    tagIndexCache.setBatch(indexEntries);
  }
}
