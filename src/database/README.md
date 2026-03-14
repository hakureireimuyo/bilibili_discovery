# Database 模块说明

## 概述

本模块负责管理 Bilibili Discovery 系统的所有数据存储和访问，基于 IndexedDB 实现。模块设计遵循以下原则：

1. **数据结构独立** - 每个数据结构单独一个文件
2. **接口规范分离** - 数据结构定义和接口实现分开存储
3. **职责明确** - 每个接口都有清晰的职责和能力边界
4. **可扩展性** - 支持未来功能扩展

## 目录结构

```
database/
├── types/              # 数据结构定义
│   ├── base.ts        # 基础类型定义
│   ├── creator.ts     # 创作者数据结构
│   ├── video.ts       # 视频数据结构
│   ├── behavior.ts    # 行为数据结构
│   ├── semantic.ts    # 语义数据结构
│   ├── note.ts        # 笔记数据结构
│   ├── collection.ts  # 收藏数据结构
│   ├── analytics.ts   # 分析数据结构
│   └── index.ts       # 类型统一导出
├── interfaces/         # 接口规范定义
│   ├── creator/       # 创作者接口
│   ├── video/         # 视频接口
│   ├── behavior/      # 行为接口
│   ├── semantic/      # 语义接口
│   ├── note/          # 笔记接口
│   ├── collection/    # 收藏接口
│   ├── analytics/     # 分析接口
│   └── index.ts       # 接口统一导出
├── implementations/    # 接口实现
│   ├── tag-repository.impl.ts
│   ├── category-repository.impl.ts
│   ├── creator-repository.impl.ts
│   ├── video-repository.impl.ts
│   ├── collection-repository.impl.ts
│   ├── collection-item-repository.impl.ts
│   ├── interest-score-repository.impl.ts
│   ├── watch-event-repository.impl.ts
│   ├── interaction-event-repository.impl.ts
│   ├── search-event-repository.impl.ts
│   ├── video-note-repository.impl.ts
│   ├── note-segment-repository.impl.ts
│   ├── knowledge-entry-repository.impl.ts
│   └── index.ts       # 实现统一导出
├── indexeddb/         # IndexedDB 基础设施
│   ├── config.ts       # 数据库配置
│   ├── db-manager.ts   # 数据库管理器
│   ├── db-utils.ts     # 数据库工具类
│   ├── USAGE.md       # 使用说明
│   └── index.ts       # 统一导出
└── README.md          # 本文件
```

## 数据层级

系统数据分为四个层级：

### 1. Content Layer（内容层）
- Creator（UP主/Channel）
- Video（视频基础信息）

### 2. Behavior Layer（行为数据层）
- WatchEvent（观看事件）
- InteractionEvent（互动行为）
- SearchEvent（搜索行为）

### 3. Semantic Layer（语义层）
- Tag（标签）
- TagAlias（标签映射）
- TagEmbedding（标签向量）
- Category（标签分区）

### 4. Notes Layer（笔记层）
- VideoNote（视频笔记）
- NoteSegment（笔记分段）
- NoteRelation（笔记关联）
- KnowledgeEntry（知识条目）

### 5. Collection Layer（收藏层）
- Collection（收藏夹）
- CollectionItem（收藏项）

### 6. Analytics Layer（分析层）
- InterestScore（兴趣分数）
- InterestNode（兴趣节点）
- InterestHistory（兴趣历史）
- CreatorRank（创作者排名）
- WatchTimeStats（观看时间统计）
- WatchTimeDistribution（观看时间分布）
- UserInterestProfile（用户兴趣画像）

## 使用方式

### 导入类型定义

```typescript
import { Creator, Video, WatchEvent } from '../database/types';
import { Platform, PaginationParams } from '../database/types';
```

### 导入接口定义

```typescript
import {
  ICreatorRepository,
  IVideoRepository,
  IWatchEventRepository
} from '../database/interfaces';
```

### 使用示例

```typescript
// 初始化数据库
import { dbManager } from '../database/indexeddb';
await dbManager.init();

// 导入实现类
import { CreatorRepository, VideoRepository } from '../database/implementations';

// 创建实例
const creatorRepo = new CreatorRepository();
const videoRepo = new VideoRepository();

// 创建创作者
const creator: Creator = {
  creatorId: '123456',
  platform: Platform.BILIBILI,
  name: 'UP主名称',
  avatar: '头像URL',
  isLogout: false,
  description: 'UP主简介',
  createdAt: Date.now(),
  followTime: Date.now(),
  isFollowing: true,
  tagWeights: []
};

await creatorRepo.upsertCreator(creator);

// 获取创作者
const creatorData = await creatorRepo.getCreator('123456', Platform.BILIBILI);

// 创建视频
const video: Video = {
  videoId: 'BV123456',
  platform: Platform.BILIBILI,
  creatorId: '123456',
  title: '视频标题',
  description: '视频描述',
  duration: 300,
  publishTime: Date.now(),
  tags: ['tag1', 'tag2'],
  createdAt: Date.now()
};

await videoRepo.upsertVideo(video);

// 获取视频
const videoData = await videoRepo.getVideo('BV123456', Platform.BILIBILI);
```

## 接口规范

每个接口都包含以下信息：

1. **方法签名** - 明确的输入输出类型
2. **职责说明** - 方法的主要职责
3. **能力边界** - 方法的限制和不处理的内容

示例：

```typescript
/**
 * 创建或更新创作者信息
 * 
 * @param creator - 创作者信息
 * @returns Promise<void>
 * 
 * 职责：
 * - 如果creatorId已存在则更新，否则创建新记录
 * - 自动设置createdAt和lastUpdate时间
 * - 验证必填字段
 * 
 * 能力边界：
 * - 不处理创作者的视频列表
 * - 不处理创作者的统计数据
 */
upsertCreator(creator: Creator): Promise<void>;
```

## 设计原则

1. **单一职责** - 每个接口只负责一类数据的操作
2. **明确边界** - 每个方法都有清晰的能力边界
3. **可测试性** - 接口设计便于单元测试
4. **可扩展性** - 支持未来功能扩展
5. **类型安全** - 完整的 TypeScript 类型定义

## 注意事项

1. 所有时间戳使用毫秒级时间戳
2. 所有 ID 为字符串类型
3. 批量操作有数量限制（通常为1000条）
4. 涉及分页的操作使用 PaginationParams
5. 时间范围查询使用 TimeRange
6. 平台类型使用 Platform 类型

## 从旧存储迁移

旧存储（`src/storage/storage.ts`）的功能已迁移到新数据库结构：

### 已迁移的功能

1. **标签库操作**
   - 创建标签
   - 获取标签
   - 搜索标签
   - 批量操作

2. **分区操作**
   - 创建分区
   - 管理分区标签
   - 获取分区树

3. **创作者操作**
   - 保存UP信息
   - 更新关注状态
   - 获取关注列表
   - 搜索创作者

4. **视频操作**
   - 保存视频信息
   - 获取视频列表
   - 按标签查询

5. **收藏操作**
   - 创建收藏夹
   - 添加/移除视频
   - 搜索收藏

6. **兴趣操作**
   - 更新兴趣分数
   - 获取兴趣统计

7. **行为记录**
   - 记录观看事件
   - 记录互动事件
   - 记录搜索事件

### 差异说明

1. **数据结构优化**
   - 新结构支持多平台
   - 更清晰的类型定义
   - 更完善的索引设计

2. **接口改进**
   - 分离接口定义和实现
   - 明确的能力边界
   - 完整的文档注释

3. **功能增强**
   - 支持分页查询
   - 批量操作优化
   - 更灵活的搜索

## 未来扩展

该数据结构设计支持以下未来功能：

- 多平台支持（B站/YouTube）
- AI 语义搜索
- 兴趣分析
- 标签合并
- 视频推荐
- 知识库管理
- LLM 对话
- 用户行为分析
- 兴趣星球可视化
