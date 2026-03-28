
# 主题设置页面

## 概述

主题设置页面是用户与主题管理器交互的专用页面，提供直观的界面让用户选择和预览不同的主题配色。

## 访问方式

用户可以通过以下方式访问主题设置页面：

1. **从Popup页面**：点击扩展图标打开Popup页面，然后点击"主题设置"按钮
2. **直接访问**：在浏览器中访问 `chrome-extension://<extension-id>/ui/theme-settings/theme-settings.html`

## 功能特点

1. **主题选择**：展示所有可用的主题配色，用户可以点击选择
2. **明暗模式切换**：支持在浅色和深色模式之间切换
3. **实时预览**：选择主题后立即预览效果
4. **设置保存**：保存用户的主题选择

## 文件结构

```
theme-settings/
├── theme-settings.html  # 页面结构
├── theme-settings.css   # 页面样式
├── theme-settings.ts    # 页面逻辑
└── README.md          # 本文档
```

## 使用方法

### 页面初始化

页面加载时会自动初始化，执行以下操作：

1. 从主题管理器获取当前主题
2. 渲染所有可用的主题卡片
3. 设置当前选中的主题和模式
4. 添加事件监听器
5. 注册主题变更监听器

### 主题切换

用户可以通过以下方式切换主题：

1. **主题卡片**：点击主题卡片可以切换到对应的主题
2. **明暗模式**：点击浅色/深色模式单选按钮可以切换模式

### 设置保存

点击"保存设置"按钮会：

1. 显示保存成功的提示信息
2. 3秒后自动清除提示

## 技术实现

### HTML结构

页面使用语义化的HTML结构，包含以下主要部分：

- 头部区域：显示页面标题和图标
- 内容区域：包含主题选择、明暗模式和预览区域
- 底部区域：包含保存按钮和状态提示

### CSS样式

页面样式使用CSS变量实现主题切换，主要特点：

1. 使用 `var(--theme-*)` 变量引用主题颜色
2. 响应式设计，适配不同屏幕尺寸
3. 平滑的过渡动画效果
4. 清晰的视觉层次和交互反馈

### TypeScript逻辑

页面逻辑使用TypeScript实现，主要类：

- `ThemeSettingsPage`：主题设置页面主类

主要方法：

- `init()`：初始化页面
- `renderThemeCards()`：渲染主题卡片
- `setInitialTheme()`：设置初始主题
- `addEventListeners()`：添加事件监听
- `handleThemeCardClick()`：处理主题卡片点击
- `handleModeChange()`：处理模式变化
- `handleSave()`：处理保存按钮点击
- `setupThemeChangeListener()`：设置主题变更监听器

## 与主题管理器的交互

主题设置页面通过以下方式与主题管理器交互：

1. **获取当前主题**：使用 `themeManager.getCurrentTheme()`
2. **设置主题**：使用 `themeManager.setTheme(themeId, type)`
3. **监听主题变更**：使用 `themeManager.addChangeListener(listener)`

## 扩展指南

### 添加新的主题卡片样式

如果需要自定义主题卡片的样式，可以修改 `createThemeCard` 方法：

```typescript
private createThemeCard(theme: ThemeConfig): HTMLElement {
  const card = document.createElement('div');
  // 自定义卡片样式
  return card;
}
```

### 添加新的预览元素

如果需要添加更多的预览元素，可以在HTML中添加相应的元素，并在TypeScript中处理：

```typescript
// 在HTML中添加
<div class="preview-element" id="preview-element"></div>

// 在TypeScript中处理
const previewElement = document.getElementById('preview-element')!;
// 更新预览元素的样式
```

## 注意事项

1. 主题设置页面是唯一直接与主题管理器交互的UI页面
2. 其他页面应该通过监听主题变更来更新UI，而不是直接调用主题管理器
3. 页面样式使用CSS变量，确保主题切换时能够正确应用
4. 所有事件监听器在页面卸载时应该被移除（虽然这个页面不需要，因为它是单页应用）

## 最佳实践

1. **保持简洁**：主题设置页面应该保持简洁，只提供必要的功能
2. **实时反馈**：用户操作后应该立即看到效果
3. **清晰的状态**：当前选中的主题和模式应该清晰可见
4. **友好的提示**：操作结果应该有明确的提示信息
5. **响应式设计**：确保在不同设备上都能正常使用

## 维护者

主题设置页面由开发团队维护，如有问题或建议，请提交Issue或Pull Request。
