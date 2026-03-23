/**
 * CategoryRepository 实现
 * 实现标签分区相关的数据库操作
 */

// 接口已移除，直接实现功能
import { Category } from '../types/semantic.js';
import { DBUtils, STORE_NAMES } from '../indexeddb/index.js';

/**
 * CategoryRepository 实现类
 */
export class CategoryRepository {
  /**
   * 创建分区
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<string> {
    const id = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newCategory: Category = {
      id,
      ...category
    };
    await DBUtils.add(STORE_NAMES.CATEGORIES, newCategory);
    return id;
  }

  /**
   * 批量创建分区
   */
  async createCategories(categories: Omit<Category, 'id'>[]): Promise<string[]> {
    const ids: string[] = [];
    const newCategories: Category[] = categories.map(category => {
      const id = `category_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      ids.push(id);
      return { id, ...category };
    });
    await DBUtils.addBatch(STORE_NAMES.CATEGORIES, newCategories);
    return ids;
  }

  /**
   * 获取分区
   */
  async getCategory(categoryId: string): Promise<Category | null> {
    return DBUtils.get<Category>(STORE_NAMES.CATEGORIES, categoryId);
  }

  /**
   * 获取所有分区
   */
  async getAllCategories(parentId?: string): Promise<Category[]> {
    const allCategories = await DBUtils.getAll<Category>(STORE_NAMES.CATEGORIES);
    if (parentId !== undefined) {
      return allCategories.filter(cat => cat.parentId === parentId);
    }
    return allCategories;
  }

  /**
   * 获取分区树
   */
  async getCategoryTree(rootId?: string): Promise<Category[]> {
    const allCategories = await this.getAllCategories();
    const categoryMap = new Map<string, Category>();
    allCategories.forEach(cat => categoryMap.set(cat.id, cat));

    const buildTree = (parentId?: string): Category[] => {
      return allCategories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
          ...cat,
          // 将子节点添加到 children 属性（如果需要）
          children: buildTree(cat.id)
        }));
    };

    return buildTree(rootId);
  }

  /**
   * 更新分区
   */
  async updateCategory(categoryId: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<void> {
    const existing = await this.getCategory(categoryId);
    if (!existing) {
      throw new Error(`Category not found: ${categoryId}`);
    }
    const updated: Category = {
      ...existing,
      ...updates
    };
    await DBUtils.put(STORE_NAMES.CATEGORIES, updated);
  }

  /**
   * 删除分区
   */
  async deleteCategory(categoryId: string): Promise<void> {
    await DBUtils.delete(STORE_NAMES.CATEGORIES, categoryId);
  }

  /**
   * 删除分区及其所有子分区
   */
  async deleteCategoryTree(categoryId: string): Promise<void> {
    const allCategories = await this.getAllCategories();
    const toDelete = [categoryId];

    // 递归查找所有子分区
    const findChildren = (parentId: string) => {
      allCategories
        .filter(cat => cat.parentId === parentId)
        .forEach(cat => {
          toDelete.push(cat.id);
          findChildren(cat.id);
        });
    };

    findChildren(categoryId);

    // 批量删除
    await DBUtils.deleteBatch(STORE_NAMES.CATEGORIES, toDelete);
  }

  /**
   * 向分区添加标签
   */
  async addTagsToCategory(categoryId: string, tagIds: string[]): Promise<void> {
    const existing = await this.getCategory(categoryId);
    if (!existing) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    // 合并标签列表，不去重
    const updatedTagIds = [...existing.tagIds, ...tagIds];
    await this.updateCategory(categoryId, { tagIds: updatedTagIds });
  }

  /**
   * 从分区移除标签
   */
  async removeTagsFromCategory(categoryId: string, tagIds: string[]): Promise<void> {
    const existing = await this.getCategory(categoryId);
    if (!existing) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    const updatedTagIds = existing.tagIds.filter(id => !tagIds.includes(id));
    await this.updateCategory(categoryId, { tagIds: updatedTagIds });
  }

  /**
   * 清空分区的所有标签
   */
  async clearCategoryTags(categoryId: string): Promise<void> {
    await this.updateCategory(categoryId, { tagIds: [] });
  }

  /**
   * 获取分区的所有标签
   */
  async getCategoryTags(categoryId: string): Promise<string[]> {
    const category = await this.getCategory(categoryId);
    return category?.tagIds ?? [];
  }

  /**
   * 检查标签是否在分区中
   */
  async isTagInCategory(categoryId: string, tagId: string): Promise<boolean> {
    const tags = await this.getCategoryTags(categoryId);
    return tags.includes(tagId);
  }

  /**
   * 获取标签所属的所有分区
   */
  async getTagCategories(tagId: string): Promise<Category[]> {
    const allCategories = await this.getAllCategories();
    return allCategories.filter(cat => cat.tagIds.includes(tagId));
  }
}
