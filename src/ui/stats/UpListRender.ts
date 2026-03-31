
/**
 * UP列表渲染类
 * 职责：从渲染书获得UP主元素，将元素渲染成列表，提供翻页交互，并管理所有元素
 *
 * 核心功能：
 * - 绑定唯一一个渲染书
 * - 从渲染书获取UP主元素并渲染成列表
 * - 提供翻页交互
 * - 管理所有元素，包括对元素的细微操作
 * - 接收渲染书的更新通知，实现最终的更新
 */

import type { Creator } from "../../database/types/index.js";
import type { StatsState } from "./types.js";
import type { ServiceContainer } from "./services.js";
import type { UpListConfig } from "./up-list-types.js";
import type { RenderListConfig, IRenderBook } from "../../renderer/types.js";
import { RenderList } from "../../renderer/RenderList.js";
import { RenderBook } from "../../renderer/RenderBook.js";
import { UpListElementBuilder } from "./UpListElementBuilder.js";
import { bindPaginationElements } from "../shared/index.js";
import { logger } from '../../utils/logger.js';
/**
 * UP列表渲染类
 */
export class UpListRender extends RenderList<Creator, HTMLElement> {
  private services: ServiceContainer;
  private currentState: StatsState | null = null;
  private elementBuilder: UpListElementBuilder;
  private isAnimating = false;
  private renderBookInstance: RenderBook<Creator, HTMLElement>;

  constructor(config: UpListConfig) {
    // 创建渲染列表配置
    const renderListConfig: RenderListConfig<Creator, HTMLElement> = {
      renderBook: config.renderBook,
      container: config.container,
      autoRender: config.autoRender ?? false // 初始时不自动渲染，等到 initialize 后再渲染
    };

    super(renderListConfig);

    this.services = config.services;
    this.renderBookInstance = config.renderBook as RenderBook<Creator, HTMLElement>;

    // 获取元素构建器
    this.elementBuilder = (this.renderBookInstance as any).elementBuilder;
  }

  /**
   * 初始化UP列表
   */
  async initialize(state: StatsState): Promise<void> {
    logger.debug('[UpListRender] 初始化UP列表');
    this.currentState = state;

    // 更新元素构建器的状态
    this.elementBuilder.updateState(state);

    // 启用自动渲染
    this.autoRender = true;

    // 使用services.paginationState.currentPage作为页码
    const targetPage = this.services.paginationState.currentPage;
    logger.debug(`[UpListRender] 初始化渲染页码: ${targetPage}`);
    
    // 渲染指定页
    await this.renderPage(targetPage);

    // 渲染分页控件
    this.renderPagination();
  }

  /**
   * 更新UP列表
   */
  async update(state: StatsState): Promise<void> {
    logger.debug('[UpListRender] 更新UP列表');
    this.currentState = state;

    // 如果正在动画中，忽略此次请求
    if (this.isAnimating) {
      logger.debug('[UpListRender] 动画进行中，忽略此次请求');
      return;
    }

    try {
      // 更新元素构建器的状态
      this.elementBuilder.updateState(state);

      // 使用services.paginationState.currentPage作为页码
      const targetPage = this.services.paginationState.currentPage;
      logger.debug(`[UpListRender] 渲染页码: ${targetPage}`);
      
      // 渲染指定页
      await this.renderPage(targetPage);

      // 渲染分页控件
      this.renderPagination();
    } catch (error) {
      console.error('[UpListRender] 更新UP列表失败:', error);
      this.container.innerHTML = '<div class="error">加载失败</div>';
    }
  }

  /**
   * 处理渲染书更新事件
   */
  async onRenderBookUpdate(bookId: number): Promise<void> {
    // 只处理属于自己的更新事件
    if (bookId !== this.renderBookInstance.bookId) {
      return;
    }

    // 清空当前元素
    this.currentElements = [];

    // 如果有当前状态，重新渲染
    if (this.currentState && this.autoRender) {
      await this.update(this.currentState);
    }
  }

  /**
   * 渲染元素列表
   */
  protected renderElements(elements: HTMLElement[]): void {
    logger.debug(`[UpListRender] 开始渲染 ${elements.length} 个元素`);

    // 使用动画切换页面
    this.animatePageChange(() => {
      this.container.innerHTML = "";
      elements.forEach((el, index) => {
        // 直接使用原始元素,不克隆,以保留事件监听器
        // 添加延迟动画效果,每个元素延迟递增
        el.style.animationDelay = `${index * 0.06}s`;
        this.container.appendChild(el);
      });
    });
  }

  /**
   * 删除元素
   */
  protected async deleteElement(element: HTMLElement, data: Creator): Promise<void> {
    // UP列表不需要删除功能
    logger.debug('[UpListRender] deleteElement 被调用，但UP列表不需要删除功能');
  }

  /**
   * 页面切换动画
   */
  private animatePageChange(changeFn: () => void): void {
    if (this.isAnimating) return;

    this.isAnimating = true;

    // 添加淡出和滑动效果
    this.container.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateY(5px)';

    // 等待淡出完成
    setTimeout(() => {
      // 执行内容更新
      changeFn();

      // 添加淡入和滑动效果
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateY(0)';

      // 等待淡入完成
      setTimeout(() => {
        // 清除transform属性
        this.container.style.transform = '';
        this.isAnimating = false;
      }, 150);
    }, 150);
  }

  /**
   * 渲染分页控件
   */
  private renderPagination(): void {
    const prevBtn = document.getElementById("prev-btn") as HTMLButtonElement;
    const pageInfo = document.getElementById("pagination-info");
    const nextBtn = document.getElementById("next-btn") as HTMLButtonElement;

    if (!prevBtn || !pageInfo || !nextBtn) return;

    const currentPage = this.services.paginationState.currentPage;
    const totalPages = this.services.paginationState.totalPages;

    bindPaginationElements({
      prevButton: prevBtn,
      nextButton: nextBtn,
      infoElement: pageInfo,
      state: {
        currentPage,
        totalPages
      },
      actions: {
        onPrev: async () => {
          this.services.paginationState.currentPage = currentPage - 1;
          this.scrollToTop();
          if (this.currentState) {
            await this.update(this.currentState);
          }
        },
        onNext: async () => {
          this.services.paginationState.currentPage = currentPage + 1;
          this.scrollToTop();
          if (this.currentState) {
            await this.update(this.currentState);
          }
        }
      }
    });
  }

  /**
   * 滚动列表到顶部
   */
  private scrollToTop(): void {
    this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * 销毁UP列表
   */
  destroy(): void {
    // 销毁渲染书实例
    this.renderBookInstance.destroy();

    super.destroy();
    this.currentState = null;
    logger.debug('[UpListRender] UP列表已销毁');
  }
}
