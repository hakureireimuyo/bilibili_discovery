
# 主题示例页面

## 概述

主题示例页面展示了如何在其他页面中使用主题管理器，实现主题切换功能。这个页面演示了使用CSS变量和主题监听器的最佳实践。

## 功能特点

1. **使用CSS变量**：所有样式都使用主题变量定义，自动响应主题变化
2. **主题监听**：注册主题变更监听器，响应主题切换
3. **多种UI组件**：展示文本、按钮、卡片、表单等多种UI组件的主题应用
4. **最佳实践**：展示如何正确使用主题管理器

## 文件结构

```
theme-example/
├── theme-example.html  # 页面结构
├── theme-example.css   # 页面样式
├── theme-example.ts    # 页面逻辑
└── README.md         # 本文档
```

## 使用方法

### 1. 引入主题管理器

在TypeScript文件中引入主题管理器：

```typescript
import { themeManager } from '../../themes';
```

### 2. 注册主题变更监听器

在页面初始化时注册主题变更监听器：

```typescript
private init(): void {
  // 注册主题变更监听器
  themeManager.addChangeListener(this.themeChangeListener);
}
```

### 3. 在CSS中使用主题变量

在CSS文件中使用主题变量定义样式：

```css
.button {
  background: var(--theme-primary);
  color: var(--theme-text-inverse);
}

.button:hover {
  background: var(--theme-primary-hover);
}
```

### 4. 清理监听器

在页面卸载时移除监听器：

```typescript
public destroy(): void {
  themeManager.removeChangeListener(this.themeChangeListener);
}
```

## 可用的主题变量

### 主色调

- `--theme-primary`: 主色调
- `--theme-primary-hover`: 主色调悬停状态
- `--theme-primary-light`: 主色调浅色版本

### 次要色调

- `--theme-secondary`: 次要色调
- `--theme-secondary-hover`: 次要色调悬停状态

### 强调色

- `--theme-accent`: 强调色
- `--theme-accent-hover`: 强调色悬停状态

### 状态色

- `--theme-success`: 成功状态
- `--theme-warning`: 警告状态
- `--theme-danger`: 危险状态
- `--theme-info`: 信息状态

### 文本色

- `--theme-text-primary`: 主要文本
- `--theme-text-secondary`: 次要文本
- `--theme-text-tertiary`: 第三级文本
- `--theme-text-inverse`: 反色文本

### 背景色

- `--theme-bg-primary`: 主要背景
- `--theme-bg-secondary`: 次要背景
- `--theme-bg-tertiary`: 第三级背景
- `--theme-bg-inverse`: 反色背景

### 边框色

- `--theme-border-primary`: 主要边框
- `--theme-border-secondary`: 次要边框
- `--theme-border-tertiary`: 第三级边框

### 阴影色

- `--theme-shadow-light`: 浅色阴影
- `--theme-shadow-medium`: 中等阴影
- `--theme-shadow-dark`: 深色阴影

## 最佳实践

### 1. 使用CSS变量

始终使用CSS变量而不是硬编码颜色值：

```css
/* 推荐 */
.button {
  background: var(--theme-primary);
}

/* 不推荐 */
.button {
  background: #8b9dc3;
}
```

### 2. 合理使用监听器

只在需要响应主题变更时添加监听器：

```typescript
// 推荐
private init(): void {
  // 只在需要动态更新UI时添加监听器
  if (this.needsDynamicUpdate) {
    themeManager.addChangeListener(this.themeChangeListener);
  }
}

// 不推荐
private init(): void {
  // 无条件添加监听器
  themeManager.addChangeListener(this.themeChangeListener);
}
```

### 3. 及时清理监听器

在组件或页面销毁时移除监听器：

```typescript
public destroy(): void {
  // 清理监听器
  themeManager.removeChangeListener(this.themeChangeListener);
}
```

### 4. 避免在监听器中执行耗时操作

监听器中应该只执行轻量级的更新操作：

```typescript
// 推荐
private themeChangeListener = (theme) => {
  // 更新简单的UI状态
  this.updateUIState();
};

// 不推荐
private themeChangeListener = (theme) => {
  // 执行耗时操作
  this.fetchData();
  this.renderComplexChart();
};
```

## 注意事项

1. **不要直接调用主题管理器**：除了主题设置页面，其他页面不应该直接调用主题管理器的方法
2. **使用CSS变量**：所有样式都应该使用CSS变量，而不是硬编码颜色值
3. **清理监听器**：记得在组件或页面销毁时移除监听器
4. **避免循环依赖**：确保页面不会与主题管理器产生循环依赖

## 扩展指南

### 添加新的UI组件

如果需要添加新的UI组件，可以参考现有组件的实现方式：

1. 在HTML中添加组件结构
2. 在CSS中使用主题变量定义样式
3. 在TypeScript中添加交互逻辑（如果需要）

### 自定义主题变量

如果需要添加自定义的主题变量，可以：

1. 在 `types.ts` 中定义新的颜色配置
2. 在 `theme-manager.ts` 中添加对应的CSS变量
3. 在CSS中使用新的变量

## 维护者

主题示例页面由开发团队维护，如有问题或建议，请提交Issue或Pull Request。
