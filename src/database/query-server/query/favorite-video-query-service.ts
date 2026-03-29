import { CreatorRepository } from "../../repositories/creator-repository.js";
import { FavoriteVideoRepository } from "../../repositories/favorite-video-repository.js";
import { CacheManager } from "../cache/cache-manager.js";
import { IndexCache } from "../cache/index-cache.js";
import { TagFilterEngine } from "./tag-filter-engine.js";
import type { CreatorIndex, FavoriteVideoQueryCondition, QueryOutput } from "./types.js";
import type { FavoriteVideoIndex, TagExpression, TagIndex } from "../cache/types.js";
import type { Platform, ID } from "../../types/base.js";

export class FavoriteVideoQueryService {
  private readonly cacheManager = CacheManager.getInstance();
  private readonly favoriteVideoIndexCache: IndexCache<FavoriteVideoIndex>;
  private readonly creatorIndexCache: IndexCache<CreatorIndex>;
  private readonly favoriteRepository: FavoriteVideoRepository;
  private readonly creatorRepository: CreatorRepository;
  private static readonly DEBUG = false;

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

    let results = this.favoriteVideoIndexCache.values().filter(index => index.platform === condition.platform);
    if (FavoriteVideoQueryService.DEBUG) {
      console.log("[FavoriteVideoQueryService] after platform:", results.length);
    }

    if (condition.collectionType) {
      results = results.filter(index => index.collectionTypes.includes(condition.collectionType!));
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after collectionType:", results.length);
      }
    }

    if (condition.collectionIds && condition.collectionIds.length > 0) {
      results = results.filter(index =>
        condition.collectionIds!.some(collectionId => index.collectionIds.includes(collectionId))
      );
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after collectionIds:", results.length);
      }
    }

    if (condition.creatorKeyword) {
      const creatorTerms = this.normalizeSearchTerms(condition.creatorKeyword);
      const creatorIds = this.creatorIndexCache.values()
        .filter(creator => this.matchesAllTerms(creator.name, creatorTerms))
        .map(creator => creator.creatorId);
      const creatorIdSet = new Set(creatorIds);
      results = results.filter(index => creatorIdSet.has(index.creatorId));
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after creatorKeyword:", {
          creatorTerms,
          creatorMatchCount: creatorIds.length,
          resultCount: results.length
        });
      }
    }

    if (condition.tagExpressions && condition.tagExpressions.length > 0) {
      results = this.filterByTags(results, condition.tagExpressions);
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after tagExpressions:", results.length);
      }
    }

    if (condition.keyword) {
      const titleTerms = this.normalizeSearchTerms(condition.keyword);
      results = results.filter(index => this.matchesAllTerms(index.title, titleTerms));
      if (FavoriteVideoQueryService.DEBUG) {
        console.log("[FavoriteVideoQueryService] after keyword:", {
          titleTerms,
          resultCount: results.length
        });
      }
    }

    results.sort((left, right) => right.addedAt - left.addedAt);
    if (FavoriteVideoQueryService.DEBUG) {
      console.log("[FavoriteVideoQueryService] final result count:", results.length);
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
