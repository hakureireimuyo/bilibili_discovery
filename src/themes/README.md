
# 主题管理器模块

## 概述

主题管理器是一个集中式的主题管理系统，负责管理应用中的所有主题相关功能。它提供了一套完整的主题切换、通知和CSS变量应用机制，确保整个应用的视觉风格保持一致。

页面开发和主题接入的正式规范请查看：

- [docs/主题页面开发规范.md](/D:/ProjectFloder/TS/bilibili_discovery/docs/主题页面开发规范.md)

## 主要功能

1. **多主题支持**：支持内置多套主题配色，每个主题具有明暗两种模式
2. **主题切换**：支持动态切换主题，无需刷新页面
3. **主题通知**：当主题发生变化时，自动通知所有已注册的监听器
4. **CSS变量管理**：自动将主题配置转换为CSS变量，应用到DOM中
5. **持久化存储**：自动保存用户的主题选择到localStorage

## 模块结构

```
themes/
├── index.ts           # 模块入口文件
├── types.ts           # 类型定义
├── theme-configs.ts   # 主题配置
├── theme-manager.ts   # 主题管理器实现
└── README.md          # 本文档
```

## 核心组件

### 1. 类型定义 (types.ts)

定义了主题管理器所需的所有类型和接口：

- `ThemeType`: 主题类型枚举（浅色/深色）
- `ThemeId`: 主题ID枚举
- `ColorConfig`: 颜色配置接口
- `ThemeConfig`: 主题配置接口
- `ThemeChangeListener`: 主题变更监听器类型
- `IThemeManager`: 主题管理器接口

### 2. 主题配置 (theme-configs.ts)

定义了所有内置主题的配置。
当前项目启用的是莫兰迪主题（浅色/深色），后续新增主题继续在这里由开发者维护。

#### 莫兰迪主题特点

莫兰迪主题基于stats页面的样式设计，采用低饱和度、柔和的灰色调，具有以下特点：

- **低饱和度**：所有颜色都经过灰度处理，降低饱和度
- **柔和色调**：使用柔和的灰色调，减少视觉疲劳
- **优雅配色**：配色方案优雅、高级，适合长时间使用
- **与现有样式兼容**：基于stats页面的配色方案，与现有UI完美融合

每个主题配置包含以下颜色类别：

- 主色调（primary）
- 次要色调（secondary）
- 强调色（accent）
- 状态色（success, warning, danger, info）
- 文本色（text）
- 背景色（background）
- 边框色（border）
- 阴影色（shadow）
- 标签映射范围（tagColors）

### 3. 主题管理器 (theme-manager.ts)

主题管理器的核心实现，提供以下功能：

- 单例模式确保全局只有一个主题管理器实例
- 主题切换和持久化存储
- CSS变量自动应用
- 主题变更通知机制

## 使用方法

### 基本使用

```typescript
import { themeManager, ThemeId, ThemeType } from './themes';

// 获取当前主题
const currentTheme = themeManager.getCurrentTheme();

// 设置主题
themeManager.setTheme(ThemeId.Blue, ThemeType.Light);

// 获取所有可用主题
const allThemes = themeManager.getAllThemes();
```

### 监听主题变更

```typescript
import { themeManager } from './themes';

// 添加监听器
const listener = (theme) => {
  console.log('主题已切换:', theme);
  // 更新UI或其他操作
};

themeManager.addChangeListener(listener);

// 移除监听器
themeManager.removeChangeListener(listener);
```

### 在CSS中使用主题变量

```css
/* 使用主题变量 */
.button {
  background-color: var(--theme-primary);
  color: var(--theme-text-inverse);
  border: 1px solid var(--theme-border-primary);
}

.button:hover {
  background-color: var(--theme-primary-hover);
}
```

## 扩展指南

### 添加新主题

1. 在 `types.ts` 中添加新的主题ID到 `ThemeId` 枚举
2. 在 `theme-configs.ts` 中创建新主题的配置（浅色和深色两种）
3. 将新主题配置添加到 `themeConfigs` 数组中

### 配置主题颜色与 tag 映射

主题配置中的颜色分为以下几类：

- **主色调**：用于主要按钮、链接等元素
- **次要色调**：用于次要按钮、标签等元素
- **强调色**：用于需要突出显示的元素
- **状态色**：用于表示不同状态的元素（成功、警告、错误等）
- **文本色**：用于不同级别的文本
- **背景色**：用于不同层级的背景
- **边框色**：用于不同层级的边框
- **阴影色**：用于不同强度的阴影

## 设计原则

1. **单一职责**：主题管理器只负责主题相关功能，不涉及其他业务逻辑
2. **松耦合**：通过监听器机制实现主题变更通知，各模块不需要直接依赖主题管理器
3. **可扩展**：易于添加新主题和扩展新的主题语义
4. **类型安全**：使用TypeScript类型系统确保代码的健壮性

## 注意事项

1. 主题管理器是单例模式，全局只有一个实例
2. 主题配置会自动保存到localStorage，下次访问时会自动加载
3. 所有CSS变量都以 `--theme-` 开头，避免与其他CSS变量冲突
4. 监听器中执行的操作应该尽量轻量，避免阻塞UI
5. 主题变更会自动应用到DOM根元素，无需手动处理

## 最佳实践

1. **使用CSS变量**：在CSS中使用主题变量而不是硬编码颜色值
2. **合理使用监听器**：只在需要响应主题变更时添加监听器，记得在组件销毁时移除
3. **主题一致性**：确保所有页面使用相同的主题变量，保持视觉一致性
4. **性能优化**：避免在主题变更时执行耗时操作
5. **错误处理**：监听器中应该添加适当的错误处理，避免影响其他监听器

## 示例

### 创建主题切换组件

```typescript
import { themeManager, ThemeId, ThemeType } from './themes';

class ThemeSwitcher {
  constructor() {
    this.init();
  }

  private init() {
    // 创建主题选择器
    const select = document.createElement('select');
    select.innerHTML = `
      <option value="morandi">莫兰迪</option>
    `;

    // 创建明暗切换
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = themeManager.getCurrentTheme().type === ThemeType.Dark;

    // 添加事件监听
    select.addEventListener('change', () => {
      themeManager.setTheme(select.value as ThemeId);
    });

    toggle.addEventListener('change', () => {
      const currentTheme = themeManager.getCurrentTheme();
      const newType = toggle.checked ? ThemeType.Dark : ThemeType.Light;
      themeManager.setTheme(currentTheme.id, newType);
    });

    // 添加到页面
    document.body.appendChild(select);
    document.body.appendChild(toggle);
  }
}

// 初始化主题切换器
new ThemeSwitcher();
```
