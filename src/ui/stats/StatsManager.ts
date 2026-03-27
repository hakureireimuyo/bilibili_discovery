/**
 * 统计页面管理器
 * 统一管理统计页面的所有功能
 */

import { Platform } from "../../database/types/base.js";
import { getServiceContainer, type ServiceContainer } from "./services.js";
import { createInitialState } from "./helpers.js";
import { UpListManager } from "./UpListManager.js";
import { TagManager } from "./TagManager.js";
import { CategoryManager } from "./CategoryManager.js";
import { FilterManager } from "./FilterManager.js";
import type { StatsState } from "./types.js";

/**
 * 实例容器接口
 * 定义所有需要管理的实例
 */
interface InstanceContainer {
  // 服务容器
  services: ServiceContainer;
  // 状态管理
  state: StatsState;
  // 子管理器
  upListManager: UpListManager;
  tagManager: TagManager;
  categoryManager: CategoryManager;
  filterManager: FilterManager;
}

/**
 * 实例容器类
 * 负责创建、管理和分发所有实例
 */
class InstanceContainerImpl implements InstanceContainer {
  private static instance: InstanceContainerImpl | null = null;

  public readonly services: ServiceContainer;
  public readonly state: StatsState;
  public readonly upListManager: UpListManager;
  public readonly tagManager: TagManager;
  public readonly categoryManager: CategoryManager;
  public readonly filterManager: FilterManager;
  private initialized: boolean = false;

  private constructor() {
    // 初始化服务容器
    this.services = getServiceContainer();

    // 初始化状态
    this.state = createInitialState(Platform.BILIBILI);

    // 初始化子管理器
    this.upListManager = new UpListManager(this.services);
    this.tagManager = new TagManager(this.services);
    this.categoryManager = new CategoryManager(this.services);
    this.filterManager = new FilterManager(this.services);
  }

  /**
   * 获取实例容器的单例
   */
  public static getInstance(): InstanceContainerImpl {
    if (!InstanceContainerImpl.instance) {
      InstanceContainerImpl.instance = new InstanceContainerImpl();
    }
    return InstanceContainerImpl.instance;
  }

  /**
   * 重置实例容器
   */
  public static reset(): void {
    InstanceContainerImpl.instance = null;
  }

  /**
   * 初始化所有实例
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[InstanceContainer] 已经初始化过了');
      return;
    }

    try {
      this.initialized = true;
    } catch (error) {
      console.error('[InstanceContainer] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * 统计页面管理器
 * 负责协调所有子管理器，管理页面状态和渲染
 */
export class StatsManager {
  private container: InstanceContainerImpl;
  private initialized: boolean = false;

  constructor(container?: InstanceContainerImpl) {
    this.container = container || InstanceContainerImpl.getInstance();
  }

  /**
   * 初始化统计页面
   */
  async init(): Promise<void> {
    if (typeof document === "undefined") {
      return;
    }

    if (this.initialized) {
      console.warn('[StatsManager] 已经初始化过了');
      return;
    }

    try {
      // 初始化实例容器
      await this.container.initialize();

      // 绑定事件
      this.bindPageActions();
      this.bindInputs();

      // 设置拖拽功能
      this.container.filterManager.setupDragAndDrop(this.container.state, () => this.rerender());

      // 加载数据
      await this.loadData();

      this.initialized = true;
    } catch (error) {
      console.error('[StatsManager] 初始化失败:', error);
      this.container.state.error = error instanceof Error ? error.message : '未知错误';
    }
  }

  /**
   * 加载统计数据
   */
  private async loadStats(): Promise<void> {
    // 获取已关注和未关注的UP数量
    const followedCount = await this.container.services.creatorRepo.getFollowedCount(this.container.state.platform);
    const unfollowedCount = await this.container.services.creatorRepo.getUnfollowedCount(this.container.state.platform);

    // 获取标签总数
    const tagResult = await this.container.services.tagRepo.getAllTags();
    const tagCount = tagResult.total;

    // 更新UI
    const followedCountElement = document.getElementById("stat-followed-count");
    const unfollowedCountElement = document.getElementById("stat-unfollowed-count");
    const tagCountElement = document.getElementById("stat-tag-count");

    if (followedCountElement) {
      followedCountElement.textContent = followedCount.toString();
    }
    if (unfollowedCountElement) {
      unfollowedCountElement.textContent = unfollowedCount.toString();
    }
    if (tagCountElement) {
      tagCountElement.textContent = tagCount.toString();
    }
  }

  /**
   * 加载数据
   */
  private async loadData(): Promise<void> {
    console.log(`[StatsManager] loadData 被调用`);
    this.container.state.loading = true;

    try {
      // 获取统计数据
      await this.loadStats();

      // 顺序初始化各个管理器，确保依赖关系正确
      // 1. 先初始化标签管理器
      console.log('[StatsManager] 初始化标签管理器...');
      await this.container.tagManager.renderTagList();

      // 2. 然后初始化分类管理器
      console.log('[StatsManager] 初始化分类管理器...');
      await this.container.categoryManager.renderCategories(() => this.rerender());

      // 3. 最后初始化UP列表管理器（依赖标签和分类）
      console.log('[StatsManager] 初始化UP列表管理器...');
      await this.container.upListManager.renderUpList(this.container.state);

      console.log('[StatsManager] 所有管理器初始化完成');
    } catch (error) {
      console.error('[StatsManager] 加载数据失败:', error);
      this.container.state.error = error instanceof Error ? error.message : '加载失败';
    } finally {
      this.container.state.loading = false;
    }
  }

  /**
   * 重新渲染页面
   */
  private async rerender(): Promise<void> {
    console.log(`[StatsManager] rerender 被调用`);
    await this.container.upListManager.renderUpList(this.container.state);
    await this.container.tagManager.renderTagList();
    await this.container.categoryManager.renderCategories(() => this.rerender());
    await this.container.filterManager.renderFilterTags(this.container.state, () => this.rerender());
  }

  /**
   * 绑定页面操作
   */
  private bindPageActions(): void {
    // 绑定添加标签按钮
    const addTagBtn = document.getElementById('btn-add-tag');
    addTagBtn?.addEventListener('click', async () => {
      const tagName = prompt('请输入标签名称:');
      if (tagName) {
        try {
          await this.container.tagManager.createTag(tagName);
          await this.container.tagManager.renderTagList();
        } catch (error) {
          console.error('[StatsManager] 添加标签失败:', error);
          this.container.state.error = error instanceof Error ? error.message : '添加标签失败';
        }
      }
    });

    // 绑定添加分类按钮
    const addCategoryBtn = document.getElementById('btn-add-category');
    addCategoryBtn?.addEventListener('click', async () => {
      const categoryName = prompt('请输入分类名称:');
      if (categoryName) {
        try {
          await this.container.categoryManager.createCategory(categoryName);
          await this.container.categoryManager.renderCategories(() => this.rerender());
        } catch (error) {
          console.error('[StatsManager] 添加分类失败:', error);
          this.container.state.error = error instanceof Error ? error.message : '添加分类失败';
        }
      }
    });

    // 绑定清除筛选按钮
    const clearFilterBtn = document.getElementById('btn-clear-filter');
    clearFilterBtn?.addEventListener('click', () => {
      this.container.filterManager.clearFilters(this.container.state, () => this.rerender());
    });
  }

  /**
   * 绑定输入事件
   */
  private bindInputs(): void {
    // 绑定搜索框
    const searchInput = document.getElementById('up-search');
    searchInput?.addEventListener('input', this.debounce((e) => {
      const keyword = (e.target as HTMLInputElement).value.trim();
      // 如果搜索框为空，清除搜索关键词状态
      if (keyword === '') {
        this.container.state.searchKeyword = '';
      } else {
        this.container.state.searchKeyword = keyword;
      }
      this.container.upListManager.renderUpList(this.container.state);
    }, 300));

    // 绑定关注筛选开关
    const followToggle = document.getElementById('show-followed-toggle');
    followToggle?.addEventListener('change', (e) => {
      this.container.state.showFollowedOnly = (e.target as HTMLInputElement).checked;
      this.container.upListManager.renderUpList(this.container.state);
    });

    // 绑定标签搜索框
    const tagSearchInput = document.getElementById('tag-search');
    tagSearchInput?.addEventListener('input', this.debounce((e) => {
      const keyword = (e.target as HTMLInputElement).value.trim();
      // 如果搜索框为空，显示所有标签
      if (keyword === '') {
        this.container.tagManager.renderTagList('');
      } else {
        this.container.tagManager.renderTagList(keyword);
      }
    }, 300));
  }

  /**
   * 防抖函数
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * 获取当前状态
   */
  getState(): StatsState {
    return this.container.state;
  }

  /**
   * 获取实例容器
   */
  getContainer(): InstanceContainer {
    return this.container;
  }
}

/**
 * 创建全局统计管理器实例
 */
let globalStatsManager: StatsManager | null = null;

/**
 * 获取全局统计管理器
 */
export function getStatsManager(): StatsManager {
  if (!globalStatsManager) {
    globalStatsManager = new StatsManager();
  }
  return globalStatsManager;
}

/**
 * 重置全局统计管理器
 */
export function resetStatsManager(): void {
  globalStatsManager = null;
  InstanceContainerImpl.reset();
}

/**
 * 获取实例容器
 */
export function getInstanceContainer(): InstanceContainer {
  return InstanceContainerImpl.getInstance();
}

