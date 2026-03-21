
# 收藏同步模块 (favorite-sync)

## 职责

负责从B站同步收藏数据到本地数据库，包括：
- 从B站API获取收藏视频列表
- 获取视频详细信息（标题、描述、时长、标签等）
- 确保UP主和标签数据存在
- 将视频数据保存到本地数据库
- 将视频添加到收藏夹
- 提供收藏视频搜索功能

## 设计原则

1. **依赖注入**：通过构造函数注入所有依赖，不直接创建实例
2. **配置驱动**：将可配置项提取为配置对象，支持自定义
3. **接口隔离**：定义清晰的数据源接口，支持不同数据源适配
4. **职责分离**：
   - `types.ts`：类型定义
   - `config.ts`：配置管理
   - `data-converters.ts`：数据转换
   - `data-adapters.ts`：数据源适配
   - `favorite-sync-service.ts`：核心业务逻辑

## 使用示例

```typescript
import { FavoriteSyncService, BiliApiVideoDataSource, BiliApiFavoriteDataSource } from "./favorite-sync/index.js";
import { VideoRepository, CollectionRepository, CollectionItemRepository, CreatorRepository, TagRepository } from "../../database/implementations/index.js";
import { getVideoDetail, getVideoTagsDetail, getAllFavoriteVideos } from "../../api/bili-api.js";

// 创建数据源适配器
const videoDataSource = new BiliApiVideoDataSource(getVideoDetail, getVideoTagsDetail);
const favoriteDataSource = new BiliApiFavoriteDataSource(getAllFavoriteVideos);

// 创建依赖对象
const dependencies = {
  videoDataSource,
  favoriteDataSource,
  videoRepository: new VideoRepository(),
  collectionRepository: new CollectionRepository(),
  collectionItemRepository: new CollectionItemRepository(),
  creatorRepository: new CreatorRepository(),
  tagRepository: new TagRepository()
};

// 创建服务实例
const service = new FavoriteSyncService(dependencies, {
  batchSize: 20
});

// 同步收藏视频
const result = await service.syncFavoriteVideos(userId);
console.log(`Synced ${result.syncedCount} videos`);

// 搜索收藏视频
const videos = await service.searchFavoriteVideos({
  keyword: "前端",
  tagId: "123"
});
```

## 数据流

```
API层 (bili-api.ts)
    ↓
数据源适配器 (data-adapters.ts)
    ↓
业务逻辑层 (favorite-sync-service.ts)
    ↓
数据转换层 (data-converters.ts)
    ↓
数据库实现层 (database/implementations)
```
