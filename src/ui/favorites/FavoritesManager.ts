import { getDragContext } from "../../utils/drag-utils.js";
import { bindThemeTagColorRefresh } from "../../utils/tag-utils.js";
import { buildSearchUrl } from "../../utils/url-builder.js";
import { bindDebouncedTextInput, bindDropZone, createDraggableTagPill, createFilterChip, renderEmptyState } from "../shared/index.js";
import { createInitialFavoritesState } from "./helpers.js";
import { FavoritesDataService } from "./services.js";
import type { FavoriteCollectionSummary, FavoriteTagSummary, FavoritesPageState } from "./types.js";
import { initThemedPage } from "../../themes/index.js";
import { FavoriteListElementBuilder } from "./FavoriteListElementBuilder.js";
import { FavoriteListRender } from "./FavoriteListRender.js";

export class FavoritesManager {
  private readonly dataService = new FavoritesDataService();
  private readonly state: FavoritesPageState = createInitialFavoritesState();
  private readonly cleanupFns: Array<() => void> = [];
  private favoriteListRender: FavoriteListRender | null = null;
  private static readonly DEBUG = false;

  async init(): Promise<void> {
    if (typeof document === "undefined") {
      return;
    }

    initThemedPage("favorites");
    this.state.loading = true;
    this.renderStatus();

    try {
      await this.dataService.init();
      this.bindEvents();
      this.cleanupFns.push(bindThemeTagColorRefresh());
      this.state.loading = false;
      await this.renderAll();
    } catch (error) {
      console.error("[FavoritesManager] 初始化失败:", error);
      this.state.loading = false;
      this.state.error = error instanceof Error ? error.message : "加载收藏页面失败";
      this.renderStatus();
    }
  }

  private bindEvents(): void {
    this.cleanupFns.push(bindDebouncedTextInput("searchInput", (keyword) => {
      this.applyKeywordSearch(keyword);
    }));

    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
    if (searchInput) {
      const commitSearch = () => {
        this.applyKeywordSearch(searchInput.value.trim());
      };

      const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
          commitSearch();
        }
      };

      const handleChange = () => {
        commitSearch();
      };

      searchInput.addEventListener("keydown", handleKeydown);
      searchInput.addEventListener("change", handleChange);
      this.cleanupFns.push(() => {
        searchInput.removeEventListener("keydown", handleKeydown);
        searchInput.removeEventListener("change", handleChange);
      });
    }

    this.cleanupFns.push(bindDebouncedTextInput("tagSearchInput", (keyword) => {
      this.state.tagKeyword = keyword;
      void this.renderTagList();
    }));

    document.getElementById("type-user")?.addEventListener("click", () => {
      if (FavoritesManager.DEBUG) {
        console.log("[FavoritesManager] type switched:", { nextType: "user" });
      }
      this.setCollectionType("user");
    });

    document.getElementById("type-subscription")?.addEventListener("click", () => {
      if (FavoritesManager.DEBUG) {
        console.log("[FavoritesManager] type switched:", { nextType: "subscription" });
      }
      this.setCollectionType("subscription");
    });

    const includeZone = document.getElementById("filter-include-tags");
    if (includeZone) {
      this.cleanupFns.push(bindDropZone({
        zone: includeZone,
        dropEffect: "copy",
        onDrop: (context) => {
          if (!context.tagId) {
            return;
          }
          if (FavoritesManager.DEBUG) {
            console.log("[FavoritesManager] include tag dropped:", context);
          }
          this.addIncludeTag(context.tagId);
        }
      }));
    }

    const excludeZone = document.getElementById("filter-exclude-tags");
    if (excludeZone) {
      this.cleanupFns.push(bindDropZone({
        zone: excludeZone,
        dropEffect: "copy",
        onDrop: (context) => {
          if (!context.tagId) {
            return;
          }
          if (FavoritesManager.DEBUG) {
            console.log("[FavoritesManager] exclude tag dropped:", context);
          }
          this.addExcludeTag(context.tagId);
        }
      }));
    }
  }

  private async renderAll(): Promise<void> {
    this.renderStatus();
    await Promise.all([
      this.renderCollections(),
      this.renderFilterTags(),
      this.renderTagList(),
      this.renderVideos()
    ]);
  }

  private renderStatus(): void {
    const loading = document.getElementById("loading");
    const error = document.getElementById("error");
    const empty = document.getElementById("empty");
    const errorMessage = document.getElementById("errorMessage");

    if (loading) {
      loading.style.display = this.state.loading ? "flex" : "none";
    }
    if (error) {
      error.style.display = this.state.error ? "flex" : "none";
    }
    if (empty && this.state.loading) {
      empty.style.display = "none";
    }
    if (errorMessage) {
      errorMessage.textContent = this.state.error ?? "";
    }

    this.renderTypeSwitch();
  }

  private renderTypeSwitch(): void {
    document.getElementById("type-user")?.classList.toggle("active", this.state.collectionType === "user");
    document.getElementById("type-subscription")?.classList.toggle("active", this.state.collectionType === "subscription");
  }

  private renderCollectionSelection(): void {
    const tabs = document.querySelectorAll<HTMLButtonElement>("#collectionTabs .collection-tab");
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.selection === String(this.state.selectedCollectionId));
    });
  }

  private async renderCollections(): Promise<void> {
    const container = document.getElementById("collectionTabs");
    if (!container) {
      return;
    }

    const collections = this.dataService.getCollections(this.state.collectionType);
    container.innerHTML = "";

    container.appendChild(this.createCollectionTab({
      collectionId: -1,
      name: "全部收藏夹",
      type: this.state.collectionType,
      videoCount: collections.reduce((sum, item) => sum + item.videoCount, 0),
      validVideoCount: collections.reduce((sum, item) => sum + item.validVideoCount, 0),
      invalidVideoCount: collections.reduce((sum, item) => sum + item.invalidVideoCount, 0)
    }, "all"));

    if (collections.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-collections";
      empty.textContent = "当前类型下没有收藏夹";
      container.appendChild(empty);
      return;
    }

    collections.forEach((collection) => {
      container.appendChild(this.createCollectionTab(collection, collection.collectionId));
    });
  }

  private createCollectionTab(collection: FavoriteCollectionSummary, selection: number | "all"): HTMLElement {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `collection-tab${this.state.selectedCollectionId === selection ? " active" : ""}`;
    tab.dataset.selection = String(selection);
    tab.textContent = `${collection.name} (${collection.validVideoCount}|${collection.invalidVideoCount})`;
    tab.title = collection.description || collection.name;
    tab.addEventListener("click", () => {
      if (FavoritesManager.DEBUG) {
        console.log("[FavoritesManager] collection changed:", {
          previousSelection: this.state.selectedCollectionId,
          nextSelection: selection
        });
      }
      if (this.state.selectedCollectionId === selection) {
        return;
      }
      this.state.selectedCollectionId = selection;
      this.state.currentPage = 0;
      this.renderCollectionSelection();
      void Promise.all([
        this.renderTagList(),
        this.renderVideos()
      ]);
    });
    return tab;
  }

  private async renderTagList(): Promise<void> {
    const container = document.getElementById("tag-list");
    if (!container) {
      return;
    }

    const tags = await this.dataService.getTagSummaries(
      this.state.collectionType,
      this.state.selectedCollectionId,
      this.state.tagKeyword
    );

    container.innerHTML = "";
    if (tags.length === 0) {
      renderEmptyState(container, "没有匹配的标签");
      return;
    }

    tags.forEach((tag) => {
      const item = document.createElement("div");
      item.className = "list-item";

      const pill = createDraggableTagPill({
        text: tag.name,
        tagName: tag.name,
        className: "tag-pill",
        createDragContext: () => ({
          tagId: tag.tagId,
          tagName: tag.name,
          dropped: false,
          isFilterTag: false
        }),
        onClick: (event) => {
          event.stopPropagation();
          window.open(buildSearchUrl(tag.name), "_blank", "noopener,noreferrer");
        }
      });

      const meta = document.createElement("span");
      meta.className = "tag-count";
      meta.textContent = `${tag.count} 个视频`;

      item.appendChild(pill);
      item.appendChild(meta);
      container.appendChild(item);
    });
  }

  private async renderFilterTags(): Promise<void> {
    const includeContainer = document.getElementById("filter-include-tags");
    const excludeContainer = document.getElementById("filter-exclude-tags");
    if (!includeContainer || !excludeContainer) {
      return;
    }

    includeContainer.innerHTML = "";
    excludeContainer.innerHTML = "";

    const activeTagIds = [...this.state.includeTagIds, ...this.state.excludeTagIds];
    const tagMap = await this.dataService.getTagsByIds(activeTagIds);
    if (FavoritesManager.DEBUG) {
      console.log("[FavoritesManager] renderFilterTags active tags:", {
        includeTagIds: [...this.state.includeTagIds],
        excludeTagIds: [...this.state.excludeTagIds],
        resolvedTagIds: [...tagMap.keys()]
      });
    }

    this.state.includeTagIds.forEach((tagId) => {
      const tag = tagMap.get(tagId);
      if (tag) {
        includeContainer.appendChild(this.createFilterTag(tag, "include"));
      }
    });

    this.state.excludeTagIds.forEach((tagId) => {
      const tag = tagMap.get(tagId);
      if (tag) {
        excludeContainer.appendChild(this.createFilterTag(tag, "exclude"));
      }
    });
  }

  private createFilterTag(tag: FavoriteTagSummary, variant: "include" | "exclude"): HTMLElement {
    return createFilterChip({
      label: tag.name,
      colorTag: tag.name,
      variant,
      className: `video-tag filter-tag filter-tag-${variant}`,
      createDragContext: () => ({
        tagId: tag.tagId,
        tagName: tag.name,
        dropped: false,
        isFilterTag: true
      }),
      onDragStart: (_, element) => {
        element.style.opacity = "0.5";
      },
      onDragEnd: (_, element) => {
        const context = getDragContext();
        if (context && !context.dropped && context.isFilterTag) {
          element.remove();
          this.removeFilterTag(tag.tagId, variant);
        }
        element.style.opacity = "1";
      },
      showRemoveButton: false,
      onRemove: () => {
        this.removeFilterTag(tag.tagId, variant);
      }
    });
  }

  private async renderVideos(): Promise<void> {
    const list = document.getElementById("videoList");
    const empty = document.getElementById("empty");
    const loading = document.getElementById("loading");
    if (!list || !empty) {
      console.warn("[FavoritesManager] renderVideos skipped because required nodes are missing", {
        hasList: Boolean(list),
        hasEmpty: Boolean(empty)
      });
      return;
    }

    if (this.state.error) {
      return;
    }

    const query = {
      collectionType: this.state.collectionType,
      selectedCollectionId: this.state.selectedCollectionId,
      keyword: this.state.searchKeyword,
      includeTagIds: this.state.includeTagIds,
      excludeTagIds: this.state.excludeTagIds,
      page: this.state.currentPage,
      pageSize: this.state.pageSize
    };
    if (FavoritesManager.DEBUG) {
      console.log("[FavoritesManager] renderVideos query:", query);
    }
    loading?.style.setProperty("display", "none");

    const renderBook = await this.dataService.getRenderBook(query, new FavoriteListElementBuilder());
    const total = renderBook.state.totalRecords;
    const totalPages = Math.max(1, renderBook.state.totalPages || 1);
    const safePage = renderBook.state.totalPages === 0
      ? 0
      : Math.min(this.state.currentPage, renderBook.state.totalPages - 1);
    this.state.currentPage = safePage;
    if (FavoritesManager.DEBUG) {
      console.log("[FavoritesManager] renderVideos renderBook state:", {
        currentPage: safePage,
        total,
        totalPages
      });
    }

    if (total === 0) {
      list.innerHTML = "";
      empty.style.display = "flex";
      const pagination = document.getElementById("pagination");
      if (pagination) {
        pagination.style.display = "none";
      }
    } else {
      empty.style.display = "none";
      if (!this.favoriteListRender) {
        this.favoriteListRender = new FavoriteListRender({
          container: list,
          renderBook,
          autoRender: false,
          onPageChange: (page) => {
            this.state.currentPage = page;
            if (FavoritesManager.DEBUG) {
              console.log("[FavoritesManager] page changed:", { page });
            }
          }
        });
        await this.favoriteListRender.initialize(safePage);
      } else {
        await this.favoriteListRender.renderPage(safePage, { pageSize: this.state.pageSize });
      }
    }
  }

  private setCollectionType(type: "user" | "subscription"): void {
    if (this.state.collectionType === type) {
      return;
    }

    this.state.collectionType = type;
    this.state.selectedCollectionId = "all";
    this.state.currentPage = 0;
    this.renderTypeSwitch();
    void Promise.all([
      this.renderCollections(),
      this.renderTagList(),
      this.renderVideos()
    ]);
  }

  private applyKeywordSearch(keyword: string): void {
    if (FavoritesManager.DEBUG) {
      console.log("[FavoritesManager] applyKeywordSearch:", {
        previousKeyword: this.state.searchKeyword,
        nextKeyword: keyword
      });
    }
    this.state.searchKeyword = keyword;
    this.state.currentPage = 0;
    void this.renderVideos();
  }

  private addIncludeTag(tagId: number): void {
    if (FavoritesManager.DEBUG) {
      console.log("[FavoritesManager] addIncludeTag:", { tagId });
    }
    if (!this.state.includeTagIds.includes(tagId)) {
      this.state.includeTagIds.push(tagId);
    }
    this.state.excludeTagIds = this.state.excludeTagIds.filter(id => id !== tagId);
    this.state.currentPage = 0;
    void this.renderFilterTags();
    void this.renderVideos();
  }

  private addExcludeTag(tagId: number): void {
    if (FavoritesManager.DEBUG) {
      console.log("[FavoritesManager] addExcludeTag:", { tagId });
    }
    if (!this.state.excludeTagIds.includes(tagId)) {
      this.state.excludeTagIds.push(tagId);
    }
    this.state.includeTagIds = this.state.includeTagIds.filter(id => id !== tagId);
    this.state.currentPage = 0;
    void this.renderFilterTags();
    void this.renderVideos();
  }

  private removeFilterTag(tagId: number, variant: "include" | "exclude"): void {
    if (variant === "include") {
      this.state.includeTagIds = this.state.includeTagIds.filter(id => id !== tagId);
    } else {
      this.state.excludeTagIds = this.state.excludeTagIds.filter(id => id !== tagId);
    }
    this.state.currentPage = 0;
    void this.renderFilterTags();
    void this.renderVideos();
  }

  dispose(): void {
    this.cleanupFns.forEach(cleanup => cleanup());
    this.cleanupFns.length = 0;
  }
}

let favoritesManager: FavoritesManager | null = null;

export function getFavoritesManager(): FavoritesManager {
  if (!favoritesManager) {
    favoritesManager = new FavoritesManager();
  }
  return favoritesManager;
}
