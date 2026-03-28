/**
 * 筛选管理器
 * 负责筛选标签的渲染和交互
 */

import type { StatsState } from "./types.js";
import type { ServiceContainer } from "./services.js";
import type { ID } from "../../database/types/base.js";
import { getDragContext, setDragContext } from "../../utils/drag-utils.js";
import { colorFromTag } from "../../utils/tag-utils.js";

type RefreshFn = () => void;

/**
 * 筛选管理器
 */
export class FilterManager {
  private services: ServiceContainer;

  constructor(services: ServiceContainer) {
    this.services = services;
  }

  /**
   * 添加包含标签
   */
  addIncludeTag(state: StatsState, tagId: ID): void {
    if (!state.filters.includeTags.includes(tagId)) {
      state.filters.includeTags.push(tagId);
    }
  }

  /**
   * 移除包含标签
   */
  removeIncludeTag(state: StatsState, tagId: ID): void {
    state.filters.includeTags = state.filters.includeTags.filter(id => id !== tagId);
  }

  /**
   * 添加排除标签
   */
  addExcludeTag(state: StatsState, tagId: ID): void {
    if (!state.filters.excludeTags.includes(tagId)) {
      state.filters.excludeTags.push(tagId);
    }
  }

  /**
   * 移除排除标签
   */
  removeExcludeTag(state: StatsState, tagId: ID): void {
    state.filters.excludeTags = state.filters.excludeTags.filter(id => id !== tagId);
  }

  /**
   * 清除所有筛选
   */
  clearAllFilters(state: StatsState): void {
    state.filters.includeTags = [];
    state.filters.excludeTags = [];
    state.filters.includeCategories = [];
    state.filters.excludeCategories = [];
    state.filters.includeCategoryTags = [];
    state.filters.excludeCategoryTags = [];
  }

  /**
   * 检查是否有活动筛选
   */
  hasActiveFilters(state: StatsState): boolean {
    return (
      state.filters.includeTags.length > 0 ||
      state.filters.excludeTags.length > 0 ||
      state.filters.includeCategories.length > 0 ||
      state.filters.excludeCategories.length > 0
    );
  }

  /**
   * 渲染筛选标签
   */
  async renderFilterTags(state: StatsState, refresh: RefreshFn): Promise<void> {
    const includeContainer = document.getElementById("filter-include-tags");
    const excludeContainer = document.getElementById("filter-exclude-tags");

    if (!includeContainer || !excludeContainer) return;

    // 清空容器
    includeContainer.innerHTML = "";
    excludeContainer.innerHTML = "";

    // 获取标签名称
    const allTagIds = [...state.filters.includeTags, ...state.filters.excludeTags];
    const tagsMap = allTagIds.length > 0 ? await this.services.tagRepo.getTags(allTagIds) : new Map();

    // 渲染包含标签
    for (const tagId of state.filters.includeTags) {
      const tag = tagsMap.get(tagId);
      const tagName = tag?.name || String(tagId);
      const tagElement = this.createFilterTagElement(tagId, tagName, 'include', state, refresh);
      includeContainer.appendChild(tagElement);
    }

    // 渲染排除标签
    for (const tagId of state.filters.excludeTags) {
      const tag = tagsMap.get(tagId);
      const tagName = tag?.name || String(tagId);
      const tagElement = this.createFilterTagElement(tagId, tagName, 'exclude', state, refresh);
      excludeContainer.appendChild(tagElement);
    }
  }

  /**
   * 创建筛选标签元素
   */
  private createFilterTagElement(
    tagId: ID,
    tagName: string,
    type: 'include' | 'exclude',
    state: StatsState,
    refresh: RefreshFn
  ): HTMLElement {
    const tagElement = document.createElement("span");
    tagElement.className = `filter-tag filter-tag-${type}`;
    tagElement.textContent = tagName;

    // 使用colorFromTag函数计算标签颜色
    const tagColor = colorFromTag(tagName);
    tagElement.style.backgroundColor = tagColor;

    // 设置标签可拖拽
    tagElement.draggable = true;
    tagElement.style.cursor = 'grab';

    // 拖拽开始事件
    tagElement.addEventListener('dragstart', (e) => {
      // 设置拖拽数据
      const context = {
        tagId: tagId,
        tagName: tagName,
        dropped: false,
        isFilterTag: true  // 标记这是过滤区标签
      };
      setDragContext(context);

      // 创建拖拽时的幽灵元素
      const ghost = e.target as HTMLElement;
      ghost.style.opacity = '0.5';

      // 设置拖拽效果
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tagName);
      }
    });

    // 拖拽结束事件
    tagElement.addEventListener('dragend', (e) => {
      const context = getDragContext();
      if (context && !context.dropped && context.isFilterTag) {
        // 立即移除DOM元素
        tagElement.remove();

        // 如果拖拽没有被放置到任何区域，则删除标签
        if (type === 'include') {
          this.removeIncludeTag(state, tagId);
        } else {
          this.removeExcludeTag(state, tagId);
        }
        refresh();
      }
      // 重置透明度
      (e.target as HTMLElement).style.opacity = '1';
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "filter-tag-remove";
    removeBtn.textContent = "×";

    // 阻止事件冒泡，防止触发标签的拖拽
    removeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      e.preventDefault();  // 阻止默认行为

      // 立即移除DOM元素
      tagElement.remove();

      // 更新状态
      if (type === 'include') {
        this.removeIncludeTag(state, tagId);
      } else {
        this.removeExcludeTag(state, tagId);
      }
      refresh();
    });

    tagElement.appendChild(removeBtn);
    return tagElement;
  }

  /**
   * 清除所有筛选
   */
  async clearFilters(state: StatsState, refresh: RefreshFn): Promise<void> {
    this.clearAllFilters(state);

    // 清除搜索关键词
    state.searchKeyword = '';
    const searchInput = document.getElementById('up-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
    }

    refresh();
  }

  /**
   * 设置拖拽功能
   */
  setupDragAndDrop(state: StatsState, refresh: RefreshFn): void {
    const includeZone = document.getElementById("filter-include-tags");
    const excludeZone = document.getElementById("filter-exclude-tags");

    if (!includeZone || !excludeZone) {
      console.warn('[FilterManager] 过滤区域未找到');
      return;
    }

    // 设置包含区域的拖拽事件
    this.setupDropZone(includeZone, state, refresh, 'include');

    // 设置排除区域的拖拽事件
    this.setupDropZone(excludeZone, state, refresh, 'exclude');
  }

  /**
   * 设置拖放区域
   */
  private setupDropZone(
    zone: HTMLElement,
    state: StatsState,
    refresh: RefreshFn,
    type: 'include' | 'exclude'
  ): void {
    // 阻止默认行为，允许放置
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      zone.classList.add('drag-over');
    });

    // 拖拽离开时移除样式
    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget as Node)) {
        zone.classList.remove('drag-over');
      }
    });

    // 处理放置事件
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');

      const context = getDragContext();
      if (!context || !context.tagId) {
        return;
      }

      // 如果是过滤区标签被拖拽，则不执行添加操作
      if (context.isFilterTag) {
        // 标记已放置，防止触发删除
        context.dropped = true;
        setDragContext(context);
        return;
      }

      // 更新过滤状态
      if (type === 'include') {
        this.addIncludeTag(state, context.tagId);
      } else {
        this.addExcludeTag(state, context.tagId);
      }

      // 标记已放置
      context.dropped = true;
      setDragContext(context);

      // 刷新显示
      refresh();
    });
  }
}
