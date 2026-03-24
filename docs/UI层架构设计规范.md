好的,我将为您输出更新后的UI层架构设计规范的完整内容:

```markdown
# UI层架构设计规范

## 1. 概述

本文档定义了UI层的架构设计规范。UI层负责用户界面的渲染和交互,通过调用查询层获取数据,实现页面展示和用户操作响应。UI层不直接访问数据库或缓存,所有数据访问都通过查询层进行。

### 1.1 架构目标

- **职责分离**:UI层专注于界面渲染和用户交互,数据访问由查询层负责
- **可维护性**:清晰的代码组织结构,便于维护和扩展
- **可测试性**:模块化设计,便于单元测试
- **性能优化**:通过合理的渲染策略和事件处理优化性能

### 1.2 架构层次

```
┌─────────────────────────────────────┐
│         应用层 (app)                 │
│  - UI渲染                            │
│  - 用户交互                          │
│  - 业务流程控制                      │
└──────────────┬──────────────────────┘
               │ 调用查询层
┌──────────────▼──────────────────────┐
│         查询层 (query)               │
│  - 数据查询                          │
│  - 复杂业务逻辑                      │
│  - 缓存管理                          │
└─────────────────────────────────────┘
```

## 2. 目录结构

```
src/ui/
├── [page-name]/
│   ├── app/                    # 应用层
│   │   ├── [page-name].ts      # 页面主入口
│   │   ├── types.ts            # 类型定义
│   │   ├── [feature]-manager.ts # 功能管理器
│   │   ├── [feature]-list.ts   # 列表渲染
│   │   ├── helpers.ts          # 辅助函数
│   │   └── dom.ts              # DOM操作工具
│   └── README.md               # 页面说明文档
```

## 3. 应用层(app)

### 3.1 职责

- UI渲染和DOM操作
- 用户事件处理
- 页面状态管理
- 调用查询层获取数据

### 3.2 能力边界

**可以做的:**
- UI组件的创建和渲染
- 用户交互事件的处理
- 页面状态的维护
- 调用查询层接口获取数据

**不可以做的:**
- 直接访问数据库实现层
- 直接访问IndexedDB
- 实现复杂的数据查询逻辑
- 管理缓存数据

### 3.3 文件命名规范

| 文件类型 | 命名模式 | 示例 |
|---------|---------|------|
| 页面主入口 | [page-name].ts | favorites.ts |
| 类型定义 | types.ts | types.ts |
| 功能管理器 | [feature]-manager.ts | collection-manager.ts |
| 列表渲染 | [feature]-list.ts | video-list.ts |
| 辅助函数 | helpers.ts | helpers.ts |
| DOM操作 | dom.ts | dom.ts |
| 页面操作 | page-actions.ts | page-actions.ts |

### 3.4 模块设计原则

1. **单一职责**:每个模块只负责一个特定的功能领域
2. **低耦合**:模块之间通过明确的接口进行交互
3. **高内聚**:相关功能组织在同一个模块中
4. **可测试性**:模块设计应便于单元测试

### 3.5 类型定义规范

```typescript
// types.ts

/**
 * 页面状态
 * 定义页面的完整状态结构
 */
export interface [PageName]State {
  // 状态字段
}

/**
 * 过滤器状态
 * 定义查询过滤条件
 */
export interface FilterState {
  // 过滤字段
}

/**
 * 业务实体
 * 定义业务领域相关的数据结构
 */
export interface [EntityName] {
  // 实体字段
}
```

### 3.6 页面主入口示例

```typescript
// [page-name].ts

import { [PageName]State } from "./types.js";
import { executeQuery, getVideos } from "../../query/index.js";
import { renderVideos } from "./[feature]-list.js";
import { bindEvents } from "./dom.js";

/**
 * 页面主入口
 */
export class [PageName] {
  private state: [PageName]State;
  private elements: PageElements;

  constructor() {
    this.state = this.initializeState();
    this.elements = this.initializeElements();
  }

  /**
   * 初始化页面
   */
  async initialize(): Promise<void> {
    await this.loadInitialData();
    this.render();
    this.bindEvents();
  }

  /**
   * 加载初始数据
   */
  private async loadInitialData(): Promise<void> {
    try {
      const result = await executeQuery({
        page: 0,
        pageSize: 10,
        filters: this.state.filters
      });

      const videos = await getVideos(result.videoIds);
      this.state.videos = videos;
    } catch (error) {
      console.error("[PageName] Load data error:", error);
      showError("加载数据失败", this.elements);
    }
  }

  /**
   * 渲染页面
   */
  private render(): void {
    renderVideos(this.state.videos, this.elements);
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    bindEvents(this.state, this.elements);
  }

  /**
   * 初始化状态
   */
  private initializeState(): [PageName]State {
    return {
      // 初始状态
    };
  }

  /**
   * 初始化元素
   */
  private initializeElements(): PageElements {
    return {
      // DOM元素
    };
  }
}
```

## 4. 层间交互规范

### 4.1 重要原则

**应用层数据访问原则:**
- 应用层所有数据获取必须通过查询层实现
- 应用层禁止直接访问数据库实现层
- 应用层禁止直接访问IndexedDB
- 应用层禁止直接操作缓存层

**查询层职责:**
- 查询层是唯一可以访问数据库实现层的代码层
- 查询层负责所有缓存管理工作
- 查询层为应用层提供统一的数据访问接口

### 4.2 应用层 → 查询层

应用层只能通过查询层提供的接口获取数据,这是应用层获取数据的唯一途径。

```typescript
// app/[page-name].ts
import { executeQuery, getVideos } from "../../query/index.js";

// ✅ 正确:通过查询层获取数据
const result = await executeQuery({
  page: 0,
  pageSize: 10,
  filters: state.filters
});

const videos = await getVideos(result.videoIds);

// ❌ 错误:禁止直接访问数据库实现层
// import { VideoRepository } from "../../database/implementations/video-repository.impl.js";
// const videoRepository = new VideoRepository();

// ❌ 错误:禁止直接访问IndexedDB
// import { DBUtils } from "../../database/indexeddb/index.js";

// ❌ 错误:禁止直接操作缓存
// import { videoIndexCache } from "../../cache/index.js";
```

### 4.3 禁止的交互模式

以下交互模式是严格禁止的:

```typescript
// ❌ 应用层直接访问数据库实现层
// app/[page-name].ts
// import { VideoRepository } from "../../database/implementations/video-repository.impl.js";
// const repository = new VideoRepository();
// const videos = await repository.getVideos([...]);

// ❌ 应用层直接访问IndexedDB
// app/[page-name].ts
// import { DBUtils } from "../../database/indexeddb/index.js";
// const data = await DBUtils.get(STORE_NAMES.VIDEOS, id);

// ❌ 应用层直接操作缓存
// app/[page-name].ts
// import { videoIndexCache } from "../../cache/index.js";
// videoIndexCache.addBatch([...]);

// ❌ 应用层直接调用chrome.runtime.sendMessage访问数据
// app/[page-name].ts
// const response = await chrome.runtime.sendMessage({
//   type: "get_videos",
//   payload: { ... }
// });
```

### 4.4 正确的数据访问流程

```
应用层
  ↓
  调用查询层接口(executeQuery、getVideos等)
  ↓
查询层
  ├─ 检查缓存
  ├─ 缓存未命中则访问数据库实现层
  ├─ 更新缓存
  └─ 返回数据
  ↓
应用层接收数据并渲染UI
```

## 5. 数据流规范

### 5.1 数据加载流程

```
1. 应用层发起数据请求
   ↓
2. 查询层检查缓存
   ├─ 缓存命中 → 返回缓存数据
   └─ 缓存未命中 ↓
3. 查询层从数据库加载数据
   ↓
4. 查询层更新缓存
   ↓
5. 查询层返回数据给应用层
   ↓
6. 应用层渲染UI
```

### 5.2 数据更新流程

```
1. 应用层接收用户操作
   ↓
2. 应用层调用查询层更新接口
   ↓
3. 查询层更新数据库
   ↓
4. 查询层更新缓存
   ↓
5. 查询层返回结果
   ↓
6. 应用层刷新UI
```

## 6. 错误处理规范

### 6.1 应用层错误处理

```typescript
try {
  await loadCollectionData(state);
  await renderVideos(state, elements);
} catch (error) {
  console.error("[PageName] Error:", error);
  showError("加载数据失败", elements);
}
```

## 7. 性能优化规范

### 7.1 渲染优化

1. **懒加载**:图片等资源懒加载
2. **防抖节流**:频繁操作使用防抖节流
3. **增量更新**:只更新变化的部分

## 8. 代码组织规范

### 8.1 代码组织

1. 按功能模块组织代码
2. 保持文件大小适中(<500行)
3. 避免循环依赖
4. 使用明确的导出和导入

### 8.2 命名规范

1. 使用有意义的名称
2. 遵循一致的命名风格
3. 避免缩写和简写
4. 使用动词+名词的函数命名

### 8.3 类型安全

1. 为所有函数定义明确的类型
2. 使用接口定义复杂数据结构
3. 避免使用any类型
4. 使用类型守卫确保类型安全

### 8.4 错误处理

1. 明确错误类型
2. 提供有意义的错误信息
3. 记录错误日志
4. 实现错误恢复机制

## 9. 附录

### 9.1 术语表

| 术语 | 定义 |
|-----|------|
| 应用层 | 负责UI渲染和用户交互的代码层 |
| 查询层 | 负责数据查询和缓存管理的代码层 |
| 缓存层 | 负责缓存数据存储和检索的代码层 |
```
