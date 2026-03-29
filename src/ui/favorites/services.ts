import {
  bookManager,
  CollectionRepositoryImpl,
  type FavoriteVideoEntry,
  FavoriteVideoQueryService,
  FavoriteVideoRepository,
  Platform,
  VideoRepository,
  type BookType,
  type ID
} from "../../database/index.js";
import type { CollectionType } from "../../database/types/collection.js";
import type { FavoriteVideoQueryCondition } from "../../database/query-server/query/types.js";
import type { IElementBuilder } from "../../renderer/types.js";
import { RenderBook } from "../../renderer/RenderBook.js";
import type {
  FavoriteCollectionSummary,
  FavoriteTagSummary,
  FavoriteVideoListItem,
  FavoriteVideoQuery,
  FavoriteVideoQueryResult,
  FavoritesCollectionSelection
} from "./types.js";
import { parseFavoriteSearch } from "./helpers.js";

export class FavoritesDataService {
  private readonly collectionRepo = new CollectionRepositoryImpl();
  private readonly favoriteVideoRepo = new FavoriteVideoRepository();
  private readonly favoriteVideoQueryService = new FavoriteVideoQueryService(this.favoriteVideoRepo);
  private readonly videoRepo = new VideoRepository();
  private static readonly DEBUG = false;

  private collections: FavoriteCollectionSummary[] = [];
  private favoriteBook: BookType<FavoriteVideoEntry> | null = null;
  private favoriteRenderBook: RenderBook<FavoriteVideoEntry, HTMLElement> | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const allCollections = await this.collectionRepo.getCollectionsByPlatform(Platform.BILIBILI);
    const itemsByCollection = await this.collectionRepo.getCollectionItemsByCollectionIds(
      allCollections.map(collection => collection.collectionId)
    );
    const allVideoIds = Array.from(new Set(
      Array.from(itemsByCollection.values()).flatMap(items => items.map(item => item.videoId))
    ));
    const videosMap = await this.videoRepo.getVideos(allVideoIds);

    this.collections = allCollections
      .map((collection) => {
        const items = itemsByCollection.get(collection.collectionId) ?? [];
        let validVideoCount = 0;
        let invalidVideoCount = 0;

        items.forEach((item) => {
          const video = videosMap.get(item.videoId);
          if (!video || video.isInvalid) {
            invalidVideoCount += 1;
          } else {
            validVideoCount += 1;
          }
        });

        return {
          collectionId: collection.collectionId,
          name: collection.name,
          description: collection.description,
          type: collection.type ?? "user",
          videoCount: items.length,
          validVideoCount,
          invalidVideoCount,
          lastAddedAt: collection.lastAddedAt
        };
      })
      .sort((left, right) => {
        const diff = (right.lastAddedAt ?? 0) - (left.lastAddedAt ?? 0);
        if (diff !== 0) {
          return diff;
        }
        return left.name.localeCompare(right.name, "zh-CN");
      });

    this.initialized = true;
  }

  getCollections(type: CollectionType): FavoriteCollectionSummary[] {
    return this.collections.filter(collection => collection.type === type);
  }

  async getTagSummaries(
    collectionType: CollectionType,
    selectedCollectionId: FavoritesCollectionSelection,
    keyword: string
  ): Promise<FavoriteTagSummary[]> {
    // 1. 确保索引已加载
    await this.favoriteVideoQueryService.loadIndexCache(Platform.BILIBILI);

    // 2. 从索引缓存中获取所有索引 (轻量级数据)
    const allIndexes = this.favoriteVideoQueryService.getFavoriteVideoIndexCache().values();

    // 3. 根据收藏夹类型和选中的收藏夹筛选索引
    const selectedCollectionIds = this.getSelectedCollectionIds(collectionType, selectedCollectionId);
    const filteredIndexes = allIndexes.filter(index => {
      const typeMatch = index.collectionTypes.includes(collectionType);
      const collectionMatch = selectedCollectionIds.length === 0 ||
        selectedCollectionIds.some(id => index.collectionIds.includes(id));
      return typeMatch && collectionMatch;
    });

    // 4. 构建标签统计 (只操作索引,不加载完整数据)
    const tagCounter = new Map<ID, FavoriteTagSummary>();
    filteredIndexes.forEach((index) => {
      index.tags.forEach((tagId) => {
        const existing = tagCounter.get(tagId);
        if (existing) {
          existing.count += 1;
          return;
        }

        // 从 TagIndex 缓存中获取标签名称,而不是从完整 entry
        const tagName = this.getTagName(tagId);
        tagCounter.set(tagId, {
          tagId,
          name: tagName,
          count: 1
        });
      });
    });

    // 5. 应用关键词过滤和排序
    const normalizedKeyword = keyword.trim().toLowerCase();
    return Array.from(tagCounter.values())
      .filter(tag => !normalizedKeyword || tag.name.toLowerCase().includes(normalizedKeyword))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"));
  }

  private getTagName(tagId: ID): string {
    // 从 TagIndex 缓存中获取标签名称
    const tagIndex = this.favoriteVideoQueryService.getTagIndexCache().get(tagId);
    return tagIndex?.name ?? `Tag ${tagId}`;
  }

  async getTagsByIds(tagIds: ID[]): Promise<Map<ID, FavoriteTagSummary>> {
    if (tagIds.length === 0) {
      return new Map();
    }

    const result = new Map<ID, FavoriteTagSummary>();

    // 直接从 TagIndex 缓存中获取标签信息,不需要加载完整数据
    const tagIndexCache = this.favoriteVideoQueryService.getTagIndexCache();
    tagIds.forEach((tagId) => {
      const tagIndex = tagIndexCache.get(tagId);
      result.set(tagId, {
        tagId,
        name: tagIndex?.name ?? `Tag ${tagId}`,
        count: 0
      });
    });

    return result;
  }

  async queryVideos(query: FavoriteVideoQuery): Promise<FavoriteVideoQueryResult> {
    const condition = this.toQueryCondition(query);
    if (FavoritesDataService.DEBUG) {
      console.log("[FavoritesDataService] queryVideos condition:", {
        query,
        condition
      });
    }

    // 优化：确保索引缓存已加载
    await this.favoriteVideoQueryService.loadIndexCache(condition.platform);

    const page = await this.getQueryPage(condition, query.page, query.pageSize);
    if (FavoritesDataService.DEBUG) {
      console.log("[FavoritesDataService] queryVideos page:", {
        requestedPage: query.page,
        actualPage: page.state.currentPage,
        pageSize: page.state.pageSize,
        totalRecords: page.state.totalRecords,
        totalPages: page.state.totalPages,
        itemCount: page.items.length
      });
    }

    // 优化：只转换当前页的数据
    const items = page.items.map(entry => this.toVideoListItem(entry));

    return {
      items,
      total: page.state.totalRecords,
      page: page.state.currentPage,
      pageSize: page.state.pageSize,
      totalPages: Math.max(1, page.state.totalPages || 1),
      availableCollectionIds: this.getSelectedCollectionIds(query.collectionType, query.selectedCollectionId)
    };
  }

  async getRenderBook(
    query: FavoriteVideoQuery,
    elementBuilder: IElementBuilder<FavoriteVideoEntry, HTMLElement>
  ): Promise<RenderBook<FavoriteVideoEntry, HTMLElement>> {
    const condition = this.toQueryCondition(query);
    if (FavoritesDataService.DEBUG) {
      console.log("[FavoritesDataService] getRenderBook condition:", {
        query,
        condition
      });
    }

    if (!this.favoriteBook) {
      this.favoriteBook = await bookManager.createBook(condition, {
        repository: this.favoriteVideoRepo,
        queryService: this.favoriteVideoQueryService,
        pageSize: query.pageSize
      });
      if (FavoritesDataService.DEBUG) {
        console.log("[FavoritesDataService] created favoriteBook:", {
          bookId: this.favoriteBook.bookId,
          totalRecords: this.favoriteBook.state.totalRecords,
          totalPages: this.favoriteBook.state.totalPages
        });
      }
    } else {
      await this.favoriteBook.updateIndex(condition);
      if (FavoritesDataService.DEBUG) {
        console.log("[FavoritesDataService] updated favoriteBook:", {
          bookId: this.favoriteBook.bookId,
          totalRecords: this.favoriteBook.state.totalRecords,
          totalPages: this.favoriteBook.state.totalPages
        });
      }
    }

    if (!this.favoriteRenderBook) {
      this.favoriteRenderBook = new RenderBook<FavoriteVideoEntry, HTMLElement>({
        book: this.favoriteBook,
        elementBuilder,
        maxCachePages: 3
      });
      return this.favoriteRenderBook;
    }

    this.favoriteRenderBook.setBook(this.favoriteBook);
    return this.favoriteRenderBook;
  }

  private async getQueryPage(condition: FavoriteVideoQueryCondition, page: number, pageSize: number) {
    if (!this.favoriteBook) {
      this.favoriteBook = await bookManager.createBook(condition, {
        repository: this.favoriteVideoRepo,
        queryService: this.favoriteVideoQueryService,
        pageSize
      });
      if (FavoritesDataService.DEBUG) {
        console.log("[FavoritesDataService] getQueryPage created book:", {
          bookId: this.favoriteBook.bookId,
          totalRecords: this.favoriteBook.state.totalRecords,
          totalPages: this.favoriteBook.state.totalPages
        });
      }
    } else {
      await this.favoriteBook.updateIndex(condition);
      if (FavoritesDataService.DEBUG) {
        console.log("[FavoritesDataService] getQueryPage updated book:", {
          bookId: this.favoriteBook.bookId,
          totalRecords: this.favoriteBook.state.totalRecords,
          totalPages: this.favoriteBook.state.totalPages
        });
      }
    }

    const totalPages = this.favoriteBook.state.totalPages;
    const safePage = totalPages === 0 ? 0 : Math.min(page, totalPages - 1);
    return this.favoriteBook.getPage(safePage, { pageSize });
  }

  public toQueryCondition(query: FavoriteVideoQuery): FavoriteVideoQueryCondition {
    const { titleTerms, creatorTerms } = parseFavoriteSearch(query.keyword);
    const tagExpressions = [
      ...query.includeTagIds.map((tagId) => ({ tagId, operator: "AND" as const })),
      ...query.excludeTagIds.map((tagId) => ({ tagId, operator: "NOT" as const }))
    ];

    return {
      platform: Platform.BILIBILI,
      collectionType: query.collectionType,
      collectionIds: this.getSelectedCollectionIds(query.collectionType, query.selectedCollectionId),
      keyword: titleTerms.join(" "),
      creatorKeyword: creatorTerms.join(" "),
      tagExpressions: tagExpressions.length > 0 ? tagExpressions : undefined
    };
  }

  private getSelectedCollectionIds(
    collectionType: CollectionType,
    selectedCollectionId: FavoritesCollectionSelection
  ): ID[] {
    const collections = this.getCollections(collectionType);
    if (selectedCollectionId === "all") {
      return collections.map(collection => collection.collectionId);
    }

    return collections.some(collection => collection.collectionId === selectedCollectionId)
      ? [selectedCollectionId]
      : [];
  }

  private toVideoListItem(entry: FavoriteVideoEntry): FavoriteVideoListItem {
    return {
      videoId: entry.videoId,
      creatorId: entry.creatorId,
      creatorName: entry.creatorName,
      title: entry.title,
      description: entry.description,
      duration: entry.duration,
      publishTime: entry.publishTime,
      bv: entry.bv,
      coverUrl: entry.coverUrl,
      tagIds: [...entry.tags],
      tags: entry.tags.map((tagId, index) => ({
        tagId,
        name: entry.tagNames[index] ?? `Tag ${tagId}`,
        count: 0
      })),
      collections: entry.collectionIds.map((collectionId, index) => ({
        collectionId,
        name: entry.collectionNames[index] ?? `收藏夹 ${collectionId}`,
        type: entry.collectionTypes[index] ?? "user",
        videoCount: 0,
        validVideoCount: 0,
        invalidVideoCount: 0
      })),
      addedAt: entry.addedAt
    };
  }
}
