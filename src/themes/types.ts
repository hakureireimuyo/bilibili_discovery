/**
 * 主题管理器类型定义
 */

/**
 * 主题类型
 */
export enum ThemeType {
  Light = 'light',
  Dark = 'dark'
}

/**
 * 主题ID枚举
 */
export enum ThemeId {
  Default = 'default',
  Blue = 'blue',
  Green = 'green',
  Purple = 'purple',
  Pink = 'pink',
  Orange = 'orange',
  Morandi = 'morandi'
}

/**
 * 颜色配置接口
 */
export interface ColorConfig {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  secondaryHover: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  border: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  shadow: {
    light: string;
    medium: string;
    dark: string;
  };
}

/**
 * 标签颜色映射配置
 * 用于将字符串稳定映射到当前主题下的一组 HSL 区间。
 */
export interface TagColorConfig {
  hueStart: number;
  hueRange: number;
  saturationMin: number;
  saturationMax: number;
  lightnessMin: number;
  lightnessMax: number;
}

/**
 * 热力图颜色映射配置
 * 用于热力图的颜色梯度映射
 */
export interface HeatmapColorConfig {
  level0: string;  // 0% - 无数据
  level1: string;  // 1-20%
  level2: string;  // 21-40%
  level3: string;  // 41-60%
  level4: string;  // 61-80%
  level5: string;  // 81-100%
}

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  id: ThemeId;
  name: string;
  type: ThemeType;
  colors: ColorConfig;
  tagColors: TagColorConfig;
  heatmapColors: HeatmapColorConfig;
}

/**
 * 主题CSS变量映射
 * 将主题配置转换为页面可直接消费的CSS变量
 */
export type ThemeVariableMap = Record<string, string>;

/**
 * 主题变更监听器类型
 */
export type ThemeChangeListener = (theme: ThemeConfig) => void;

/**
 * 主题管理器接口
 */
export interface IThemeManager {
  /**
   * 获取当前主题
   */
  getCurrentTheme(): ThemeConfig;

  /**
   * 设置主题
   */
  setTheme(themeId: ThemeId, type?: ThemeType): void;

  /**
   * 获取所有可用主题
   */
  getAllThemes(): ThemeConfig[];

  /**
   * 注册主题变更监听器
   */
  addChangeListener(listener: ThemeChangeListener): void;

  /**
   * 移除主题变更监听器
   */
  removeChangeListener(listener: ThemeChangeListener): void;

  /**
   * 获取CSS变量
   */
  getCSSVariables(): Record<string, string>;
}
