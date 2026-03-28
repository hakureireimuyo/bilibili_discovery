/**
 * 分类管理器
 * 负责分类列表的渲染和交互
 */

import type { CategoryInfo, TagInfo } from "./types.js";
import type { ServiceContainer } from "./services.js";
import type { ID } from "../../database/types/base.js";
import { colorFromTag } from "../../utils/tag-utils.js";
import { createDragGhost, setDragContext, type DragContext } from "../../utils/drag-utils.js";

type RenderFn = () => void;

/**
 * 分类管理器
 */
export class CategoryManager {
  private services: ServiceContainer;

  constructor(services: ServiceContainer) {
    this.services = services;
  }

  /**
   * 获取所有分类
   */
  async getAllCategories(): Promise<CategoryInfo[]> {
    const categories = await this.services.categoryRepo.getAllCategories();
    return categories.map(cat => ({
      categoryId: cat.id,
      name: cat.name,
      description: cat.description,
      tagIds: cat.tagIds
    }));
  }

  /**
   * 创建新分类
   */
  async createCategory(name: string, description?: string): Promise<ID> {
    return await this.services.categoryRepo.createCategory({
      name,
      description,
      tagIds: []
    });
  }

  /**
   * 向分类添加标签
   */
  async addTagsToCategory(categoryId: ID, tagIds: ID[]): Promise<void> {
    await this.services.categoryRepo.addTagsToCategory(categoryId, tagIds);
  }

  /**
   * 从分类移除标签
   */
  async removeTagsFromCategory(categoryId: ID, tagIds: ID[]): Promise<void> {
    await this.services.categoryRepo.removeTagsFromCategory(categoryId, tagIds);
  }

  /**
   * 删除分类
   */
  async deleteCategory(categoryId: ID): Promise<void> {
    await this.services.categoryRepo.deleteCategory(categoryId);
  }

  /**
   * 渲染分类列表
   */
  async renderCategories(onChanged: RenderFn): Promise<void> {
    const categories = await this.getAllCategories();
    const container = document.getElementById("category-list");
    if (!container) return;

    container.innerHTML = "";

    for (const category of categories) {
      const categoryElement = await this.renderCategoryItem(category, onChanged);
      container.appendChild(categoryElement);
    }

    // 渲染分页控件
    this.renderPagination();
  }

  /**
   * 渲染分类项
   */
  private async renderCategoryItem(category: CategoryInfo, onChanged: RenderFn): Promise<HTMLElement> {
    const categoryElement = document.createElement("div");
    categoryElement.className = "category-item";

    // 创建分类头部
    const categoryHeader = document.createElement("div");
    categoryHeader.className = "category-header";

    const categoryName = document.createElement("div");
    categoryName.className = "category-name";
    categoryName.textContent = category.name;
    categoryHeader.appendChild(categoryName);

    const removeBtn = document.createElement("button");
    removeBtn.className = "category-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", async () => {
      if (confirm(`确定要删除分类 "${category.name}" 吗?`)) {
        try {
          await this.deleteCategory(category.categoryId);
          onChanged();
        } catch (error) {
          console.error('[CategoryManager] 删除分类失败:', error);
          alert('删除分类失败');
        }
      }
    });
    categoryHeader.appendChild(removeBtn);
    categoryElement.appendChild(categoryHeader);

    if (category.description) {
      const categoryDesc = document.createElement("div");
      categoryDesc.className = "category-description";
      categoryDesc.textContent = category.description;
      categoryElement.appendChild(categoryDesc);
    }

    // 显示标签
    if (category.tagIds && category.tagIds.length > 0) {
      const tagsContainer = document.createElement("div");
      tagsContainer.className = "category-tags";

      // 获取标签信息
      const tagsMap = await this.services.tagRepo.getTags(category.tagIds);

      for (const tagId of category.tagIds) {
        const tag = tagsMap.get(tagId);
        if (tag) {
          const tagElement = document.createElement("span");
          tagElement.className = "tag-pill";
          tagElement.textContent = tag.name;
          tagElement.style.backgroundColor = colorFromTag(tag.name);
          tagElement.draggable = true;

          // 添加拖拽功能
          tagElement.addEventListener('dragstart', (e) => {
            const context: DragContext = {
              tagId: tag.tagId,
              tagName: tag.name,
              dropped: false
            };
            setDragContext(context);
            createDragGhost(e as DragEvent, tag.name);
          });

          tagsContainer.appendChild(tagElement);
        }
      }

      categoryElement.appendChild(tagsContainer);
    }

    return categoryElement;
  }

  /**
   * 添加分类（兼容旧接口）
   */
  async addCategoryCompat(name: string, onChanged: RenderFn): Promise<void> {
    await this.createCategory(name);
    onChanged();
  }

  /**
   * 删除分类（兼容旧接口）
   */
  async removeCategoryCompat(categoryId: ID, onChanged: RenderFn): Promise<void> {
    await this.deleteCategory(categoryId);
    onChanged();
  }

  /**
   * 添加标签到分类（兼容旧接口）
   */
  async addTagToCategoryCompat(categoryId: ID, tagId: ID, onChanged: RenderFn): Promise<void> {
    await this.addTagsToCategory(categoryId, [tagId]);
    onChanged();
  }

  /**
   * 从分类中移除标签（兼容旧接口）
   */
  async removeTagFromCategoryCompat(categoryId: ID, tagId: ID, onChanged: RenderFn): Promise<void> {
    await this.removeTagsFromCategory(categoryId, [tagId]);
    onChanged();
  }

  /**
   * 渲染分页控件
   */
  private renderPagination(): void {
    const paginationContainer = document.getElementById("category-pagination");
    if (!paginationContainer) return;

    paginationContainer.innerHTML = "<div class='pagination-info'>暂无分页</div>";
  }
}
