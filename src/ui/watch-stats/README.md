# 观看统计页面

## 概述

观看统计页面用于展示用户的观看行为统计数据，包括观看时长、热力图、趋势图以及UP主和视频的排行。

## 功能特性

### 统计卡片
- 总观看时长
- 今日观看时长
- 近7天观看时长
- 统计更新时间

### 可视化图表
- 月度观看热力图：展示每日观看时长的热力分布
- 近7天趋势折线图：展示最近一周的观看趋势

### 排行列表
- UP主时长Top 10：展示观看时长最长的10位UP主
- 视频时长Top 10：展示观看时长最长的10个视频

## 组件结构

```
watch-stats/
├── components/          # 页面特定组件（待扩展）
├── watch-stats.html    # 页面HTML
├── watch-stats.css     # 页面样式
├── watch-stats.ts      # 页面主逻辑
├── types.ts           # 类型定义
├── index.ts          # 导出文件
└── README.md         # 说明文档
```

## 使用方法

### 初始化页面

页面会在加载时自动初始化，无需手动调用。

### 更新数据

页面实例暴露在全局变量 `window.watchStatsPage` 中，可以通过以下方法更新数据：

```typescript
// 更新统计数据
const statsData: WatchStatsData = {
  totalSeconds: 3600,
  dailySeconds: {
    '2024-01-01': 1800,
    '2024-01-02': 1800
  },
  upSeconds: {
    '123456': 3600
  },
  videoSeconds: {
    'BV1xx411c7mD': 3600
  },
  lastUpdate: Date.now()
};

window.watchStatsPage.updateStats(statsData);

// 更新UP主列表
const upStats: UPStat[] = [
  {
    mid: 123456,
    seconds: 3600,
    info: {
      mid: 123456,
      name: 'UP主名称',
      face: 'https://example.com/avatar.jpg'
    }
  }
];

window.watchStatsPage.updateUPList(upStats);

// 更新视频列表
const videoStats: VideoStat[] = [
  {
    bvid: 'BV1xx411c7mD',
    seconds: 3600,
    info: {
      bvid: 'BV1xx411c7mD',
      title: '视频标题',
      duration: 600
    }
  }
];

window.watchStatsPage.updateVideoList(videoStats);
```

## 数据类型

### WatchStatsData

观看统计数据类型：

```typescript
interface WatchStatsData {
  totalSeconds: number;           // 总观看时长（秒）
  dailySeconds: Record<string, number>;  // 每日观看时长映射
  upSeconds: Record<string, number>;     // UP主观看时长映射
  videoSeconds: Record<string, number>;   // 视频观看时长映射
  lastUpdate: number;             // 最后更新时间戳
}
```

### UPStat

UP主统计数据类型：

```typescript
interface UPStat {
  mid: number;          // UP主ID
  seconds: number;      // 观看时长（秒）
  info?: UPInfo;       // UP主信息
}
```

### VideoStat

视频统计数据类型：

```typescript
interface VideoStat {
  bvid: string;        // 视频ID (BV号)
  seconds: number;     // 观看时长（秒）
  info?: VideoInfo;   // 视频信息
}
```

## 主题集成

页面完全集成了项目的主题系统，使用CSS变量定义颜色和样式：

- `--theme-primary`: 主色调
- `--theme-secondary`: 次要色调
- `--theme-accent`: 强调色
- `--theme-bg-primary`: 主背景色
- `--theme-bg-secondary`: 次要背景色
- `--theme-text-primary`: 主文本色
- `--theme-text-secondary`: 次要文本色
- 等等...

页面会自动响应主题切换，无需手动处理。

## 响应式设计

页面支持多种屏幕尺寸：

- 桌面端：多列布局
- 平板端：双列布局
- 移动端：单列布局

## 注意事项

1. 页面仅负责UI渲染和交互，不涉及数据库调用
2. 数据通过全局实例的更新方法传入
3. 所有统计数据的计算和聚合应在数据层完成
4. 页面会自动处理主题切换和响应式布局

## 未来扩展

- 添加更多可视化图表
- 支持自定义时间范围
- 添加数据导出功能
- 支持更多交互和筛选
