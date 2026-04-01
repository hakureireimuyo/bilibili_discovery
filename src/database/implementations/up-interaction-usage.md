# UP主交互数据使用指南

## 概述

UP主交互数据（UPInteraction）用于记录用户与UP主的所有互动行为，包括观看、点赞、投币、收藏和评论等。这个数据结构可以避免每次都需要从观看事件中聚合计算，提高性能。

## 数据结构

### UPInteraction

完整的UP主交互数据记录：

```typescript
interface UPInteraction {
  interactionId: ID;              // 交互记录唯一ID
  platform: Platform;             // 平台类型
  creatorId: ID;                // UP主ID
  totalWatchDuration: number;      // 总观看时长（秒）
  totalWatchCount: number;         // 总观看视频次数
  likeCount: number;              // 点赞次数
  coinCount: number;              // 投币次数
  favoriteCount: number;          // 收藏次数
  commentCount: number;           // 评论次数
  lastWatchTime: Timestamp;        // 上次观看该UP视频的时间
  firstWatchTime: Timestamp;       // 首次观看该UP视频的时间
  updateTime: Timestamp;         // 最后更新时间
}
```

### UPInteractionUpdate

用于增量更新UP主交互数据：

```typescript
interface UPInteractionUpdate {
  creatorId: ID;                // UP主ID
  watchDurationDelta?: number;     // 观看时长增量（秒）
  watchCountDelta?: number;        // 观看次数增量
  likeDelta?: number;             // 点赞次数增量
  coinDelta?: number;             // 投币次数增量
  favoriteDelta?: number;         // 收藏次数增量
  commentDelta?: number;          // 评论次数增量
  watchTime?: Timestamp;         // 更新观看时间
}
```

### UPStatSummary

用于UI展示的UP主统计信息：

```typescript
interface UPStatSummary {
  creatorId: ID;                // UP主ID
  totalWatchDuration: number;      // 总观看时长（秒）
  totalWatchCount: number;         // 总观看视频次数
  likeCount: number;              // 点赞次数
  coinCount: number;              // 投币次数
  favoriteCount: number;          // 收藏次数
  commentCount: number;           // 评论次数
  lastWatchTime: Timestamp;        // 上次观看时间
  firstWatchTime: Timestamp;       // 首次观看时间
  interactionRate?: number;       // 互动率（点赞+投币+收藏）/观看次数
  avgWatchDuration?: number;       // 平均观看时长（秒）
}
```

## 使用方法

### 1. 初始化Repository

```typescript
import { UPInteractionRepositoryImpl } from '../database/implementations/index.js';

const upInteractionRepo = new UPInteractionRepositoryImpl();
```

### 2. 记录观看事件

当用户观看UP主的视频时，更新观看数据：

```typescript
await upInteractionRepo.recordWatch(
  creatorId,      // UP主ID
  watchDuration,   // 观看时长（秒）
  Date.now()       // 观看时间
);
```

### 3. 记录互动事件

```typescript
// 点赞
await upInteractionRepo.recordLike(creatorId);

// 投币
await upInteractionRepo.recordCoin(creatorId);

// 收藏
await upInteractionRepo.recordFavorite(creatorId);

// 评论
await upInteractionRepo.recordComment(creatorId);
```

### 4. 获取UP主统计数据

```typescript
// 获取单个UP主的交互数据
const interaction = await upInteractionRepo.getInteraction(creatorId);

// 获取多个UP主的交互数据
const interactions = await upInteractionRepo.getInteractions([creatorId1, creatorId2]);

// 获取指定平台的所有UP主交互数据
const allInteractions = await upInteractionRepo.getAllByPlatform(Platform.BILIBILI);
```

### 5. 获取Top列表

```typescript
// 按观看时长排序的Top 10
const topByDuration = await upInteractionRepo.getTopByWatchDuration(
  Platform.BILIBILI,
  10
);

// 按观看次数排序的Top 10
const topByCount = await upInteractionRepo.getTopByWatchCount(
  Platform.BILIBILI,
  10
);

// 按互动率排序的Top 10（包含计算后的统计信息）
const topByRate = await upInteractionRepo.getTopByInteractionRate(
  Platform.BILIBILI,
  10
);
```

### 6. 获取最近观看的UP主

```typescript
const recentlyWatched = await upInteractionRepo.getRecentlyWatched(
  Platform.BILIBILI,
  10
);
```

### 7. 增量更新数据

```typescript
await upInteractionRepo.updateInteraction({
  creatorId: 123456,
  watchDurationDelta: 1800,  // 增加30分钟
  watchCountDelta: 1,         // 增加1次观看
  likeDelta: 1,              // 增加1个点赞
  watchTime: Date.now()        // 更新观看时间
});
```

### 8. 批量更新

```typescript
const updates: UPInteractionUpdate[] = [
  {
    creatorId: 123456,
    watchDurationDelta: 1800,
    watchCountDelta: 1
  },
  {
    creatorId: 234567,
    likeDelta: 1
  }
];

await upInteractionRepo.updateInteractions(updates);
```

## 性能优化建议

1. **批量操作**：使用批量更新方法（updateInteractions）而不是多次调用单个更新方法

2. **索引使用**：
   - `creatorId`：用于快速查询单个UP主
   - `platform`：用于按平台筛选
   - `totalWatchDuration`：用于按观看时长排序
   - `lastWatchTime`：用于获取最近观看的UP主

3. **避免聚合查询**：直接使用UPInteraction数据，而不是从WatchEvent中聚合

4. **合理使用Top查询**：使用专门的Top查询方法，而不是获取全部数据后在内存中排序

## 集成到观看统计页面

在观看统计页面中，可以这样使用：

```typescript
// 获取按观看时长排序的Top 10 UP主
const topUPs = await upInteractionRepo.getTopByWatchDuration(
  Platform.BILIBILI,
  10
);

// 获取UP主信息
const upInfoMap = await creatorRepo.getCreators(
  topUPs.map(up => up.creatorId)
);

// 转换为UI所需格式
const upStats: UPStat[] = topUPs.map(up => ({
  mid: up.creatorId,
  totalWatchDuration: up.totalWatchDuration,
  totalWatchCount: up.totalWatchCount,
  likeCount: up.likeCount,
  coinCount: up.coinCount,
  favoriteCount: up.favoriteCount,
  commentCount: up.commentCount,
  lastWatchTime: up.lastWatchTime,
  interactionRate: (up.likeCount + up.coinCount + up.favoriteCount) / up.totalWatchCount,
  avgWatchDuration: up.totalWatchDuration / up.totalWatchCount,
  info: upInfoMap.find(info => info.creatorId === up.creatorId)
}));

// 更新UI
window.watchStatsPage.updateUPList(upStats);
```

## 注意事项

1. **数据一致性**：确保在记录观看事件时同步更新UPInteraction数据
2. **增量更新**：使用增量更新方法而不是直接修改完整数据
3. **错误处理**：处理UP主不存在的情况
4. **性能考虑**：避免频繁的数据库操作，合理使用批量更新
5. **主题切换**：UI组件已集成主题系统，无需手动处理
