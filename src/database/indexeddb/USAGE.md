# IndexedDB 模块使用说明

## 概述

本模块提供了基于 IndexedDB 的数据库操作功能，包括：
- 数据库初始化和管理
- 通用的 CRUD 操作
- 索引查询
- 批量操作
- 事务管理

## 基本使用

### 1. 初始化数据库

```typescript
import { dbManager } from '../database/indexeddb';

// 初始化数据库
const db = await dbManager.init();
```

### 2. 使用 DBUtils 进行基本操作

```typescript
import { DBUtils, STORE_NAMES } from '../database/indexeddb';

// 添加数据
await DBUtils.add(STORE_NAMES.CREATORS, creatorData);

// 获取数据
const creator = await DBUtils.get<Creator>(STORE_NAMES.CREATORS, creatorId);

// 更新数据
await DBUtils.put(STORE_NAMES.CREATORS, updatedCreatorData);

// 删除数据
await DBUtils.delete(STORE_NAMES.CREATORS, creatorId);
```

## 高级操作

### 1. 批量操作

```typescript
// 批量添加
await DBUtils.addBatch(STORE_NAMES.VIDEOS, videos);

// 批量更新
await DBUtils.putBatch(STORE_NAMES.VIDEOS, updatedVideos);

// 批量删除
await DBUtils.deleteBatch(STORE_NAMES.VIDEOS, videoIds);
```

### 2. 索引查询

```typescript
// 使用索引查询
const videos = await DBUtils.getByIndex<Video>(
  STORE_NAMES.VIDEOS,
  'creatorId',
  creatorId
);

// 使用索引范围查询
const timeRange = IDBKeyRange.bound(startTime, endTime);
const watchEvents = await DBUtils.getByIndexRange<WatchEvent>(
  STORE_NAMES.WATCH_EVENTS,
  'watchTime',
  timeRange
);
```

### 3. 游标遍历

```typescript
// 遍历所有数据
await DBUtils.cursor<Creator>(
  STORE_NAMES.CREATORS,
  (creator, cursor) => {
    console.log(creator);
    // 返回 false 停止遍历
    return true;
  }
);

// 使用索引遍历
await DBUtils.cursor<Video>(
  STORE_NAMES.VIDEOS,
  (video, cursor) => {
    console.log(video);
    return true;
  },
  'publishTime',  // 索引名称
  IDBKeyRange.lowerBound(Date.now() - 86400000),  // 最近一天
  'prev'  // 降序
);
```

### 4. 计数操作

```typescript
// 计算总数
const count = await DBUtils.count(STORE_NAMES.VIDEOS);

// 使用索引计数
const count = await DBUtils.countByIndex(
  STORE_NAMES.VIDEOS,
  'creatorId',
  creatorId
);
```

## 实现接口示例

### CreatorRepository 实现

```typescript
import { ICreatorRepository } from '../interfaces/creator.interface';
import { DBUtils, STORE_NAMES } from '../indexeddb';
import { Creator } from '../types/creator';

class CreatorRepository implements ICreatorRepository {
  async upsertCreator(creator: Creator): Promise<void> {
    await DBUtils.put(STORE_NAMES.CREATORS, creator);
  }

  async getCreator(creatorId: string, platform: Platform): Promise<Creator | null> {
    // 使用复合查询
    const creators = await DBUtils.getByIndex<Creator>(
      STORE_NAMES.CREATORS,
      'creatorId',
      creatorId
    );
    return creators.find(c => c.platform === platform) || null;
  }

  // ... 其他方法实现
}
```

## 注意事项

1. **事务管理**
   - 所有写操作都在 'readwrite' 事务中执行
   - 读操作在 'readonly' 事务中执行
   - 事务在操作完成后自动提交

2. **错误处理**
   - 所有操作都应该进行错误处理
   - 使用 try-catch 捕获异常

3. **性能优化**
   - 批量操作使用批量方法
   - 合理使用索引
   - 避免在循环中执行数据库操作

4. **数据一致性**
   - 批量操作会自动回滚
   - 使用游标遍历时注意事务超时

## 常见场景

### 1. 分页查询

```typescript
async function getPaginatedData(
  storeName: string,
  page: number,
  pageSize: number
): Promise<T[]> {
  const allData = await DBUtils.getAll<T>(storeName);
  const start = page * pageSize;
  const end = start + pageSize;
  return allData.slice(start, end);
}
```

### 2. 条件查询

```typescript
async function queryByCondition(
  storeName: string,
  indexName: string,
  condition: (item: T) => boolean
): Promise<T[]> {
  const results: T[] = [];
  await DBUtils.cursor<T>(
    storeName,
    (item) => {
      if (condition(item)) {
        results.push(item);
      }
      return true;
    },
    indexName
  );
  return results;
}
```

### 3. 数据聚合

```typescript
async function aggregateByIndex<T>(
  storeName: string,
  indexName: string,
  aggregator: Map<string, T[]>
): Promise<Map<string, T[]>> {
  await DBUtils.cursor<T>(
    storeName,
    (item) => {
      const key = item[indexName];
      if (!aggregator.has(key)) {
        aggregator.set(key, []);
      }
      aggregator.get(key)!.push(item);
      return true;
    },
    indexName
  );
  return aggregator;
}
```

## 数据库版本管理

当需要修改数据库结构时：

1. 递增 `DB_VERSION`
2. 在 `db-manager.ts` 的 `createObjectStores` 方法中添加新存储或索引
3. 处理数据迁移（如需要）

```typescript
// config.ts
export const DB_VERSION = 2;  // 从 1 增加到 2

// db-manager.ts
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  const oldVersion = event.oldVersion;

  // 创建新存储
  if (oldVersion < 2) {
    // 新增的存储创建逻辑
  }
};
```
