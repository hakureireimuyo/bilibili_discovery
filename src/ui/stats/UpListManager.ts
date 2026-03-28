/**

 */
import type { Creator } from "../../database/types/index.js";
import type { StatsState } from "./types.js";
import type { ServiceContainer } from "./services.js";
import { updateToggleLabel } from "../../utils/dom-utils.js";

/**
 * UP列表管理器
 * 职责：协调UP列表的各个组件，提供统一的接口
 */
import { UpListRender } from "./UpListRender.js";
import { RenderBook } from "../../renderer/RenderBook.js";
import { UpListElementBuilder } from "./UpListElementBuilder.js";

export class UpListManager {
  private services: ServiceContainer;
  private currentState: StatsState | null = null;
  private upListRender: { initialize(state: StatsState): Promise<void>; update(state: StatsState): Promise<void>; destroy(): void } | null = null;

  constructor(services: ServiceContainer) {
    this.services = services;
  }

  /**
   * 渲染UP列表
   */
  async renderUpList(state: StatsState): Promise<void> {
    console.log('[UpListManager] renderUpList 被调用, state:', {
      searchKeyword: state.searchKeyword,
      showFollowedOnly: state.showFollowedOnly,
      platform: state.platform,
      currentPage: this.services.paginationState.currentPage
    });

    // 保存当前的StatsState
    this.currentState = state;

    try {
      // 等待容器元素就绪
      let container = document.getElementById("up-list");
      let retryCount = 0;
      while (!container && retryCount < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        container = document.getElementById("up-list");
        retryCount++;
      }

      if (!container) {
        console.warn('[UpListManager] 找不到up-list容器');
        return;
      }

      // 初始化或更新UpListRender
      if (!this.upListRender) {
        // 1. 创建元素构建器实例
        const elementBuilder = new UpListElementBuilder(this.services);

        // 2. 创建Book实例
        const queryCondition = this.buildQueryCondition(state);
        const book = await this.services.getCreatorBook(queryCondition);

        // 3. 创建渲染书实例
        const renderBook = new RenderBook<Creator, HTMLElement>({
          book: book,
          elementBuilder: elementBuilder,
          maxCachePages: 3
        });

        // 更新分页状态
        this.services.paginationState.totalItems = book.state.totalRecords;
        this.services.paginationState.totalPages = book.state.totalPages;
        this.services.paginationState.pageSize = book.state.pageSize;

        // 4. 创建渲染列表实例
        this.upListRender = new UpListRender({
          container,
          services: this.services,
          renderBook: renderBook,
          autoRender: false
        });

        // 5. 初始化并渲染
        await this.upListRender.initialize(state);

        // 更新切换标签
        updateToggleLabel(state.showFollowedOnly);
      } else {
        await this.updateUpList(state);
      }
    } catch (error) {
      console.error('[UpListManager] 渲染UP列表失败:', error);
      const container = document.getElementById("up-list");
      if (container) {
        container.innerHTML = '<div class="error">加载失败</div>';
      }
    }
  }

  /**
   * 构建查询条件
   */
  private buildQueryCondition(state: StatsState): any {
    const condition: any = {
      platform: state.platform,
      isFollowing: state.showFollowedOnly ? 1 : 0
    };

    // 添加搜索关键词（如果有）
    if (state.searchKeyword && state.searchKeyword.trim()) {
      condition.keyword = state.searchKeyword.trim();
    }

    // 构建标签表达式
    const tagExpressions: any[] = [];

    // 处理包含标签（AND 操作）
    if (state.filters.includeTags.length > 0) {
      tagExpressions.push({
        tagId: state.filters.includeTags.length === 1
          ? state.filters.includeTags[0]
          : state.filters.includeTags,
        operator: 'AND'
      });
    }

    // 处理排除标签（NOT 操作）
    if (state.filters.excludeTags.length > 0) {
      tagExpressions.push({
        tagId: state.filters.excludeTags.length === 1
          ? state.filters.excludeTags[0]
          : state.filters.excludeTags,
        operator: 'NOT'
      });
    }

    // 处理分类标签
    state.filters.includeCategoryTags.forEach(category => {
      if (category.tagIds.length > 0) {
        tagExpressions.push({
          tagId: category.tagIds.length === 1
            ? category.tagIds[0]
            : category.tagIds,
          operator: 'AND'
        });
      }
    });

    state.filters.excludeCategoryTags.forEach(category => {
      if (category.tagIds.length > 0) {
        tagExpressions.push({
          tagId: category.tagIds.length === 1
            ? category.tagIds[0]
            : category.tagIds,
          operator: 'NOT'
        });
      }
    });

    // 如果有标签表达式，添加到条件中
    if (tagExpressions.length > 0) {
      condition.tagExpressions = tagExpressions;
    }

    return condition;
  }

  /**
   * 刷新UP列表
   */
  async refreshUpList(state: StatsState): Promise<void> {
    await this.renderUpList(state);
  }

  /**
   * 更新UP列表
   */
  async updateUpList(state: StatsState): Promise<void> {
    if (!this.upListRender) {
      await this.renderUpList(state);
      return;
    }

    // 更新Book实例的索引
    const queryCondition = this.buildQueryCondition(state);
    const book = await this.services.getCreatorBook(queryCondition);

    // 更新分页状态
    this.services.paginationState.totalItems = book.state.totalRecords;
    this.services.paginationState.totalPages = book.state.totalPages;
    this.services.paginationState.pageSize = book.state.pageSize;

    // 确保当前页码有效
    if (this.services.paginationState.currentPage >= this.services.paginationState.totalPages) {
      this.services.paginationState.currentPage = Math.max(0, this.services.paginationState.totalPages - 1);
    }

    // 更新UpListRender
    await this.upListRender.update(state);
  }

  /**
   * 销毁UP列表管理器
   */
  destroy(): void {
    if (this.upListRender) {
      this.upListRender.destroy();
      this.upListRender = null;
    }
    this.currentState = null;
    console.log('[UpListManager] UP列表管理器已销毁');
  }
}
