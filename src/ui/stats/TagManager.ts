/**
 * 标签管理器
 * 负责标签列表的渲染和交互
 */

import { colorFromTag } from "../../utils/tag-utils.js";
import type { TagInfo } from "./types.js";
import type { Tag } from "../../database/types/semantic.js";
import type { TagQueryCondition } from "../../database/query-server/cache/types.js";
import type { ServiceContainer } from "./services.js";
import { Platform, TagSource } from "../../database/types/base.js";
import { setDragContext, createDragGhost } from "../../utils/drag-utils.js";

type RenderFn = () => void | Promise<void>;

/**
 * 标签管理器
 */
export class TagManager {
  private services: ServiceContainer;

  constructor(services: ServiceContainer) {
    this.services = services;
  }

  /**
   * 获取标签页数据
   */
  private async getTagsByPage(page: number, options: { pageSize?: number } = {}): Promise<{
    items: TagInfo[];
    state: {
      currentPage: number;
      totalPages: number;
      pageSize: number;
      totalRecords: number;
    };
  }> {
    // 使用container的getTagBook方法获取Book实例
    const tagBook = await this.services.getTagBook();
    const result = await tagBook.getPage(page, options);

    // 转换为TagInfo格式
    const items = result.items.map(tag => ({
      tagId: tag.tagId,
      name: tag.name,
      source: tag.source
    }));

    return {
      items,
      state: result.state
    };
  }

  /**
   * 初始化标签Book
   */
  private async initTagBook(condition?: TagQueryCondition): Promise<void> {
    // 使用container的getTagBook方法
    await this.services.getTagBook(condition);
  }

  /**
   * 渲染标签列表
   */
  async renderTagList(keyword: string = "", page: number = 0): Promise<void> {
    // 初始化Book
    if (keyword.trim()) {
      await this.initTagBook({ keyword });
    } else {
      await this.initTagBook();
    }

    // 使用getTagsByPage获取分页数据
    const result = await this.getTagsByPage(page);

    const container = document.getElementById("tag-list");
    if (!container) return;

    container.innerHTML = "";

    // 渲染所有标签
    for (const tag of result.items) {
      const pill = await this.renderTagPill(tag);
      container.appendChild(pill);
    }

    // 渲染分页控件
    this.renderPagination(result.state.currentPage, result.state.totalPages, keyword);
  }

  /**
   * 渲染标签药丸
   */
  private async renderTagPill(tag: TagInfo): Promise<HTMLElement> {
    const pill = document.createElement("div");
    pill.className = "tag-pill";
    
    // 使用colorFromTag获取颜色
    const color = colorFromTag(tag.name);
    pill.style.backgroundColor = color;
    pill.textContent = tag.name;

    // 添加拖拽属性
    pill.draggable = true;

    // 拖拽开始事件
    pill.addEventListener('dragstart', (e) => {
      const context = {
        tagId: tag.tagId,
        tagName: tag.name,
        dropped: false,
        isFilterTag: false
      };
      setDragContext(context);
      createDragGhost(e as DragEvent, tag.name);
    });

    return pill;
  }

  /**
   * 创建新标签
   */
  async createTag(name: string): Promise<number> {
    const tagId = await this.services.tagRepo.createTag(name, TagSource.USER);

    // 使用container的resetBooks方法清空Book实例，强制重新加载
    this.services.resetBooks();

    return tagId;
  }

  /**
   * 获取所有标签（兼容旧接口）
   */
  async getAllTags(): Promise<TagInfo[]> {
    const result = await this.getTagsByPage(0, { pageSize: Number.MAX_SAFE_INTEGER });
    return result.items;
  }

  /**
   * 搜索标签（兼容旧接口）
   */
  async searchTags(keyword: string): Promise<TagInfo[]> {
    await this.initTagBook({ keyword });
    const result = await this.getTagsByPage(0, { pageSize: Number.MAX_SAFE_INTEGER });
    return result.items;
  }

  /**
   * 批量获取标签
   */
  async getTagsByIds(tagIds: number[]): Promise<Map<number, TagInfo>> {
    const tags = await this.services.tagRepo.getTags(tagIds);
    const result = new Map<number, TagInfo>();
    tags.forEach(tag => {
      result.set(tag.tagId, {
        tagId: tag.tagId,
        name: tag.name,
        source: tag.source
      });
    });
    return result;
  }

  /**
   * 渲染分页控件
   */
  private renderPagination(currentPage: number, totalPages: number, keyword: string): void {
    const paginationContainer = document.getElementById("tag-pagination");
    if (!paginationContainer) return;

    paginationContainer.innerHTML = "";

    // 上一页按钮
    const prevBtn = document.createElement("button");
    prevBtn.className = "pagination-btn";
    prevBtn.textContent = "上一页";
    prevBtn.disabled = currentPage === 0;
    prevBtn.addEventListener("click", () => {
      if (currentPage > 0) {
        this.renderTagList(keyword, currentPage - 1);
      }
    });
    paginationContainer.appendChild(prevBtn);

    // 页码信息
    const pageInfo = document.createElement("span");
    pageInfo.className = "pagination-info";
    pageInfo.textContent = `${currentPage + 1} / ${totalPages || 1}`;
    paginationContainer.appendChild(pageInfo);

    // 下一页按钮
    const nextBtn = document.createElement("button");
    nextBtn.className = "pagination-btn";
    nextBtn.textContent = "下一页";
    nextBtn.disabled = currentPage >= totalPages - 1;
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages - 1) {
        this.renderTagList(keyword, currentPage + 1);
      }
    });
    paginationContainer.appendChild(nextBtn);
  }
}
