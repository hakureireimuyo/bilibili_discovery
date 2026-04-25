# Stats 模块重构方案

## 一、重构目标

基于新的数据库架构，全面重构 stats 模块，实现：
1. 统一的数据访问层（通过 Repository 层）
2. 高效的查询机制（利用 QueryService）
3. 完善的缓存管理（使用 CacheManager）
4. 类型安全的数据操作
5. 良好的错误处理机制

## 二、架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────┐
│         UI 层（stats.ts）           │
│  - 页面初始化                        │
│  - 事件绑定                          │
│  - 状态管理                          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      业务逻辑层（各 manager）        │
│  - tag-manager.ts                   │
│  - category-manager.ts              │
│  - filter-manager.ts                │
│  - up-list.ts                       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      数据访问层（Repository）        │
│  - CreatorRepository                │
│  - TagRepository                    │
│  - CategoryRepository               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      查询服务层（QueryService）      │
│  - 复杂查询                          │
│  - 筛选逻辑                          │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      缓存层（CacheManager）         │
│  - IndexCache                       │
│  - DataCache                        │
│  - TagCache                         │
└─────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| stats.ts | 页面入口、状态管理、事件协调 |
| types.ts | 类型定义 |
| helpers.ts | 辅助函数、状态管理工具 |
| tag-manager.ts | 标签管理、标签操作 |
| category-manager.ts | 分类管理、分类操作 |
| filter-manager.ts | 筛选管理、筛选逻辑 |
| up-list.ts | UP列表渲染、分页 |

## 三、类型定义重构

### 3.1 types.ts

```typescript
import type { Platform, ID, TagSource } from "../../database/types/base.js";

/**
 * 标签信息
 */
export interface TagInfo {
  tagId: ID;
  name: string;
  source: TagSource;
  count?: number;
}

/**
 * 分类信息
 */
export interface CategoryInfo {
  categoryId: ID;
  name: string;
  description?: string;
  tagIds: ID[];
  tags?: TagInfo[];
}

/**
 * 分类标签列表
 */
export interface CategoryTagList {
  categoryId: ID;
  tagIds: ID[];
}

/**
 * 过滤状态
 */
export interface FilterState {
  includeTags: ID[];
  excludeTags: ID[];
  includeCategories: ID[];
  excludeCategories: ID[];
  includeCategoryTags: CategoryTagList[];
  excludeCategoryTags: CategoryTagList[];
}

/**
 * 统计页面状态
 */
export interface StatsState {
  platform: Platform;
  showFollowedOnly: boolean;
  filters: FilterState;
  cacheEnabled: boolean;
  loading: boolean;
  error?: string;
}

/**
 * 分页状态
 */
export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}
```

## 四、核心模块重构

### 4.1 helpers.ts

```typescript
import type { FilterState, StatsState, PaginationState } from "./types.js";
import { Platform } from "../../database/types/base.js";

/**
 * 创建初始状态
 */
export function createInitialState(platform: Platform = Platform.BILIBILI): StatsState {
  return {
    platform,
    showFollowedOnly: true,
    filters: createEmptyFilters(),
    cacheEnabled: true,
    loading: false
  };
}

/**
 * 创建空筛选器
 */
export function createEmptyFilters(): FilterState {
  return {
    includeTags: [],
    excludeTags: [],
    includeCategories: [],
    excludeCategories: [],
    includeCategoryTags: [],
    excludeCategoryTags: []
  };
}

/**
 * 重置过滤器状态
 */
export function resetFilters(filters: FilterState): void {
  filters.includeTags = [];
  filters.excludeTags = [];
  filters.includeCategories = [];
  filters.excludeCategories = [];
  filters.includeCategoryTags = [];
  filters.excludeCategoryTags = [];
}

/**
 * 创建初始分页状态
 */
export function createInitialPagination(): PaginationState {
  return {
    currentPage: 0,
    pageSize: 50,
    totalPages: 0,
    totalItems: 0
  };
}

/**
 * 更新加载状态
 */
export function setLoading(state: StatsState, loading: boolean): void {
  state.loading = loading;
}

/**
 * 设置错误信息
 */
export function setError(state: StatsState, error?: string): void {
  state.error = error;
}
```

### 4.2 tag-manager.ts

```typescript
import { TagRepository, TagSource } from "../../database/index.js";
import type { TagInfo } from "./types.js";

const tagRepo = new TagRepository();

/**
 * 获取所有标签
 */
export async function getAllTags(): Promise<TagInfo[]> {
  const result = await tagRepo.getAllTags();
  return result.items.map(tag => ({
    tagId: tag.tagId,
    name: tag.name,
    source: tag.source
  }));
}

/**
 * 创建新标签
 */
export async function createTag(name: string, source: TagSource = TagSource.USER): Promise<ID> {
  return await tagRepo.createTag(name, source);
}

/**
 * 搜索标签
 */
export async function searchTags(keyword: string): Promise<TagInfo[]> {
  const result = await tagRepo.searchTags(keyword);
  return result.items.map(tag => ({
    tagId: tag.tagId,
    name: tag.name,
    source: tag.source
  }));
}

/**
 * 批量获取标签
 */
export async function getTagsByIds(tagIds: ID[]): Promise<Map<ID, TagInfo>> {
  const tags = await tagRepo.getTags(tagIds);
  const result = new Map<ID, TagInfo>();
  tags.forEach(tag => {
    result.set(tag.tagId, {
      tagId: tag.tagId,
      name: tag.name,
      source: tag.source
    });
  });
  return result;
}
```

### 4.3 category-manager.ts

```typescript
import { CategoryRepository } from "../../database/index.js";
import type { CategoryInfo, TagInfo } from "./types.js";

const categoryRepo = new CategoryRepository();

/**
 * 获取所有分类
 */
export async function getAllCategories(): Promise<CategoryInfo[]> {
  const categories = await categoryRepo.getAllCategories();
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
export async function createCategory(name: string, description?: string): Promise<ID> {
  return await categoryRepo.createCategory({
    name,
    description,
    tagIds: []
  });
}

/**
 * 向分类添加标签
 */
export async function addTagsToCategory(categoryId: ID, tagIds: ID[]): Promise<void> {
  await categoryRepo.addTagsToCategory(categoryId, tagIds);
}

/**
 * 从分类移除标签
 */
export async function removeTagsFromCategory(categoryId: ID, tagIds: ID[]): Promise<void> {
  await categoryRepo.removeTagsFromCategory(categoryId, tagIds);
}

/**
 * 删除分类
 */
export async function deleteCategory(categoryId: ID): Promise<void> {
  await categoryRepo.deleteCategory(categoryId);
}
```

### 4.4 up-list.ts

```typescript
import { CreatorRepository, QueryService } from "../../database/index.js";
import type { Creator, ID, Platform } from "../../database/types/base.js";
import type { StatsState, PaginationState } from "./types.js";

const creatorRepo = new CreatorRepository();
const queryService = new QueryService(creatorRepo);

/**
 * 获取筛选后的创作者列表
 */
export async function getFilteredCreators(
  state: StatsState,
  pagination: PaginationState
): Promise<{ creators: Creator[]; total: number }> {
  // 构建查询条件
  const queryCondition = buildQueryCondition(state);

  // 执行查询
  const result = await queryService.query(queryCondition);

  // 应用分页
  const start = pagination.currentPage * pagination.pageSize;
  const end = start + pagination.pageSize;
  const paginatedIds = result.matchedIds.slice(start, end);

  // 获取完整数据
  const creatorsMap = await creatorRepo.getCreators(paginatedIds);
  const creators = Array.from(creatorsMap.values());

  return {
    creators,
    total: result.matchedIds.length
  };
}

/**
 * 构建查询条件
 */
function buildQueryCondition(state: StatsState): any {
  const condition: any = {
    platform: state.platform
  };

  if (state.showFollowedOnly) {
    condition.isFollowing = true;
  }

  if (state.filters.includeTags.length > 0) {
    condition.includeTags = state.filters.includeTags;
  }

  if (state.filters.excludeTags.length > 0) {
    condition.excludeTags = state.filters.excludeTags;
  }

  return condition;
}
```

### 4.5 filter-manager.ts

```typescript
import type { StatsState, FilterState } from "./types.js";
import { resetFilters } from "./helpers.js";

/**
 * 添加包含标签
 */
export function addIncludeTag(state: StatsState, tagId: ID): void {
  if (!state.filters.includeTags.includes(tagId)) {
    state.filters.includeTags.push(tagId);
  }
}

/**
 * 移除包含标签
 */
export function removeIncludeTag(state: StatsState, tagId: ID): void {
  state.filters.includeTags = state.filters.includeTags.filter(id => id !== tagId);
}

/**
 * 添加排除标签
 */
export function addExcludeTag(state: StatsState, tagId: ID): void {
  if (!state.filters.excludeTags.includes(tagId)) {
    state.filters.excludeTags.push(tagId);
  }
}

/**
 * 移除排除标签
 */
export function removeExcludeTag(state: StatsState, tagId: ID): void {
  state.filters.excludeTags = state.filters.excludeTags.filter(id => id !== tagId);
}

/**
 * 清除所有筛选
 */
export function clearAllFilters(state: StatsState): void {
  resetFilters(state.filters);
}

/**
 * 检查是否有活动筛选
 */
export function hasActiveFilters(state: StatsState): boolean {
  return (
    state.filters.includeTags.length > 0 ||
    state.filters.excludeTags.length > 0 ||
    state.filters.includeCategories.length > 0 ||
    state.filters.excludeCategories.length > 0
  );
}
```

### 4.6 stats.ts

```typescript
import { Platform } from "../../database/types/base.js";
import { createInitialState, setLoading, setError } from "./helpers.js";
import { getAllTags, createTag } from "./tag-manager.js";
import { getAllCategories, createCategory } from "./category-manager.js";
import { getFilteredCreators } from "./up-list.js";
import { clearAllFilters } from "./filter-manager.js";
import type { StatsState, PaginationState } from "./types.js";

// 全局状态
let state: StatsState;
let pagination: PaginationState;

/**
 * 初始化统计页面
 */
export async function initStats(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  try {
    // 创建初始状态
    state = createInitialState(Platform.BILIBILI);
    pagination = createInitialPagination();

    // 绑定事件
    bindPageActions();
    bindInputs();

    // 加载数据
    await loadData();
  } catch (error) {
    console.error('[initStats] 初始化失败:', error);
    setError(state, error instanceof Error ? error.message : '未知错误');
  }
}

/**
 * 加载数据
 */
async function loadData(): Promise<void> {
  setLoading(state, true);

  try {
    // 并行加载所有数据
    await Promise.all([
      renderTagList(),
      renderCategories(),
      renderUpList()
    ]);
  } catch (error) {
    console.error('[loadData] 加载数据失败:', error);
    setError(state, error instanceof Error ? error.message : '加载失败');
  } finally {
    setLoading(state, false);
  }
}

/**
 * 渲染标签列表
 */
async function renderTagList(): Promise<void> {
  const tags = await getAllTags();
  // 渲染逻辑
}

/**
 * 渲染分类列表
 */
async function renderCategories(): Promise<void> {
  const categories = await getAllCategories();
  // 渲染逻辑
}

/**
 * 渲染 UP 列表
 */
async function renderUpList(): Promise<void> {
  const { creators, total } = await getFilteredCreators(state, pagination);
  // 渲染逻辑
}

/**
 * 绑定页面操作
 */
function bindPageActions(): void {
  // 绑定添加标签按钮
  const addTagBtn = document.getElementById('btn-add-tag');
  addTagBtn?.addEventListener('click', async () => {
    const tagName = prompt('请输入标签名称:');
    if (tagName) {
      await createTag(tagName);
      await renderTagList();
    }
  });

  // 绑定添加分类按钮
  const addCategoryBtn = document.getElementById('btn-add-category');
  addCategoryBtn?.addEventListener('click', async () => {
    const categoryName = prompt('请输入分类名称:');
    if (categoryName) {
      await createCategory(categoryName);
      await renderCategories();
    }
  });

  // 绑定清除筛选按钮
  const clearFilterBtn = document.getElementById('btn-clear-filter');
  clearFilterBtn?.addEventListener('click', () => {
    clearAllFilters(state);
    renderUpList();
  });
}

/**
 * 绑定输入事件
 */
function bindInputs(): void {
  // 绑定搜索框
  const searchInput = document.getElementById('up-search');
  searchInput?.addEventListener('input', debounce(() => {
    renderUpList();
  }, 300));

  // 绑定关注筛选开关
  const followToggle = document.getElementById('show-followed-toggle');
  followToggle?.addEventListener('change', (e) => {
    state.showFollowedOnly = (e.target as HTMLInputElement).checked;
    renderUpList();
  });
}

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 页面加载完成后自动初始化
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void initStats());
  } else {
    void initStats();
  }
}
```

## 五、实施步骤

### 阶段一：准备工作
1. 阅读 REFACTOR_PLAN.md 理解整体架构
2. 备份当前代码（可选）
3. 确认数据库模块已正确初始化

### 阶段二：类型定义重构
1. 更新 types.ts
   - 添加 TagInfo 接口
   - 添加 CategoryInfo 接口
   - 扩展 StatsState 接口
   - 添加 PaginationState 接口

### 阶段三：辅助函数重构
1. 更新 helpers.ts
   - 实现 createInitialState
   - 实现 createEmptyFilters
   - 实现 resetFilters
   - 实现 createInitialPagination
   - 实现 setLoading 和 setError

### 阶段四：数据管理器重构
1. 重构 tag-manager.ts
   - 集成 TagRepository
   - 实现标签查询功能
   - 实现标签创建功能
   - 实现标签搜索功能

2. 重构 category-manager.ts
   - 集成 CategoryRepository
   - 实现分类查询功能
   - 实现分类创建功能
   - 实现分类标签管理功能

3. 重构 up-list.ts
   - 集成 CreatorRepository 和 QueryService
   - 实现筛选查询功能
   - 实现分页功能
   - 实现数据渲染功能

4. 重构 filter-manager.ts
   - 实现筛选状态管理
   - 实现筛选条件应用
   - 实现筛选清除功能

### 阶段五：主入口重构
1. 更新 stats.ts
   - 实现初始化流程
   - 实现数据加载流程
   - 实现事件绑定
   - 实现错误处理

### 阶段六：测试与优化
1. 功能测试
   - 测试标签管理功能
   - 测试分类管理功能
   - 测试筛选功能
   - 测试 UP 列表渲染
   - 测试分页功能

2. 性能优化
   - 验证缓存机制
   - 优化查询性能
   - 优化渲染性能

3. 错误处理
   - 添加错误提示
   - 添加加载状态
   - 添加异常捕获

## 六、注意事项

### 6.1 数据访问规范
- 所有数据操作必须通过 Repository 层
- 不要直接访问 IndexedDB
- 充分利用缓存机制

### 6.2 错误处理
- 所有异步操作必须有错误处理
- 使用 try-catch 捕获异常
- 向用户展示友好的错误信息

### 6.3 性能优化
- 使用防抖处理搜索输入
- 批量操作减少数据库访问
- 合理使用分页避免一次性加载过多数据

### 6.4 类型安全
- 充分利用 TypeScript 类型系统
- 避免使用 any 类型
- 确保类型定义与数据库一致

## 七、常见问题

### Q1: 如何处理数据加载失败？
A: 使用 try-catch 捕获异常，通过 setError 设置错误状态，在 UI 中显示错误信息。

### Q2: 如何优化大量数据的渲染性能？
A: 使用分页加载，虚拟滚动等技术，避免一次性渲染过多 DOM 元素。

### Q3: 如何确保数据一致性？
A: 所有数据修改操作通过 Repository 层，Repository 会自动更新缓存和数据库。

### Q4: 如何处理筛选逻辑？
A: 使用 QueryService 构建查询条件，利用其提供的筛选功能。

## 八、参考文档

- [数据库模块使用指南](../../database/README.md)
- [Repository 层职责说明](../../database/repositories/README.md)
- [Query-Server 架构说明](../../database/query-server/README.md)on bindInputs(): void {
  // 绑定搜索框
  const searchInput = document.getElementById('up-search');
  searchInput?.addEventListener('input', (e) => {
    // 处理搜索
  });

  // 绑定关注切换
  const followToggle = document.getElementById('show-followed-toggle');
  followToggle?.addEventListener('change', (e) => {
    state.showFollowedOnly = (e.target as HTMLInputElement).checked;
    renderUpList();
  });
}
```

## 五、实施步骤

### 阶段一：基础重构（优先级：高）

1. **更新类型定义**
   - 修改 types.ts，与数据库类型对齐
   - 添加新的接口定义

2. **重构 helpers.ts**
   - 实现状态管理工具函数
   - 添加加载状态和错误处理

3. **重构 tag-manager.ts**
   - 集成 TagRepository
   - 实现基础标签操作

### 阶段二：核心功能（优先级：高）

1. **重构 category-manager.ts**
   - 集成 CategoryRepository
   - 实现分类管理功能

2. **重构 up-list.ts**
   - 集成 CreatorRepository 和 QueryService
   - 实现筛选和分页

3. **重构 filter-manager.ts**
   - 实现筛选逻辑
   - 添加筛选状态管理

### 阶段三：页面集成（优先级：中）

1. **重构 stats.ts**
   - 整合所有模块
   - 实现事件绑定
   - 添加错误处理

2. **更新 HTML 结构**
   - 确保与新的数据流对齐
   - 添加加载状态显示

### 阶段四：优化和完善（优先级：低）

1. 性能优化
   - 实现虚拟滚动
   - 优化缓存策略

2. 用户体验改进
   - 添加加载动画
   - 改进错误提示

3. 测试和修复
   - 功能测试
   - 性能测试

## 六、注意事项

1. **数据访问原则**
   - 所有数据操作通过 Repository 层
   - 不要直接访问 IndexedDB
   - 利用缓存机制提高性能

2. **错误处理**
   - 所有异步操作都要有错误处理
   - 提供用户友好的错误提示
   - 记录错误日志

3. **性能优化**
   - 批量操作优于单个操作
   - 合理使用缓存
   - 避免不必要的数据库查询

4. **类型安全**
   - 充分利用 TypeScript 类型系统
   - 确保类型定义与数据库一致
   - 避免使用 any 类型

