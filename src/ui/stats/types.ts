
import type { Platform } from "../../../database/types/base.js";

/**
 * UI使用的分类类型
 */
export interface Category {
  id: string;
  name: string;
  tags: string[];
}

/**
 * 筛选状态
 */
export interface FilterState {
  includeTags: string[];
  excludeTags: string[];
  includeCategories: string[];
  excludeCategories: string[];
}

/**
 * 拖拽上下文
 */
export interface DragContext {
  tagId: string;
  tagName: string;
  originUpMid?: string;
  categoryId?: string;
  dropped: boolean;
}

/**
 * UP主缓存数据
 */
export interface UPCacheData {
  creatorId: string;
  name: string;
  avatar: string;
  avatarUrl: string;
  description: string;
  followTime: number;
  isFollowing: boolean;
  tags: string[];
}

/**
 * 标签缓存数据
 */
export interface TagCacheData {
  tagId: string;
  name: string;
  source: "user" | "system";
  color?: string;
  icon?: string;
}

/**
 * 统计状态
 */
export interface StatsState {
  // 平台
  platform: Platform;

  // 所有标签计数
  allTagCounts: Record<string, number>;

  // 过滤后的标签
  filteredTags: string[];

  // 当前自定义标签
  currentCustomTags: string[];

  // 分类列表
  categories: Category[];

  // 过滤后的分类
  filteredCategories: Category[];

  // 是否只显示已关注
  showFollowedOnly: boolean;

  // 筛选状态
  filters: FilterState;

  // 当前UP主ID列表
  currentUpList: string[];

  // UP主标签映射
  currentUpTags: Record<string, string[]>;

  // 标签库
  tagLibrary: Record<string, TagCacheData>;

  // UP主缓存
  upCache: Record<string, UPCacheData>;

  // 分类缓存
  categoryCache: Record<string, Category>;

  // 标签ID到名称的映射
  tagIdToName: Record<string, string>;

  // 统计数据
  stats: {
    totalCreators: number;
    followedCount: number;
    unfollowedCount: number;
    totalTags: number;
  };
}
