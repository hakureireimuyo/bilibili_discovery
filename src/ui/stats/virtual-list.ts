interface VirtualListOptions<T> {
  container: HTMLElement;
  itemHeight: number;
  renderItem: (item: T, index: number) => HTMLElement;
  estimatedItemHeight?: number;
  buffer?: number;
}

interface ItemPosition {
  top: number;
  bottom: number;
  height: number;
}

interface VirtualListState<T> {
  items: T[];
  scrollTop: number;
  viewportHeight: number;
  itemPositions: Map<number, ItemPosition>;
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  buffer: number;
  isRendering: boolean;
}

export class VirtualList<T> {
  private state: VirtualListState<T>;
  private options: Required<VirtualListOptions<T>>;
  private contentContainer!: HTMLElement;
  private spacerBefore!: HTMLElement;
  private spacerAfter!: HTMLElement;
  private containerResizeObserver!: ResizeObserver;
  private itemResizeObserver!: ResizeObserver;
  private renderedItems: Map<number, HTMLElement> = new Map();
  private renderRequested: boolean = false;
  private scrollTimer: number | null = null;

  constructor(options: VirtualListOptions<T>) {
    this.options = {
      estimatedItemHeight: options.itemHeight,
      buffer: 5,
      ...options
    };

    this.state = {
      items: [],
      scrollTop: 0,
      viewportHeight: 0,
      itemPositions: new Map(),
      totalHeight: 0,
      startIndex: 0,
      endIndex: 0,
      buffer: this.options.buffer,
      isRendering: false
    };

    this.setupContainer();
    this.setupResizeObservers();
  }

  private setupContainer(): void {
    const { container } = this.options;

    // 清空容器
    container.innerHTML = "";
    container.style.overflow = "auto";
    container.style.position = "relative";
    container.style.height = "100%";

    // 创建内容容器
    this.contentContainer = document.createElement("div");
    this.contentContainer.style.position = "relative";
    this.contentContainer.style.width = "100%";
    this.contentContainer.style.height = "fit-content";
    container.appendChild(this.contentContainer);

    // 创建上下占位元素
    this.spacerBefore = document.createElement("div");
    this.spacerBefore.style.height = "0px";
    this.spacerBefore.style.width = "100%";
    this.spacerBefore.style.position = "absolute";
    this.spacerBefore.style.top = "0";
    this.contentContainer.appendChild(this.spacerBefore);

    this.spacerAfter = document.createElement("div");
    this.spacerAfter.style.height = "0px";
    this.spacerAfter.style.width = "100%";
    this.spacerAfter.style.position = "absolute";
    this.spacerAfter.style.top = "0";
    this.contentContainer.appendChild(this.spacerAfter);

    // 监听滚动事件
    container.addEventListener("scroll", () => this.handleScroll(), { passive: true });
  }

  private setupResizeObservers(): void {
    // 容器尺寸观察器
    this.containerResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.options.container) {
          const newHeight = entry.contentRect.height;
          if (Math.abs(newHeight - this.state.viewportHeight) > 5) {
            this.state.viewportHeight = newHeight;
            this.requestRender();
          }
        }
      }
    });
    this.containerResizeObserver.observe(this.options.container);

    // 单个元素尺寸观察器（共享）
    this.itemResizeObserver = new ResizeObserver((entries) => {
      let needsUpdate = false;
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const index = parseInt(target.dataset.index || "-1");
        if (index >= 0) {
          const height = entry.contentRect.height;
          const oldPosition = this.state.itemPositions.get(index);
          if (oldPosition && Math.abs(height - oldPosition.height) > 1) {
            this.state.itemPositions.set(index, {
              ...oldPosition,
              height,
              bottom: oldPosition.top + height
            });
            needsUpdate = true;
          }
        }
      }
      if (needsUpdate) {
        this.updateTotalHeight();
        this.requestRender();
      }
    });
  }

  private handleScroll(): void {
    const newScrollTop = this.options.container.scrollTop;
    // 使用防抖避免频繁触发
    if (this.scrollTimer !== null) {
      cancelAnimationFrame(this.scrollTimer);
    }
    this.scrollTimer = requestAnimationFrame(() => {
      this.state.scrollTop = newScrollTop;
      this.requestRender();
      this.scrollTimer = null;
    });
  }

  private requestRender(): void {
    if (!this.renderRequested && !this.state.isRendering) {
      this.renderRequested = true;
      requestAnimationFrame(() => {
        this.renderRequested = false;
        void this.updateVisibleRange();
      });
    }
  }

  private updateTotalHeight(): void {
    const { items, itemPositions } = this.state;
    const { estimatedItemHeight } = this.options;

    let totalHeight = 0;
    for (let i = 0; i < items.length; i++) {
      const position = itemPositions.get(i);
      if (position) {
        totalHeight = position.bottom;
      } else {
        totalHeight += estimatedItemHeight;
      }
    }
    this.state.totalHeight = totalHeight;
  }

  private updateVisibleRange(): void {
    const { items, itemPositions, scrollTop, viewportHeight, buffer, isRendering } = this.state;
    const { estimatedItemHeight } = this.options;

    if (items.length === 0 || isRendering) {
      return;
    }

    this.state.isRendering = true;

    try {
      // 确保所有项都有位置信息
      this.ensureItemPositions();

      // 计算可见范围
      const effectiveViewportHeight = viewportHeight > 0 ? viewportHeight : 600;
      const scrollBottom = scrollTop + effectiveViewportHeight;

      // 从当前可见范围开始查找，优化性能
      let startIndex = this.state.startIndex;
      let endIndex = this.state.endIndex;

      // 向上查找起始索引
      while (startIndex > 0 && itemPositions.get(startIndex - 1)!.bottom > scrollTop) {
        startIndex--;
      }
      // 添加缓冲区
      startIndex = Math.max(0, startIndex - buffer);

      // 向下查找结束索引
      while (endIndex < items.length - 1 && itemPositions.get(endIndex + 1)!.top < scrollBottom) {
        endIndex++;
      }
      // 添加缓冲区
      endIndex = Math.min(items.length - 1, endIndex + buffer);

      this.state.startIndex = startIndex;
      this.state.endIndex = endIndex;

      this.render();
    } finally {
      this.state.isRendering = false;
    }
  }

  private ensureItemPositions(): void {
    const { items, itemPositions } = this.state;
    const { estimatedItemHeight } = this.options;

    let currentTop = 0;
    for (let i = 0; i < items.length; i++) {
      const existing = itemPositions.get(i);
      if (existing) {
        currentTop = existing.bottom;
      } else {
        const height = estimatedItemHeight;
        itemPositions.set(i, {
          top: currentTop,
          bottom: currentTop + height,
          height
        });
        currentTop += height;
      }
    }
  }

  private render(): void {
    const { items, startIndex, endIndex, itemPositions } = this.state;
    const { renderItem } = this.options;

    // 计算前后占位高度
    const startPosition = itemPositions.get(startIndex);
    const beforeHeight = startPosition?.top || 0;

    const endPosition = itemPositions.get(endIndex);
    const afterHeight = endPosition
      ? this.state.totalHeight - endPosition.bottom
      : 0;

    this.spacerBefore.style.height = `${beforeHeight}px`;
    this.spacerAfter.style.height = `${afterHeight}px`;

    // 复用可见项
    const newRenderedItems = new Map<number, HTMLElement>();
    for (let i = startIndex; i <= endIndex; i++) {
      if (this.renderedItems.has(i)) {
        newRenderedItems.set(i, this.renderedItems.get(i)!);
        this.renderedItems.delete(i);
      }
    }

    // 移除不再可见的项
    this.renderedItems.forEach((el) => {
      this.itemResizeObserver.unobserve(el);
      el.remove();
    });
    this.renderedItems = newRenderedItems;

    // 渲染新的可见项
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i <= endIndex; i++) {
      if (!this.renderedItems.has(i)) {
        const itemEl = renderItem(items[i], i);
        itemEl.dataset.index = String(i);
        this.itemResizeObserver.observe(itemEl);
        fragment.appendChild(itemEl);
        this.renderedItems.set(i, itemEl);
      }
    }
    this.contentContainer.appendChild(fragment);
  }

  public setItems(items: T[]): void {
    this.state.items = items;
    this.state.itemPositions.clear();
    this.state.scrollTop = 0;
    this.options.container.scrollTop = 0;
    this.state.startIndex = 0;
    this.state.endIndex = 0;
    this.renderedItems.forEach((el) => {
      this.itemResizeObserver.unobserve(el);
      el.remove();
    });
    this.renderedItems.clear();
    this.updateTotalHeight();
    this.requestRender();
  }

  public scrollToIndex(index: number, align: "start" | "center" | "end" = "start"): void {
    const { items, itemPositions, viewportHeight } = this.state;
    const { estimatedItemHeight } = this.options;

    if (index < 0 || index >= items.length) {
      return;
    }

    let offset = 0;
    const position = itemPositions.get(index);

    if (position) {
      switch (align) {
        case "center":
          offset = position.top - viewportHeight / 2 + position.height / 2;
          break;
        case "end":
          offset = position.bottom - viewportHeight;
          break;
        default:
          offset = position.top;
      }
    } else {
      offset = index * estimatedItemHeight;
    }

    this.options.container.scrollTop = Math.max(0, offset);
  }

  public destroy(): void {
    this.containerResizeObserver.disconnect();
    this.itemResizeObserver.disconnect();
    this.renderedItems.forEach((el) => {
      this.itemResizeObserver.unobserve(el);
      el.remove();
    });
    this.renderedItems.clear();
    if (this.scrollTimer !== null) {
      cancelAnimationFrame(this.scrollTimer);
    }
  }
}
