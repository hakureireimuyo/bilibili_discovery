/**
 * 图表组件类型定义
 */

/**
 * 热力图数据点
 */
export interface HeatmapDataPoint {
  /** 日期字符串，格式：YYYY-MM-DD */
  date: string;
  /** 日期数字 */
  day: number;
  /** 观看时长（秒） */
  seconds: number;
}

/**
 * 热力图配置选项
 */
export interface HeatmapOptions {
  /** 最大观看时长（秒），用于颜色映射 */
  maxSeconds?: number;
  /** 是否显示今日标记 */
  showTodayMarker?: boolean;
  /** 是否启用悬停提示 */
  showTooltip?: boolean;
  /** 单元格点击回调 */
  onCellClick?: (date: string, seconds: number) => void;
  /** 视图模式：month 或 year */
  viewMode?: 'month' | 'year';
}

/**
 * 折线图数据点
 */
export interface LineChartDataPoint {
  /** X轴标签 */
  label: string;
  /** Y轴数值 */
  value: number;
}

/**
 * 折线图配置选项
 */
export interface LineChartOptions {
  /** 图表标题 */
  title?: string;
  /** Y轴最大值，不指定则自动计算 */
  maxValue?: number;
  /** 线条颜色 */
  lineColor?: string;
  /** 数据点颜色 */
  pointColor?: string;
  /** 网格线颜色 */
  gridColor?: string;
  /** 是否显示数据点 */
  showPoints?: boolean;
  /** 是否启用悬停提示 */
  showTooltip?: boolean;
  /** 数据点点击回调 */
  onPointClick?: (point: LineChartDataPoint) => void;
}
