
/**
 * 渲染书类
 * 职责：将书中的数据对象转换为网页元素，并实现分页和缓存功能
 * 
 * 核心功能：
 * - 接收Book实例和元素构建器
 * - 从Book获取数据对象，通过元素构建器转换为网页元素
 * - 实现网页元素的分页显示
 * - 缓存最多三页的网页元素，提高查看流畅度
 * - 只负责交付元素对象，不管理元素对象的生命周期
 */

import type { Book, BookPageState, BookQueryOptions } from '../database/query-server/book/types.js';
import type { QueryCondition } from '../database/query-server/query/types.js';
import type {
  IElementBuilder,
  IIndexUpdateListener,
  IRenderListUpdateListener,
  IRenderBook,
  RenderPage,
  RenderQueryResult,
  RenderBookConfig
} from './types.js';

export class RenderBook<TData, TElement> implements IIndexUpdateListener, IRenderBook<TData, TElement> {
  bookId: number;
  pages: Map<number, RenderPage<TElement>>;

  protected book: Book<TData>;
  protected elementBuilder: IElementBuilder<TData, TElement>;
  protected maxCachePages: number;
  protected updateListeners: Set<IRenderListUpdateListener> = new Set();

  constructor(config: RenderBookConfig<TData, TElement>) {
    this.book = config.book;
    this.bookId = config.book ? config.book.bookId : 0;
    this.elementBuilder = config.elementBuilder;
    this.maxCachePages = config.maxCachePages || 3;

    this.pages = new Map();

    // 自动注册为Book的索引更新监听器
    if (this.book) {
      this.book.registerIndexUpdateListener(this);
    }
  }

  /**
   * 设置Book实例
   * 用于在构造函数之后设置Book实例
   */
  setBook(book: Book<TData>): void {
    // 如果已经有一个book实例，先取消注册监听器
    if (this.book) {
      this.book.unregisterIndexUpdateListener(this);
    }

    this.book = book;
    this.bookId = book.bookId;

    // 注册为Book的索引更新监听器
    this.book.registerIndexUpdateListener(this);

    // 清除所有缓存的渲染页
    this.pages.clear();
  }

  /**
   * 获取Book实例
   */
  getBook(): Book<TData> | null {
    return this.book;
  }

  /**
   * 销毁渲染书
   * 取消注册监听器，清除所有缓存的渲染页
   */
  destroy(): void {
    // 取消注册Book的监听器
    if (this.book) {
      this.book.unregisterIndexUpdateListener(this);
    }

    // 清除所有渲染列表更新监听器
    this.updateListeners.clear();

    // 清除所有缓存的渲染页
    this.pages.clear();
  }

  /**
   * 获取分页状态
   * 直接从Book获取，保持配置同步
   */
  get state(): BookPageState {
    if (!this.book) {
      return { currentPage: 0, totalPages: 0, pageSize: 20, totalRecords: 0 };
    }
    return this.book.state;
  }

  /**
   * 获取渲染页数据
   * 从Book获取数据对象，通过元素构建器转换为网页元素
   */
  async getPage(page: number, options: BookQueryOptions = {}): Promise<RenderQueryResult<TElement>> {
    // 如果book未设置，返回空结果
    if (!this.book) {
      return {
        elements: [],
        state: { currentPage: 0, totalPages: 0, pageSize: 20, totalRecords: 0 },
        bookId: this.bookId
      };
    }

    // 直接转发给Book获取数据
    const bookPage = await this.book.getPage(page, options);

    // 获取或渲染页数据
    let renderPage = this.pages.get(page);
    if (!renderPage || !renderPage.rendered) {
      renderPage = await this.renderPage(page, bookPage.state.pageSize);
      this.pages.set(page, renderPage);
      this.manageCache();
    }

    // 预渲染下一页
    if (options.preloadNext && page < bookPage.state.totalPages - 1) {
      const preloadCount = options.preloadCount || 1;
      for (let i = 1; i <= preloadCount && page + i < bookPage.state.totalPages; i++) {
        const nextPage = page + i;
        const nextPageData = this.pages.get(nextPage);
        if (!nextPageData || !nextPageData.rendered) {
          this.renderPage(nextPage, bookPage.state.pageSize).then(page => {
            this.pages.set(nextPage, page);
            this.manageCache();
          });
        }
      }
    }

    return {
      elements: renderPage.elements,
      state: { ...bookPage.state },
      bookId: this.bookId
    };
  }

  /**
   * 更新索引内容
   * 直接转发给Book，清除所有缓存的渲染页
   */
  async updateIndex(newCondition: QueryCondition): Promise<void> {
    // 如果book未设置，直接返回
    if (!this.book) {
      return;
    }

    // 转发给Book更新索引
    await this.book.updateIndex(newCondition);
  }

  /**
   * 处理索引更新事件
   * 由Book调用，当Book更新索引时通知渲染书
   */
  onIndexUpdate(bookId: number, condition: QueryCondition): void {
    // 只处理属于自己的更新事件
    if (bookId !== this.bookId) {
      return;
    }

    // 清除所有缓存的渲染页
    this.pages.clear();

    // 通知所有渲染列表更新监听器
    this.notifyUpdateListeners();
  }

  /**
   * 注册渲染列表更新监听器
   */
  registerUpdateListener(listener: IRenderListUpdateListener): void {
    this.updateListeners.add(listener);
  }

  /**
   * 取消注册渲染列表更新监听器
   */
  unregisterUpdateListener(listener: IRenderListUpdateListener): void {
    this.updateListeners.delete(listener);
  }

  /**
   * 通知所有渲染列表更新监听器
   */
  protected notifyUpdateListeners(): void {
    for (const listener of this.updateListeners) {
      listener.onRenderBookUpdate(this.bookId);
    }
  }

  /**
   * 渲染页数据
   * 从Book获取数据对象，通过元素构建器转换为网页元素
   */
  protected async renderPage(page: number, pageSize: number): Promise<RenderPage<TElement>> {
    // 从Book获取数据对象
    const bookPage = await this.book.getPage(page, { pageSize });

    // 通过元素构建器转换为网页元素
    const elementsResult = this.elementBuilder.buildElements(bookPage.items);
    const elements = elementsResult instanceof Promise ? await elementsResult : elementsResult;

    return {
      page,
      elements,
      rendered: true,
      renderTime: Date.now()
    };
  }

  /**
   * 管理缓存
   * 确保最多缓存maxCachePages页的网页元素
   * 优先保留当前页及其相邻页
   */
  protected manageCache(): void {
    // 如果book未设置，直接返回
    if (!this.book) {
      return;
    }

    const currentPage = this.book.state.currentPage;
    const totalPages = this.book.state.totalPages;

    // 如果缓存页数不超过最大值，无需清理
    if (this.pages.size <= this.maxCachePages) {
      return;
    }

    // 计算需要保留的页码范围
    const startPage = Math.max(0, currentPage - Math.floor(this.maxCachePages / 2));
    const endPage = Math.min(totalPages - 1, startPage + this.maxCachePages - 1);

    // 删除不在保留范围内的页
    for (const [pageNum, page] of this.pages) {
      if (pageNum < startPage || pageNum > endPage) {
        this.pages.delete(pageNum);
      }
    }
  }
}
