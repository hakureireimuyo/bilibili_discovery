/**
 * 主题配置文件
 * 当前仅启用莫兰迪主题的明暗两套配色。
 *
 * 说明：
 * - 主题系统的扩展方式保持不变，后续新增主题时继续在此文件补充新的 ThemeConfig 即可。
 * - 默认主题由 themeConfigs 数组第一个元素决定，因此当前默认配色为莫兰迪浅色。
 */

import { ThemeConfig, ThemeId, ThemeType } from './types.js';

/**
 * 莫兰迪主题 - 浅色模式
 * 作为当前默认主题
 */
const morandiLightTheme: ThemeConfig = {
  id: ThemeId.Morandi,
  name: '莫兰迪',
  type: ThemeType.Light,
  tagColors: {
    hueStart: 0,
    hueRange: 360,
    saturationMin: 40,
    saturationMax: 54,
    lightnessMin: 85,
    lightnessMax: 94
  },
  heatmapColors: {
    level0: '#d4dae4',
    level1: '#b6e3ff',
    level2: '#54aeff',
    level3: '#0969da',
    level4: '#0a3069',
    level5: '#002d6b'
  },
  colors: {
    primary: '#8b9dc3',
    primaryHover: '#7a8db5',
    primaryLight: '#e8eef5',
    secondary: '#9ca3af',
    secondaryHover: '#8b949d',
    accent: '#d4a5a5',
    accentHover: '#c49494',
    success: '#a8b8a8',
    warning: '#d4b896',
    danger: '#d4a5a5',
    info: '#8b9dc3',
    text: {
      primary: '#2c2c2c',
      secondary: '#5b6475',
      tertiary: '#9ca3af',
      inverse: '#ffffff'
    },
    background: {
      primary: '#ffffff',
      secondary: '#f5f5f7',
      tertiary: '#f8f9fa',
      inverse: '#2c2c2c'
    },
    border: {
      primary: '#e5e7eb',
      secondary: '#cbd3e1',
      tertiary: '#e2e8f0'
    },
    shadow: {
      light: 'rgba(20, 30, 50, 0.08)',
      medium: 'rgba(20, 30, 50, 0.12)',
      dark: 'rgba(20, 30, 50, 0.18)'
    }
  }
};

/**
 * 莫兰迪主题 - 深色模式
 */
const morandiDarkTheme: ThemeConfig = {
  id: ThemeId.Morandi,
  name: '莫兰迪',
  type: ThemeType.Dark,
  tagColors: {
    hueStart: 0,
    hueRange: 360,
    saturationMin: 28,
    saturationMax: 42,
    lightnessMin: 32,
    lightnessMax: 44
  },
  heatmapColors: {
    level0: '#384151',
    level1: '#3a4050',
    level2: '#4a5060',
    level3: '#5a6070',
    level4: '#6a7080',
    level5: '#7a8090'
  },
  colors: {
    primary: '#9da8c9',
    primaryHover: '#8b9dc3',
    primaryLight: '#1f2430',
    secondary: '#b0b8c4',
    secondaryHover: '#9da8c9',
    accent: '#e4b5b5',
    accentHover: '#d4a5a5',
    success: '#b8c8b8',
    warning: '#e4c8a6',
    danger: '#e4b5b5',
    info: '#9da8c9',
    text: {
      primary: '#ffffff',
      secondary: '#cbd3e1',
      tertiary: '#9ca3af',
      inverse: '#2c2c2c'
    },
    background: {
      primary: '#1f2430',
      secondary: '#2d3748',
      tertiary: '#324a5e',
      inverse: '#ffffff'
    },
    border: {
      primary: '#324a5e',
      secondary: '#4a5568',
      tertiary: '#5a6678'
    },
    shadow: {
      light: 'rgba(20, 30, 50, 0.15)',
      medium: 'rgba(20, 30, 50, 0.25)',
      dark: 'rgba(20, 30, 50, 0.35)'
    }
  }
};

/**
 * 海洋蓝主题 - 浅色模式
 */
const oceanLightTheme: ThemeConfig = {
  id: ThemeId.Ocean,
  name: '海洋蓝',
  type: ThemeType.Light,
  tagColors: {
    hueStart: 180,
    hueRange: 60,
    saturationMin: 50,
    saturationMax: 70,
    lightnessMin: 75,
    lightnessMax: 90
  },
  heatmapColors: {
    level0: '#dce6f2',
    level1: '#e0efff',
    level2: '#b8d4ff',
    level3: '#7eb8ff',
    level4: '#4a9eff',
    level5: '#1a7eff'
  },
  colors: {
    primary: '#1a7eff',
    primaryHover: '#0a6eff',
    primaryLight: '#e0efff',
    secondary: '#6b8fa3',
    secondaryHover: '#5a7e93',
    accent: '#ff7a7a',
    accentHover: '#ff6a6a',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    info: '#38bdf8',
    text: {
      primary: '#1e293b',
      secondary: '#475569',
      tertiary: '#94a3b8',
      inverse: '#ffffff'
    },
    background: {
      primary: '#ffffff',
      secondary: '#f0f7ff',
      tertiary: '#e0efff',
      inverse: '#1e293b'
    },
    border: {
      primary: '#e2e8f0',
      secondary: '#cbd5e1',
      tertiary: '#bfdbfe'
    },
    shadow: {
      light: 'rgba(26, 126, 255, 0.08)',
      medium: 'rgba(26, 126, 255, 0.12)',
      dark: 'rgba(26, 126, 255, 0.18)'
    }
  }
};

/**
 * 海洋蓝主题 - 深色模式
 */
const oceanDarkTheme: ThemeConfig = {
  id: ThemeId.Ocean,
  name: '海洋蓝',
  type: ThemeType.Dark,
  tagColors: {
    hueStart: 180,
    hueRange: 60,
    saturationMin: 40,
    saturationMax: 60,
    lightnessMin: 40,
    lightnessMax: 60
  },
  heatmapColors: {
    level0: '#2c3d52',
    level1: '#1e3a5f',
    level2: '#1e4a7f',
    level3: '#1e5a9f',
    level4: '#1e6abf',
    level5: '#1e7adf'
  },
  colors: {
    primary: '#38bdf8',
    primaryHover: '#0ea5e9',
    primaryLight: '#1e3a5f',
    secondary: '#94a3b8',
    secondaryHover: '#64748b',
    accent: '#f87171',
    accentHover: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#38bdf8',
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      tertiary: '#64748b',
      inverse: '#1e293b'
    },
    background: {
      primary: '#0f172a',
      secondary: '#1e293b',
      tertiary: '#1e3a5f',
      inverse: '#f1f5f9'
    },
    border: {
      primary: '#1e3a5f',
      secondary: '#334155',
      tertiary: '#475569'
    },
    shadow: {
      light: 'rgba(26, 126, 255, 0.15)',
      medium: 'rgba(26, 126, 255, 0.25)',
      dark: 'rgba(26, 126, 255, 0.35)'
    }
  }
};

/**
 * 导出当前启用的所有主题配置
 * 当前仅保留莫兰迪主题
 */
export const themeConfigs: ThemeConfig[] = [
  morandiLightTheme,
  morandiDarkTheme,
  oceanLightTheme,
  oceanDarkTheme
];
