
/**
 * 渲染列表类
 * 职责：从渲染书获得网页元素，将元素渲染成列表，提供翻页交互，并管理所有元素
 * 
 * 核心功能：
 * - 绑定唯一一个渲染书
 * - 从渲染书获取网页元素并渲染成列表
 * - 提供翻页交互
 * - 管理所有元素，包括对元素的细微操作
 * - 接收渲染书的更新通知，实现最终的更新
 */

import type { IRenderListUpdateListener, RenderListConfig, IRenderBook } from './types.js';
import type { BookQueryOptions } from '../database/query-server/book/types.js';

export abstract class RenderList<TData, TElement> implements IRenderListUpdateListener {
  protected renderBook: IRenderBook<TData, TElement>;
  protected container: HTMLElement;
  protected autoRender: boolean;
  protected currentElements: TElement[] = [];
  protected currentPage: number = 0;

  constructor(config: RenderListConfig<TData, TElement>) {
    this.renderBook = config.renderBook;
    this.container = config.container;
    this.autoRender = config.autoRender ?? true;

    // 注册为渲染书的更新监听器
    this.renderBook.registerUpdateListener(this);
  }

  /**
   * 处理渲染书更新事件
   * 由渲染书调用，当渲染书更新时通知渲染列表
   */
  onRenderBookUpdate(bookId: number): void {
    // 只处理属于自己的更新事件
    if (bookId !== this.renderBook.bookId) {
      return;
    }

    // 清空当前元素
    this.currentElements = [];

    // 重新渲染当前页
    if (this.autoRender) {
      this.renderCurrentPage();
    }
  }

  /**
   * 渲染当前页
   */
  async renderCurrentPage(): Promise<void> {
    await this.renderPage(this.currentPage);
  }

  /**
   * 渲染指定页
   */
  async renderPage(page: number, options?: BookQueryOptions): Promise<void> {
    const result = await this.renderBook.getPage(page, options);
    this.currentPage = page;
    this.currentElements = result.elements;

    if (this.autoRender) {
      this.renderElements(this.currentElements);
    }
  }

  /**
   * 渲染元素列表
   * 由子类实现具体的渲染逻辑
   */
  protected abstract renderElements(elements: TElement[]): void;

  /**
   * 翻到下一页
   */
  async nextPage(): Promise<void> {
    const totalPages = this.renderBook.state.totalPages;
    if (this.currentPage < totalPages - 1) {
      await this.renderPage(this.currentPage + 1);
    }
  }

  /**
   * 翻到上一页
   */
  async previousPage(): Promise<void> {
    if (this.currentPage > 0) {
      await this.renderPage(this.currentPage - 1);
    }
  }

  /**
   * 翻到指定页
   */
  async goToPage(page: number): Promise<void> {
    const totalPages = this.renderBook.state.totalPages;
    if (page >= 0 && page < totalPages) {
      await this.renderPage(page);
    }
  }

  /**
   * 删除元素
   * 由子类实现具体的删除逻辑
   * @param element - 要删除的元素
   * @param data - 对应的数据对象
   */
  protected abstract deleteElement(element: TElement, data: TData): Promise<void>;

  /**
   * 获取当前元素列表
   */
  getCurrentElements(): TElement[] {
    return [...this.currentElements];
  }

  /**
   * 获取当前页码
   */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * 获取总页数
   */
  getTotalPages(): number {
    return this.renderBook.state.totalPages;
  }

  /**
   * 销毁渲染列表
   * 取消注册监听器，清空容器
   */
  destroy(): void {
    // 取消注册监听器
    this.renderBook.unregisterUpdateListener(this);

    // 清空容器
    this.container.innerHTML = '';

    // 清空当前元素
    this.currentElements = [];
  }
}
