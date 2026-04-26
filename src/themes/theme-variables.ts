import type { ThemeConfig, ThemeVariableMap } from "./types.js";

interface RGB {
  r: number;
  g: number;
  b: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex: string): string {
  const trimmed = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, a, b, c] = trimmed;
    return `#${a}${a}${b}${b}${c}${c}`;
  }

  return "#000000";
}

function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

function toRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function mix(hexA: string, hexB: string, weight: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const ratio = clamp(weight, 0, 1);

  const r = Math.round(a.r * (1 - ratio) + b.r * ratio);
  const g = Math.round(a.g * (1 - ratio) + b.g * ratio);
  const bChannel = Math.round(a.b * (1 - ratio) + b.b * ratio);

  return `rgb(${r}, ${g}, ${bChannel})`;
}

/**
 * 将主题配置转换为页面可消费的CSS变量。
 * 通用语义变量和页面域变量都统一在这里派生，避免散落在各页面内。
 */
export function buildThemeVariables(theme: ThemeConfig): ThemeVariableMap {
  const colors = theme.colors;

  return {
    // ========== 基础颜色变量 ==========
    "--theme-primary": colors.primary,
    "--theme-primary-hover": colors.primaryHover,
    "--theme-primary-light": colors.primaryLight,
    "--theme-secondary": colors.secondary,
    "--theme-secondary-hover": colors.secondaryHover,
    "--theme-accent": colors.accent,
    "--theme-accent-hover": colors.accentHover,
    "--theme-success": colors.success,
    "--theme-warning": colors.warning,
    "--theme-danger": colors.danger,
    "--theme-info": colors.info,

    // ========== 文本颜色 ==========
    "--theme-text-primary": colors.text.primary,
    "--theme-text-secondary": colors.text.secondary,
    "--theme-text-tertiary": colors.text.tertiary,
    "--theme-text-inverse": colors.text.inverse,

    // ========== 背景颜色 ==========
    "--theme-bg-primary": colors.background.primary,
    "--theme-bg-secondary": colors.background.secondary,
    "--theme-bg-tertiary": colors.background.tertiary,
    "--theme-bg-inverse": colors.background.inverse,

    // ========== 边框颜色 ==========
    "--theme-border-primary": colors.border.primary,
    "--theme-border-secondary": colors.border.secondary,
    "--theme-border-tertiary": colors.border.tertiary,

    // ========== 阴影 ==========
    "--theme-shadow-light": colors.shadow.light,
    "--theme-shadow-medium": colors.shadow.medium,
    "--theme-shadow-dark": colors.shadow.dark,

    // ========== 页面背景 ==========
    "--theme-page-bg": colors.background.secondary,
    "--theme-page-gradient-start": mix(colors.primary, colors.background.secondary, 0.2),
    "--theme-page-gradient-end": mix(colors.secondary, colors.background.primary, 0.24),

    // ========== 表面颜色 ==========
    "--theme-surface-primary": colors.background.primary,
    "--theme-surface-muted": colors.background.tertiary,
    "--theme-surface-overlay": toRgba(colors.background.inverse, theme.type === "dark" ? 0.85 : 0.75),
    "--theme-surface-base": colors.background.primary,
    "--theme-surface-raised": colors.background.primary,
    "--theme-surface-subtle": mix(colors.background.secondary, colors.primaryLight, 0.35),
    "--theme-surface-hover": mix(colors.background.secondary, colors.primaryLight, 0.55),
    "--theme-surface-accent": colors.primaryLight,
    "--theme-surface-accent-hover": mix(colors.primaryLight, colors.primary, 0.12),

    // ========== 亚克力玻璃效果 ==========
    "--theme-glass-blur": "12px",
    "--theme-glass-transparency": "30%",

    // ========== 控件样式 ==========
    "--theme-control-radius": "8px",
    "--theme-control-gap": "12px",
    "--theme-control-height": "40px",
    "--theme-control-padding-x": "16px",
    "--theme-control-padding-y": "10px",

    // ========== 按钮颜色 ==========
    "--theme-button-primary-bg": colors.primary,
    "--theme-button-primary-hover": colors.primaryHover,
    "--theme-button-secondary-bg": colors.secondary,
    "--theme-button-secondary-hover": colors.secondaryHover,
    "--theme-button-accent-bg": colors.accent,
    "--theme-button-accent-hover": colors.accentHover,

    // ========== 覆盖层 ==========
    "--theme-overlay-soft": toRgba(colors.background.inverse, 0.08),
    "--theme-overlay-strong": toRgba(colors.background.inverse, 0.14),

    // ========== 焦点环 ==========
    "--theme-focus-ring": toRgba(colors.primary, 0.2),

    // ========== 柔和状态色 ==========
    "--theme-danger-soft": toRgba(colors.danger, 0.16),
    "--theme-warning-soft": toRgba(colors.warning, 0.18),
    "--theme-success-soft": toRgba(colors.success, 0.16),
    "--theme-info-soft": toRgba(colors.info, 0.16),
    "--theme-primary-soft": toRgba(colors.primary, 0.14),
    "--theme-primary-softer": toRgba(colors.primary, 0.08),
    "--theme-secondary-soft": toRgba(colors.secondary, 0.14),

    // ========== 边框变体 ==========
    "--theme-border-strong": colors.border.secondary,
    "--theme-border-accent": toRgba(colors.primary, 0.28),

    // ========== 弹窗样式 ==========
    "--theme-popup-shell-bg": toRgba(colors.background.primary, theme.type === "dark" ? 0.96 : 0.94),
    "--theme-popup-shell-border": toRgba(colors.border.primary, 0.7),
    "--theme-popup-icon-color": colors.accent,
    "--theme-popup-section-icon": colors.primary,
    "--theme-popup-progress-fill": toRgba(colors.background.primary, 0.22),
    "--theme-popup-status-bg": colors.background.tertiary,
    "--theme-popup-status-hover": mix(colors.background.tertiary, colors.primaryLight, 0.28),

    // ========== 选项页样式 ==========
    "--theme-options-hero-start": mix(colors.primary, colors.background.primary, 0.08),
    "--theme-options-hero-end": mix(colors.secondary, colors.background.primary, 0.12),
    "--theme-options-hero-overlay": toRgba(colors.background.primary, 0.22),
    "--theme-options-link": colors.primary,
    "--theme-options-link-hover": colors.primaryHover,

    // ========== 统计页样式 ==========
    "--theme-stats-name-line": mix(colors.primary, colors.secondary, 0.28),
    "--theme-stats-name-bg": toRgba(colors.primary, 0.07),
    "--theme-stats-name-bg-hover": toRgba(colors.primary, 0.14),
    "--theme-stats-name-shadow": toRgba(colors.primary, 0.15),
    "--theme-stats-drop-bg": toRgba(colors.info, 0.12),
    "--theme-stats-drop-border": colors.info,
    "--theme-stats-tag-bg": colors.background.tertiary,
    "--theme-stats-tag-hover": mix(colors.background.tertiary, colors.primaryLight, 0.3),
    "--theme-stats-followed-bg": colors.primaryLight,
    "--theme-stats-followed-text": colors.primary,
    "--theme-stats-unfollowed-bg": colors.background.tertiary,
    "--theme-stats-unfollowed-text": colors.text.tertiary,

    // ========== 热力图颜色 ==========
    "--theme-heatmap-level0": theme.heatmapColors.level0,
    "--theme-heatmap-level1": theme.heatmapColors.level1,
    "--theme-heatmap-level2": theme.heatmapColors.level2,
    "--theme-heatmap-level3": theme.heatmapColors.level3,
    "--theme-heatmap-level4": theme.heatmapColors.level4,
    "--theme-heatmap-level5": theme.heatmapColors.level5,

    // ========== 扩展语义变量 - 圆角 ==========
    "--theme-radius-xs": "4px",
    "--theme-radius-sm": "6px",
    "--theme-radius-base": "8px",
    "--theme-radius-md": "12px",
    "--theme-radius-lg": "16px",
    "--theme-radius-xl": "20px",
    "--theme-radius-full": "999px",

    // ========== 扩展语义变量 - 间距 ==========
    "--theme-space-xs": "4px",
    "--theme-space-sm": "8px",
    "--theme-space-base": "12px",
    "--theme-space-md": "16px",
    "--theme-space-lg": "20px",
    "--theme-space-xl": "24px",
    "--theme-space-2xl": "32px",

    // ========== 扩展语义变量 - 字体大小 ==========
    "--theme-font-size-xs": "11px",
    "--theme-font-size-sm": "12px",
    "--theme-font-size-base": "14px",
    "--theme-font-size-md": "16px",
    "--theme-font-size-lg": "18px",
    "--theme-font-size-xl": "20px",
    "--theme-font-size-2xl": "24px",

    // ========== 扩展语义变量 - 行高 ==========
    "--theme-line-height-tight": "1.2",
    "--theme-line-height-normal": "1.5",
    "--theme-line-height-relaxed": "1.75",

    // ========== 扩展语义变量 - 字重 ==========
    "--theme-font-weight-normal": "400",
    "--theme-font-weight-medium": "500",
    "--theme-font-weight-semibold": "600",
    "--theme-font-weight-bold": "700",

    // ========== 扩展语义变量 - 深度与层级 ==========
    "--theme-shadow-xs": `0 1px 2px ${toRgba(colors.background.inverse, 0.05)}`,
    "--theme-shadow-sm": `0 2px 4px ${toRgba(colors.background.inverse, 0.08)}`,
    "--theme-shadow-md": `0 4px 8px ${toRgba(colors.background.inverse, 0.12)}`,
    "--theme-shadow-lg": `0 8px 16px ${toRgba(colors.background.inverse, 0.15)}`,
    "--theme-shadow-xl": `0 12px 24px ${toRgba(colors.background.inverse, 0.18)}`,
    "--theme-shadow-2xl": `0 18px 36px ${toRgba(colors.background.inverse, 0.2)}`,

    // ========== 扩展语义变量 - 输入框样式 ==========
    "--theme-input-border": colors.border.primary,
    "--theme-input-border-hover": colors.border.secondary,
    "--theme-input-border-focus": toRgba(colors.primary, 0.5),
    "--theme-input-bg": colors.background.primary,
    "--theme-input-bg-disabled": colors.background.tertiary,
    "--theme-input-text": colors.text.primary,
    "--theme-input-placeholder": colors.text.tertiary,

    // ========== 扩展语义变量 - 分割线 ==========
    "--theme-divider": toRgba(colors.border.primary, 0.5),
    "--theme-divider-strong": colors.border.primary,
    "--theme-divider-light": toRgba(colors.border.primary, 0.25),

    // ========== 扩展语义变量 - 禁用状态 ==========
    "--theme-disabled-bg": colors.background.tertiary,
    "--theme-disabled-text": colors.text.tertiary,
    "--theme-disabled-border": colors.border.secondary,

    // ========== 扩展语义变量 - 链接 ==========
    "--theme-link": colors.primary,
    "--theme-link-hover": colors.primaryHover,
    "--theme-link-visited": mix(colors.primary, colors.secondary, 0.4),

    // ========== 扩展语义变量 - 代码/预格式化 ==========
    "--theme-code-bg": colors.background.tertiary,
    "--theme-code-text": colors.primary,
    "--theme-code-border": colors.border.primary
  };
}
