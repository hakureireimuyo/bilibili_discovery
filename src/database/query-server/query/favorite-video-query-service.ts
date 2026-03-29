import { CreatorRepository } from "../../repositories/creator-repository.js";
import { FavoriteVideoRepository } from "../../repositories/favorite-video-repository.js";
import { CacheManager } from "../cache/cache-manager.js";
import { IndexCache } from "../cache/index-cache.js";
import { TagFilterEngine } from "./tag-filter-engine.js";
import type { CreatorIndex, FavoriteVideoQueryCondition, QueryOutput } from "./types.js";
import type { FavoriteVideoIndex, TagExpression, TagIndex, VideoIndex } from "../cache/types.js";
import type { Platform, ID } from "../../types/base.js";

export class FavoriteVideoQueryService {
  private readonly cacheManager = CacheManager.getInstance();
  private readonly favoriteVideoIndexCache: IndexCache<FavoriteVideoIndex>;
  private readonly creatorIndexCache: IndexCache<CreatorIndex>;
  private readonly favoriteRepository: FavoriteVideoRepository;
  private readonly creatorRepository: CreatorRepository;
  private static readonly DEBUG = true;

  constructor(
    favoriteRepository?: FavoriteVideoRepository,
    creatorRepository?: CreatorRepository
  ) {
    this.favoriteRepository = favoriteRepository ?? new FavoriteVideoRepository();
    this.creatorRepository = creatorRepository ?? new CreatorRepository();
    this.favoriteVideoIndexCache = this.cacheManager.getFavoriteVideoIndexCache();
    this.creatorIndexCache = this.cacheManager.getIndexCache();
  }

  async queryIds(condition: FavoriteVideoQueryCondition): Promise<ID[]> {
    const result = await this.query(condition);
    return result.matchedIds;
  }

  async query(condition: FavoriteVideoQueryCondition): Promise<QueryOutput> {
    await this.ensureIndexCaches(condition.platform);
    if (FavoriteVideoQueryService.DEBUG) {
      console.log("[FavoriteVideoQueryService] query start:", condition);
    }

    // 优化1：使用 Map 结构加速查询
    const indexMap = new Map<ID, FavoriteVideoIndex>();
    this.favoriteVideoIndexCache.values().forEach(index => {
      if (index.platform === condition.platform) {
        indexMap.set(index.favoriteEntryId, index);
      }
    });

    // 获取视频索引缓存以过滤无效视频
    const videoIndexCache = this.cacheManager.getVideoIndexCache();

    // 确保视频索引缓存已加载
    if (videoIndexCache.size() === 0) {
      await this.ensureVideoIndexCache(condition.platform);
    }

    // 优化2：一次性构建所有筛选条件
    const filters: ((index: FavoriteVideoIndex) => boolean)[] = [];

    // 添加无效视频过滤
    filters.push(index => {
      const videoIndex = videoIndexCache.get(index.videoId);
      const isValid = videoIndex !== undefined && !videoIndex.isInvalid;
      if (FavoriteVideoQueryService.DEBUG && !isValid) {
        console.log("[FavoriteVideoQueryService] video filter failed:", {
          favoriteEntryId: index.favoriteEntryId,
          videoId: index.videoId,
          title: index.title,
          videoIndexExists: videoIndex !== undefined,
          isInvalid: videoIndex?.isInvalid
        });
      }
      return isValid;
    });

    // 收藏夹类型筛选
    if (condition.collectionType) {
      filters.push(index => index.collectionTypes.includes(condition.collectionType!));
    }

    // 收藏夹ID筛选
    if (condition.collectionIds && condition.collectionIds.length > 0) {
      const collectionIdSet = new Set(condition.collectionIds);
      filters.push(index =>
        collectionIdSet.has(index.collectionIds.find(id => collectionIdSet.has(id))!)
      );
    }

    // 创作者筛选
    if (condition.creatorKeyword) {
      const creatorTerms = this.normalizeSearchTerms(condition.creatorKeyword);
      const creatorIdSet = new Set(
        this.creatorIndexCache.values()
          .filter(creator => this.matchesAllTerms(creator.name, creatorTerms))
          .map(creator => creator.creatorId)
      );
      filters.push(index => creatorIdSet.has(index.creatorId));
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after creatorKeyword:", {
          creatorTerms,
          creatorMatchCount: creatorIdSet.size
        });
      }
    }

    // 标签筛选
    if (condition.tagExpressions && condition.tagExpressions.length > 0) {
      const filterResult = this.filterByTags(
        Array.from(indexMap.values()),
        condition.tagExpressions
      );
      const matchedIdSet = new Set(filterResult.map(index => index.favoriteEntryId));
      filters.push(index => matchedIdSet.has(index.favoriteEntryId));
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after tagExpressions:", filterResult.length);
      }
    }

    // 关键词筛选
    if (condition.keyword) {
      const titleTerms = this.normalizeSearchTerms(condition.keyword);
      filters.push(index => this.matchesAllTerms(index.title, titleTerms));
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after keyword:", {
          titleTerms
        });
      }
    }

    // 优化3：应用所有筛选条件
    const results = Array.from(indexMap.values()).filter(index => {
      const isValid = filters.every(filter => filter(index));
      if (FavoriteVideoQueryService.DEBUG && !isValid) {
        console.log("[FavoriteVideoQueryService] filtered index:", {
          favoriteEntryId: index.favoriteEntryId,
          videoId: index.videoId,
          title: index.title
        });
      }
      return isValid;
    });

    // 排序
    results.sort((left, right) => right.addedAt - left.addedAt);
    if (FavoriteVideoQueryService.DEBUG) {
      console.log("[FavoriteVideoQueryService] final result count:", results.length);
      console.log("[FavoriteVideoQueryService] initial index count:", indexMap.size);
      console.log("[FavoriteVideoQueryService] video index cache size:", videoIndexCache.size());
    }

    return {
      matchedIds: results.map(index => index.favoriteEntryId),
      stats: {
        initialCount: this.favoriteVideoIndexCache.size(),
        stageCounts: {}
      }
    };
  }

  async loadIndexCache(platform: Platform): Promise<void> {
    await this.favoriteRepository.getAll();
    await this.ensureCreatorIndexCache(platform);
  }

  clearIndexCache(): void {
    this.favoriteVideoIndexCache.clear();
  }

  getFavoriteVideoIndexCache(): IndexCache<FavoriteVideoIndex> {
    return this.favoriteVideoIndexCache;
  }

  getTagIndexCache(): IndexCache<TagIndex> {
    return this.cacheManager.getTagIndexCache();
  }

  private async ensureIndexCaches(platform: Platform): Promise<void> {
    if (this.favoriteVideoIndexCache.size() === 0) {
      await this.favoriteRepository.getAll();
    }

    await this.ensureCreatorIndexCache(platform);
  }

  private async ensureCreatorIndexCache(platform: Platform): Promise<void> {
    if (this.creatorIndexCache.size() > 0) {
      return;
    }

    const creators = await this.creatorRepository.getAllCreators(platform);
    const entries = new Map<ID, CreatorIndex>();
    creators.forEach((creator) => {
      entries.set(creator.creatorId, {
        creatorId: creator.creatorId,
        name: creator.name,
        tags: creator.tagWeights.map(tag => tag.tagId),
        isFollowing: creator.isFollowing === 1
      });
    });
    this.creatorIndexCache.setBatch(entries);
  }

  private async ensureVideoIndexCache(platform: Platform): Promise<void> {
    const videoIndexCache = this.cacheManager.getVideoIndexCache();
    if (videoIndexCache.size() > 0) {
      return;
    }

    // 导入 VideoRepository
    const { VideoRepository } = await import("../../repositories/video-repository.js");
    const videoRepository = new VideoRepository();

    // 获取所有视频以加载索引缓存
    const videos = await videoRepository.getAll();

    // 手动填充视频索引缓存
    const indexEntries = new Map<ID, VideoIndex>();
    videos.forEach(video => {
      indexEntries.set(video.videoId, {
        videoId: video.videoId,
        platform: video.platform,
        bv: video.bv,
        creatorId: video.creatorId,
        title: video.title,
        duration: video.duration,
        publishTime: video.publishTime,
        tags: video.tags,
        isInvalid: video.isInvalid
      });
    });

    // 设置到缓存中
    videoIndexCache.setBatch(indexEntries);
  }

  private filterByTags(indexes: FavoriteVideoIndex[], expressions: TagExpression[]): FavoriteVideoIndex[] {
    const tagToIds = TagFilterEngine.buildTagIndexMap(
      indexes.map(index => ({ id: index.favoriteEntryId, tags: index.tags }))
    );

    const filterResult = TagFilterEngine.filter(tagToIds, expressions);
    return indexes.filter(index => filterResult.matchedIds.has(index.favoriteEntryId));
  }

  private normalizeSearchTerms(keyword: string): string[] {
    return keyword
      .toLowerCase()
      .split(/\s+/)
      .map(term => term.trim())
      .filter(Boolean);
  }

  private matchesAllTerms(value: string, terms: string[]): boolean {
    if (terms.length === 0) {
      return true;
    }

    const normalizedValue = value.toLowerCase();
    return terms.every(term => normalizedValue.includes(term));
  }
}
