import { bindThemeTagColorRefresh } from "../../utils/tag-utils.js";
import { bindDebouncedTextInput, bindDropZone, createFilterChip, createDraggableTagPill, renderEmptyState } from "../shared/index.js";
import { initThemedPage } from "../../themes/index.js";
import { WatchHistoryListElementBuilder } from "./WatchHistoryListElementBuilder.js";
import { WatchHistoryListRender } from "./WatchHistoryListRender.js";
import { createInitialWatchHistoryState, clampProgressInput, formatDuration, parseDateInput, parseOptionalNumber } from "./helpers.js";
import { WatchHistoryDataService } from "./services.js";
import type { WatchHistoryPageState, WatchHistoryQuery, WatchHistorySummary, WatchHistoryTagSummary } from "./types.js";

export class WatchHistoryManager {
  private readonly dataService = new WatchHistoryDataService();
  private readonly state: WatchHistoryPageState = createInitialWatchHistoryState();
  private readonly cleanupFns: Array<() => void> = [];
  private listRender: WatchHistoryListRender | null = null;

  async init(): Promise<void> {
    if (typeof document === "undefined") {
      return;
    }

    initThemedPage("watch-history");
    this.state.loading = true;
    this.renderStatus();

    try {
      await this.dataService.init();
      this.bindEvents();
      this.bindDropZones();
      this.cleanupFns.push(bindThemeTagColorRefresh());
      this.state.loading = false;
      await this.renderAll();
    } catch (error) {
      console.error("[WatchHistoryManager] 初始化失败:", error);
      this.state.loading = false;
      this.state.error = error instanceof Error ? error.message : "加载观看历史页面失败";
      this.renderStatus();
    }
  }

  private bindEvents(): void {
    this.cleanupFns.push(bindDebouncedTextInput("searchInput", (keyword) => {
      if (keyword.startsWith("@")) {
        this.state.creatorKeyword = keyword.slice(1);
        this.state.keyword = "";
      } else {
        this.state.keyword = keyword;
        this.state.creatorKeyword = "";
      }
      this.state.currentPage = 0;
      void this.renderResults();
    }));

    this.cleanupFns.push(bindDebouncedTextInput("tagSearchInput", (keyword) => {
      this.state.tagKeyword = keyword;
      void this.renderTagList();
    }));

    const bindInput = (id: string, setter: (value: string) => void) => {
      const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (!element) {
        return;
      }

      const handler = () => {
        setter(element.value);
        this.state.currentPage = 0;
        void this.renderResults();
      };

      element.addEventListener("change", handler);
      this.cleanupFns.push(() => element.removeEventListener("change", handler));
    };

    [
      "durationMin",
      "durationMax",
      "watchDurationMin",
      "watchDurationMax",
      "progressMin",
      "progressMax",
      "publishDateStart",
      "publishDateEnd",
      "watchDateStart",
      "watchDateEnd"
    ].forEach((id) => {
      bindInput(id, (value) => {
        this.updateStringField(id, value);
      });
    });

    bindInput("completeFilter", (value) => {
      this.state.completeFilter = value as WatchHistoryPageState["completeFilter"];
    });
    bindInput("rewatchFilter", (value) => {
      this.state.rewatchFilter = value as WatchHistoryPageState["rewatchFilter"];
    });
    bindInput("sortBy", (value) => {
      this.state.sortBy = value as WatchHistoryPageState["sortBy"];
    });
    bindInput("sortOrder", (value) => {
      this.state.sortOrder = value as WatchHistoryPageState["sortOrder"];
    });

    const includeInvalid = document.getElementById("includeInvalid") as HTMLInputElement | null;
    if (includeInvalid) {
      const handler = () => {
        this.state.includeInvalid = includeInvalid.checked;
        this.state.currentPage = 0;
        void this.renderResults();
      };
      includeInvalid.addEventListener("change", handler);
      this.cleanupFns.push(() => includeInvalid.removeEventListener("change", handler));
    }

    const resetButton = document.getElementById("resetFilters");
    if (resetButton) {
      const handler = () => {
        this.resetFilters();
      };
      resetButton.addEventListener("click", handler);
      this.cleanupFns.push(() => resetButton.removeEventListener("click", handler));
    }

    const filterToggle = document.getElementById("filterToggle");
    const filterDrawer = document.getElementById("filterDrawer");
    if (filterToggle && filterDrawer) {
      const openDrawer = () => {
        filterDrawer.classList.add("open");
        filterToggle.classList.add("active");
      };
      const closeDrawer = () => {
        filterDrawer.classList.remove("open");
        filterToggle.classList.remove("active");
      };
      const toggleHandler = () => {
        if (filterDrawer.classList.contains("open")) {
          closeDrawer();
        } else {
          openDrawer();
        }
      };
      filterToggle.addEventListener("click", toggleHandler);
      this.cleanupFns.push(() => filterToggle.removeEventListener("click", toggleHandler));

      // Click outside the drawer panel closes it
      const outsideHandler = (event: MouseEvent) => {
        if (!filterDrawer.classList.contains("open")) {
          return;
        }
        const target = event.target as Node;
        const panel = filterDrawer.querySelector(".history-sidebar-filters");
        if (panel && !panel.contains(target) && !filterToggle.contains(target)) {
          closeDrawer();
        }
      };
      document.addEventListener("click", outsideHandler);
      this.cleanupFns.push(() => document.removeEventListener("click", outsideHandler));
    }
  }

  private bindDropZones(): void {
    const includeZone = document.getElementById("includeTags");
    if (includeZone) {
      this.cleanupFns.push(bindDropZone({
        zone: includeZone,
        accept: (context) => typeof context.tagId === "number",
        onDrop: async (context) => {
          if (typeof context.tagId !== "number") {
            return;
          }
          this.addIncludeTag(context.tagId);
        }
      }));
    }

    const excludeZone = document.getElementById("excludeTags");
    if (excludeZone) {
      this.cleanupFns.push(bindDropZone({
        zone: excludeZone,
        accept: (context) => typeof context.tagId === "number",
        onDrop: async (context) => {
          if (typeof context.tagId !== "number") {
            return;
          }
          this.addExcludeTag(context.tagId);
        }
      }));
    }
  }

  private async renderAll(): Promise<void> {
    this.renderStatus();
    await Promise.all([
      this.renderTagList(),
      this.renderFilterTags(),
      this.renderResults()
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
  }

  private async renderTagList(): Promise<void> {
    const container = document.getElementById("tagList");
    if (!container) {
      return;
    }

    const tags = (await this.dataService.getTagSummaries(this.state.tagKeyword)).slice(0, 30);
    container.innerHTML = "";
    if (tags.length === 0) {
      renderEmptyState(container, "没有匹配的标签");
      return;
    }

    tags.forEach((tag) => {
      container.appendChild(this.createTagListItem(tag));
    });
  }

  private createTagListItem(tag: WatchHistoryTagSummary): HTMLElement {
    return createDraggableTagPill({
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
      }
    });
  }

  private async renderFilterTags(): Promise<void> {
    const includeContainer = document.getElementById("includeTags");
    const excludeContainer = document.getElementById("excludeTags");
    if (!includeContainer || !excludeContainer) {
      return;
    }

    includeContainer.innerHTML = "";
    excludeContainer.innerHTML = "";

    const tags = await this.dataService.getTagsByIds([
      ...this.state.includeTagIds,
      ...this.state.excludeTagIds
    ]);

    this.state.includeTagIds.forEach((tagId) => {
      const tag = tags.get(tagId);
      if (!tag) {
        return;
      }
      includeContainer.appendChild(createFilterChip({
        label: tag.name,
        colorTag: tag.name,
        variant: "include",
        className: "history-filter-tag history-filter-tag-include",
        draggable: true,
        dragEffect: "move",
        createDragContext: () => ({
          tagId,
          tagName: tag.name,
          dropped: false,
          isFilterTag: true
        }),
        onRemove: () => {
          this.removeTag(tagId, "include");
        }
      }));
    });

    this.state.excludeTagIds.forEach((tagId) => {
      const tag = tags.get(tagId);
      if (!tag) {
        return;
      }
      excludeContainer.appendChild(createFilterChip({
        label: tag.name,
        colorTag: tag.name,
        variant: "exclude",
        className: "history-filter-tag history-filter-tag-exclude",
        draggable: true,
        dragEffect: "move",
        createDragContext: () => ({
          tagId,
          tagName: tag.name,
          dropped: false,
          isFilterTag: true
        }),
        onRemove: () => {
          this.removeTag(tagId, "exclude");
        }
      }));
    });
  }

  private async renderResults(): Promise<void> {
    const query = this.buildQuery();
    const list = document.getElementById("historyList");
    const empty = document.getElementById("empty");
    const loading = document.getElementById("loading");
    if (!list || !empty) {
      return;
    }

    if (this.state.error) {
      return;
    }

    loading?.style.setProperty("display", "none");

    const [summary, renderBook] = await Promise.all([
      this.dataService.getSummary(query),
      this.dataService.getRenderBook(query, new WatchHistoryListElementBuilder())
    ]);

    this.renderSummary(summary);

    const total = renderBook.state.totalRecords;
    const totalPages = Math.max(1, renderBook.state.totalPages || 1);
    const safePage = renderBook.state.totalPages === 0
      ? 0
      : Math.min(this.state.currentPage, renderBook.state.totalPages - 1);
    this.state.currentPage = safePage;

    if (total === 0) {
      list.innerHTML = "";
      empty.style.display = "flex";
      const pagination = document.getElementById("pagination");
      if (pagination) {
        pagination.style.display = "none";
      }
      const totalElement = document.getElementById("resultCount");
      if (totalElement) {
        totalElement.textContent = "0 条结果";
      }
      return;
    }

    empty.style.display = "none";
    if (!this.listRender) {
      this.listRender = new WatchHistoryListRender({
        container: list,
        renderBook,
        autoRender: false,
        onPageChange: (page) => {
          this.state.currentPage = page;
        }
      });
      await this.listRender.initialize(safePage);
    } else {
      await renderBook.updateIndex(this.dataService.toQueryCondition(query));
      await this.listRender.renderPage(safePage, { pageSize: this.state.pageSize });
    }

    const totalElement = document.getElementById("resultCount");
    if (totalElement) {
      totalElement.textContent = `${summary.totalResults} 条结果 · ${totalPages} 页`;
    }
  }

  private renderSummary(summary: WatchHistorySummary): void {
    const mappings: Array<[string, string]> = [
      ["summaryTotal", `${summary.totalResults}`],
      ["summaryDuration", formatDuration(summary.totalWatchDuration)],
      ["summaryComplete", `${summary.completeCount}`],
      ["summaryRewatch", `${summary.rewatchedCount}`],
      ["summaryProgress", `${Math.round(summary.averageProgress * 100)}%`]
    ];

    mappings.forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  private buildQuery(): WatchHistoryQuery {
    const isComplete = this.state.completeFilter === "all"
      ? undefined
      : this.state.completeFilter === "complete" ? 1 : 0;

    const query: WatchHistoryQuery = {
      keyword: this.state.keyword,
      creatorKeyword: this.state.creatorKeyword,
      includeTagIds: [...this.state.includeTagIds],
      excludeTagIds: [...this.state.excludeTagIds],
      durationRange: {
        min: parseOptionalNumber(this.state.durationMin),
        max: parseOptionalNumber(this.state.durationMax)
      },
      publishTimeRange: {
        min: parseDateInput(this.state.publishDateStart),
        max: parseDateInput(this.state.publishDateEnd, true)
      },
      watchTimeRange: {
        min: parseDateInput(this.state.watchDateStart),
        max: parseDateInput(this.state.watchDateEnd, true)
      },
      endTimeRange: {
        min: parseDateInput(this.state.watchDateStart),
        max: parseDateInput(this.state.watchDateEnd, true)
      },
      watchDurationRange: {
        min: parseOptionalNumber(this.state.watchDurationMin),
        max: parseOptionalNumber(this.state.watchDurationMax)
      },
      progressRange: {
        min: clampProgressInput(this.state.progressMin),
        max: clampProgressInput(this.state.progressMax)
      },
      isComplete,
      onlyRewatched: this.state.rewatchFilter === "rewatched" ? true : undefined,
      includeInvalid: this.state.includeInvalid,
      sortBy: this.state.sortBy,
      sortOrder: this.state.sortOrder,
      page: this.state.currentPage,
      pageSize: this.state.pageSize
    };

    if (this.state.rewatchFilter === "single") {
      query.progressRange = {
        min: undefined,
        max: 1
      };
    }

    return query;
  }

  private addIncludeTag(tagId: number): void {
    if (!this.state.includeTagIds.includes(tagId)) {
      this.state.includeTagIds.push(tagId);
    }
    this.state.excludeTagIds = this.state.excludeTagIds.filter((id) => id !== tagId);
    this.state.currentPage = 0;
    void this.renderFilterTags();
    void this.renderResults();
  }

  private addExcludeTag(tagId: number): void {
    if (!this.state.excludeTagIds.includes(tagId)) {
      this.state.excludeTagIds.push(tagId);
    }
    this.state.includeTagIds = this.state.includeTagIds.filter((id) => id !== tagId);
    this.state.currentPage = 0;
    void this.renderFilterTags();
    void this.renderResults();
  }

  private removeTag(tagId: number, variant: "include" | "exclude"): void {
    if (variant === "include") {
      this.state.includeTagIds = this.state.includeTagIds.filter((id) => id !== tagId);
    } else {
      this.state.excludeTagIds = this.state.excludeTagIds.filter((id) => id !== tagId);
    }
    this.state.currentPage = 0;
    void this.renderFilterTags();
    void this.renderResults();
  }

  private resetFilters(): void {
    const initial = createInitialWatchHistoryState();
    Object.assign(this.state, initial);

    const inputIds = [
      "searchInput",
      "tagSearchInput",
      "durationMin",
      "durationMax",
      "watchDurationMin",
      "watchDurationMax",
      "progressMin",
      "progressMax",
      "publishDateStart",
      "publishDateEnd",
      "watchDateStart",
      "watchDateEnd"
    ];
    inputIds.forEach((id) => {
      const element = document.getElementById(id) as HTMLInputElement | null;
      if (element) {
        element.value = "";
      }
    });

    const selectIds: Array<[string, string]> = [
      ["completeFilter", "all"],
      ["rewatchFilter", "all"],
      ["sortBy", "endTime"],
      ["sortOrder", "desc"]
    ];
    selectIds.forEach(([id, value]) => {
      const element = document.getElementById(id) as HTMLSelectElement | null;
      if (element) {
        element.value = value;
      }
    });

    const includeInvalid = document.getElementById("includeInvalid") as HTMLInputElement | null;
    if (includeInvalid) {
      includeInvalid.checked = false;
    }

    void this.renderFilterTags();
    void this.renderTagList();
    void this.renderResults();
  }

  private updateStringField(id: string, value: string): void {
    switch (id) {
      case "durationMin":
        this.state.durationMin = value;
        break;
      case "durationMax":
        this.state.durationMax = value;
        break;
      case "watchDurationMin":
        this.state.watchDurationMin = value;
        break;
      case "watchDurationMax":
        this.state.watchDurationMax = value;
        break;
      case "progressMin":
        this.state.progressMin = value;
        break;
      case "progressMax":
        this.state.progressMax = value;
        break;
      case "publishDateStart":
        this.state.publishDateStart = value;
        break;
      case "publishDateEnd":
        this.state.publishDateEnd = value;
        break;
      case "watchDateStart":
        this.state.watchDateStart = value;
        break;
      case "watchDateEnd":
        this.state.watchDateEnd = value;
        break;
      default:
        break;
    }
  }
}

let watchHistoryManager: WatchHistoryManager | null = null;

export function getWatchHistoryManager(): WatchHistoryManager {
  if (!watchHistoryManager) {
    watchHistoryManager = new WatchHistoryManager();
  }
  return watchHistoryManager;
}
