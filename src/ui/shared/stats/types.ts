/**
 * 统计卡片组件类型定义
 */

/**
 * 统计卡片数据
 */
export interface StatCardData {
  /** 标签文本 */
  label: string;
  /** 数值文本 */
  value: string | number;
  /** 图标（可选） */
  icon?: string;
  /** 颜色主题（可选） */
  theme?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
}

/**
 * 统计卡片配置选项
 */
export interface StatCardOptions {
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否启用悬停效果 */
  enableHover?: boolean;
  /** 点击回调 */
  onClick?: () => void;
}
