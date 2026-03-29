import type { FavoriteVideoEntry } from "../../database/index.js";
import type { BookQueryOptions } from "../../database/query-server/book/types.js";
import { RenderList } from "../../renderer/RenderList.js";
import { RenderBook } from "../../renderer/RenderBook.js";
import type { RenderListConfig } from "../../renderer/types.js";
import { bindPaginationElements } from "../shared/index.js";
import type { FavoriteListConfig } from "./favorite-list-types.js";

export class FavoriteListRender extends RenderList<FavoriteVideoEntry, HTMLElement> {
  private renderBookInstance: RenderBook<FavoriteVideoEntry, HTMLElement>;
  private readonly onPageChange?: (page: number) => void;

  constructor(config: FavoriteListConfig) {
    const renderListConfig: RenderListConfig<FavoriteVideoEntry, HTMLElement> = {
      renderBook: config.renderBook,
      container: config.container,
      autoRender: config.autoRender ?? false
    };

    super(renderListConfig);
    this.renderBookInstance = config.renderBook as RenderBook<FavoriteVideoEntry, HTMLElement>;
    this.onPageChange = config.onPageChange;
  }

  async initialize(page = 0): Promise<void> {
    this.autoRender = true;
    await this.renderPage(page);
  }

  async renderPage(page: number, options?: BookQueryOptions): Promise<void> {
    await super.renderPage(page, options);
    this.onPageChange?.(this.getCurrentPage());
  }

  protected renderElements(elements: HTMLElement[]): void {
    const existingByVideoId = new Map<string, HTMLElement>();
    Array.from(this.container.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        return;
      }

      const videoId = child.dataset.videoId;
      if (videoId) {
        existingByVideoId.set(videoId, child);
      }
    });

    console.log('[FavoriteListRender] renderElements:', {
      totalElements: elements.length,
      existingElements: existingByVideoId.size
    });

    const fragment = document.createDocumentFragment();
    let reusedCount = 0;
    let newCount = 0;
    elements.forEach((element) => {
      const videoId = element.dataset.videoId;
      const reusable = videoId ? existingByVideoId.get(videoId) : null;
      if (reusable) {
        reusedCount++;
      } else {
        newCount++;
      }
      fragment.appendChild(reusable ?? element);
    });

    console.log('[FavoriteListRender] renderElements result:', {
      reusedCount,
      newCount,
      totalInFragment: fragment.children.length
    });

    this.container.replaceChildren(fragment);
    this.renderPagination();
  }

  protected async deleteElement(_element: HTMLElement, _data: FavoriteVideoEntry): Promise<void> {
    console.log("[FavoriteListRender] deleteElement 被调用，但收藏视频列表不需要删除功能");
  }

  private renderPagination(): void {
    const pagination = document.getElementById("pagination");
    const prev = document.getElementById("prevPage") as HTMLButtonElement | null;
    const next = document.getElementById("nextPage") as HTMLButtonElement | null;
    const info = document.getElementById("pageInfo");
    if (!pagination || !prev || !next || !info) {
      return;
    }

    const totalPages = this.getTotalPages();
    pagination.style.display = totalPages > 1 ? "flex" : "none";

    bindPaginationElements({
      prevButton: prev,
      nextButton: next,
      infoElement: info,
      state: {
        currentPage: this.getCurrentPage(),
        totalPages
      },
      actions: {
        onPrev: async () => this.previousPage(),
        onNext: async () => this.nextPage()
      }
    });
  }

  destroy(): void {
    this.renderBookInstance.destroy();
    super.destroy();
  }
}
