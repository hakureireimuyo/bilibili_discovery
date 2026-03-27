/**
 * 书类
 * 只存储查询返回的索引数据，不存储完整对象
 * 通过Repository获取完整数据
 * 与前端页面数据显示容器绑定生命周期
 */

import type { IDataRepository, IQueryService } from './base-book-manager.js';
import type { QueryCondition } from '../query/types.js';
import type {
  BookPage,
  BookPageState,
  BookQueryOptions,
  BookQueryResult
} from './types.js';

export class Book<T> {
  bookId: number;
  resultIds: number[];
  pages: Map<number, BookPage<T>>;
  state: BookPageState;

  protected repository: IDataRepository<T>;
  protected queryService: IQueryService<any>;
  protected indexUpdateListeners: Set<import('../../../renderer/types.js').IIndexUpdateListener> = new Set();

  constructor(
    bookId: number,
    resultIds: number[],
    repository: IDataRepository<T>,
    queryService: any,
    pageSize: number = 20
  ) {
    this.bookId = bookId;
    this.resultIds = resultIds;
    this.repository = repository;
    this.queryService = queryService;
    this.pages = new Map();
    this.state = {
      currentPage: 0,
      totalPages: Math.ceil(resultIds.length / pageSize),
      pageSize,
      totalRecords: resultIds.length
    };
  }

  /**
   * 获取分页数据
   * 通过Repository获取完整数据
   */
  async getPage(page: number, options: BookQueryOptions = {}): Promise<BookQueryResult<T>> {
    const pageSize = options.pageSize || this.state.pageSize;
    const totalPages = Math.ceil(this.resultIds.length / pageSize);

    // 检查页码是否有效
    if (page < 0 || page >= totalPages) {
      throw new Error(`Invalid page number: ${page}. Total pages: ${totalPages}`);
    }

    // 更新当前页
    this.state.currentPage = page;
    this.state.totalPages = totalPages;
    this.state.pageSize = pageSize;

    // 获取或加载页数据
    let bookPage = this.pages.get(page);
    if (!bookPage || !bookPage.loaded) {
      bookPage = await this.loadPage(page, pageSize);
      this.pages.set(page, bookPage);
    }

    // 预加载下一页
    if (options.preloadNext && page < totalPages - 1) {
      const preloadCount = options.preloadCount || 1;
      for (let i = 1; i <= preloadCount && page + i < totalPages; i++) {
        const nextPage = page + i;
        const nextPageData = this.pages.get(nextPage);
        if (!nextPageData || !nextPageData.loaded) {
          this.loadPage(nextPage, pageSize).then(page => {
            this.pages.set(nextPage, page);
          });
        }
      }
    }

    return {
      items: bookPage.items,
      state: { ...this.state },
      bookId: this.bookId
    };
  }

  /**
   * 更新索引内容
   * 通过QueryService获取新的索引ID列表
   */
  async updateIndex(newCondition: QueryCondition): Promise<void> {
    console.log('[Book] updateIndex called with condition:', newCondition);
    // 通过QueryService获取新的结果ID列表
    const newResultIds = await this.queryService.queryIds(newCondition);
    console.log('[Book] updateIndex result:', {
      resultCount: newResultIds.length,
      bookId: this.bookId
    });

    // 更新书
    this.resultIds = newResultIds;
    this.state.totalRecords = newResultIds.length;
    this.state.totalPages = Math.ceil(newResultIds.length / this.state.pageSize);
    this.state.currentPage = 0;
    this.pages.clear(); // 清空页缓存

    // 通知所有监听器
    this.notifyIndexUpdate(newCondition);
  }

  /**
   * 注册索引更新监听器
   */
  registerIndexUpdateListener(listener: import('../../../renderer/types.js').IIndexUpdateListener): void {
    this.indexUpdateListeners.add(listener);
  }

  /**
   * 取消注册索引更新监听器
   */
  unregisterIndexUpdateListener(listener: import('../../../renderer/types.js').IIndexUpdateListener): void {
    this.indexUpdateListeners.delete(listener);
  }

  /**
   * 通知所有监听器索引已更新
   */
  protected notifyIndexUpdate(condition: QueryCondition): void {
    for (const listener of this.indexUpdateListeners) {
      listener.onIndexUpdate(this.bookId, condition);
    }
  }

  /**
   * 加载页数据
   * 通过Repository获取完整数据
   * Repository内部会处理缓存逻辑
   */
  protected async loadPage(page: number, pageSize: number): Promise<BookPage<T>> {
    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, this.resultIds.length);
    const pageIds = this.resultIds.slice(startIndex, endIndex);

    // 通过Repository获取完整数据
    // Repository内部会先从Cache获取，未命中则从Database获取
    const items = await this.repository.getByIds(pageIds);

    return {
      page,
      items,
      loaded: true,
      loadTime: Date.now()
    };
  }
}
