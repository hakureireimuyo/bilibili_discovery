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
│   ├── creator.interface.ts
│   ├── video.interface.ts
│   ├── behavior.interface.ts
│   ├── semantic.interface.ts
│   ├── note.interface.ts
│   ├── collection.interface.ts
│   ├── analytics.interface.ts
│   └── index.ts       # 接口统一导出
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
// 创建创作者
const creator: Creator = {
  creatorId: '123456',
  platform: 'bilibili',
  name: 'UP主名称',
  avatar: '头像URL',
  isLogout: false,
  description: 'UP主简介',
  createdAt: Date.now(),
  followTime: Date.now(),
  isFollowing: true,
  tagWeights: []
};

// 使用接口操作
await creatorRepository.upsertCreator(creator);
const creatorData = await creatorRepository.getCreator('123456', 'bilibili');
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
