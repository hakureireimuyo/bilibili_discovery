import type { Tag } from "../../database/types/semantic.js";
import type { RenderListConfig } from "../../renderer/types.js";
import { RenderList } from "../../renderer/RenderList.js";
import { RenderBook } from "../../renderer/RenderBook.js";
import { renderPaginationControls } from "../shared/index.js";

interface TagListRenderConfig {
  container: HTMLElement;
  renderBook: RenderBook<Tag, HTMLElement>;
  autoRender?: boolean;
}

export class TagListRender extends RenderList<Tag, HTMLElement> {
  private renderBookInstance: RenderBook<Tag, HTMLElement>;

  constructor(config: TagListRenderConfig) {
    const renderListConfig: RenderListConfig<Tag, HTMLElement> = {
      renderBook: config.renderBook,
      container: config.container,
      autoRender: config.autoRender ?? false
    };

    super(renderListConfig);
    this.renderBookInstance = config.renderBook;
  }

  async initialize(page: number = 0): Promise<void> {
    this.autoRender = true;
    this.currentPage = page;
    await this.renderPage(page);
  }

  setTargetPage(page: number): void {
    this.currentPage = Math.max(0, page);
  }

  protected renderElements(elements: HTMLElement[]): void {
    this.container.innerHTML = "";
    elements.forEach(element => {
      this.container.appendChild(element);
    });

    // 在下次绘制后计算并添加占位块，填充最后一行空隙
    requestAnimationFrame(() => {
      this.addWallFillers();
    });

    this.renderPagination();
  }

  /**
   * 向标签墙末尾添加不可见占位块，使最后一行视觉上填充完整
   */
  private addWallFillers(): void {
    const wall = this.container;
    const items = wall.querySelectorAll<HTMLElement>('.tag-pill');
    if (items.length === 0) return;

    const containerRect = wall.getBoundingClientRect();
    const computedStyle = getComputedStyle(wall);
    const padLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const padRight = parseFloat(computedStyle.paddingRight) || 0;
    const containerWidth = containerRect.width - padLeft - padRight;
    const gap = 6; // 与 CSS gap 保持一致

    // 获取最后一个标签的行位置
    const lastItem = items[items.length - 1];
    const lastItemRect = lastItem.getBoundingClientRect();
    const lastRowTop = lastItemRect.top - containerRect.top;

    // 计算最后一行的总宽度
    let lastRowWidth = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const itemRect = items[i].getBoundingClientRect();
      const itemTop = itemRect.top - containerRect.top;
      if (Math.abs(itemTop - lastRowTop) < 5) {
        lastRowWidth += itemRect.width + gap;
      } else {
        break;
      }
    }
    lastRowWidth -= gap; // 去掉末尾多余 gap

    // 计算剩余空间，填充占位块
    const remaining = Math.max(0, containerWidth - lastRowWidth);
    if (remaining > 16) {
      const tagHeight = lastItemRect.height;
      // 每个占位块约 6 个字符宽（~50-60px），最多填 4 个
      const fillerUnit = 56;
      const count = Math.min(Math.ceil(remaining / fillerUnit), 4);
      for (let i = 0; i < count; i++) {
        const filler = document.createElement('div');
        filler.className = 'tag-wall-filler';
        const w = i < count - 1 ? fillerUnit : remaining - i * fillerUnit;
        filler.style.width = `${Math.floor(w)}px`;
        filler.style.height = `${tagHeight}px`;
        wall.appendChild(filler);
      }
    }
  }

  protected async deleteElement(element: HTMLElement, data: Tag): Promise<void> {
    console.log("[TagListRender] deleteElement 被调用，但标签列表不需要删除功能", {
      element,
      data
    });
  }

  private renderPagination(): void {
    const paginationContainer = document.getElementById("tag-pagination");
    if (!paginationContainer) {
      return;
    }

    renderPaginationControls(
      paginationContainer,
      {
        currentPage: this.getCurrentPage(),
        totalPages: this.getTotalPages()
      },
      {
        onPrev: async () => this.previousPage(),
        onNext: async () => this.nextPage()
      }
    );
  }

  destroy(): void {
    this.renderBookInstance.destroy();
    super.destroy();
  }
}
