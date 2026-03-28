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
    "--theme-text-primary": colors.text.primary,
    "--theme-text-secondary": colors.text.secondary,
    "--theme-text-tertiary": colors.text.tertiary,
    "--theme-text-inverse": colors.text.inverse,
    "--theme-bg-primary": colors.background.primary,
    "--theme-bg-secondary": colors.background.secondary,
    "--theme-bg-tertiary": colors.background.tertiary,
    "--theme-bg-inverse": colors.background.inverse,
    "--theme-border-primary": colors.border.primary,
    "--theme-border-secondary": colors.border.secondary,
    "--theme-border-tertiary": colors.border.tertiary,
    "--theme-shadow-light": colors.shadow.light,
    "--theme-shadow-medium": colors.shadow.medium,
    "--theme-shadow-dark": colors.shadow.dark,

    "--theme-page-bg": colors.background.secondary,
    "--theme-page-gradient-start": mix(colors.primary, colors.background.secondary, 0.2),
    "--theme-page-gradient-end": mix(colors.secondary, colors.background.primary, 0.24),
    "--theme-surface-base": colors.background.primary,
    "--theme-surface-raised": colors.background.primary,
    "--theme-surface-muted": colors.background.tertiary,
    "--theme-surface-subtle": mix(colors.background.secondary, colors.primaryLight, 0.35),
    "--theme-surface-hover": mix(colors.background.secondary, colors.primaryLight, 0.55),
    "--theme-surface-accent": colors.primaryLight,
    "--theme-surface-accent-hover": mix(colors.primaryLight, colors.primary, 0.12),
    "--theme-overlay-soft": toRgba(colors.background.inverse, 0.08),
    "--theme-overlay-strong": toRgba(colors.background.inverse, 0.14),
    "--theme-focus-ring": toRgba(colors.primary, 0.2),
    "--theme-danger-soft": toRgba(colors.danger, 0.16),
    "--theme-warning-soft": toRgba(colors.warning, 0.18),
    "--theme-success-soft": toRgba(colors.success, 0.16),
    "--theme-info-soft": toRgba(colors.info, 0.16),
    "--theme-primary-soft": toRgba(colors.primary, 0.14),
    "--theme-primary-softer": toRgba(colors.primary, 0.08),
    "--theme-secondary-soft": toRgba(colors.secondary, 0.14),
    "--theme-border-strong": colors.border.secondary,
    "--theme-border-accent": toRgba(colors.primary, 0.28),
    "--theme-button-primary-bg": colors.primary,
    "--theme-button-primary-hover": colors.primaryHover,
    "--theme-button-secondary-bg": colors.secondary,
    "--theme-button-secondary-hover": colors.secondaryHover,
    "--theme-button-accent-bg": colors.accent,
    "--theme-button-accent-hover": colors.accentHover,

    "--theme-popup-shell-bg": toRgba(colors.background.primary, theme.type === "dark" ? 0.96 : 0.94),
    "--theme-popup-shell-border": toRgba(colors.border.primary, 0.7),
    "--theme-popup-icon-color": colors.accent,
    "--theme-popup-section-icon": colors.primary,
    "--theme-popup-progress-fill": toRgba(colors.background.primary, 0.22),
    "--theme-popup-status-bg": colors.background.tertiary,
    "--theme-popup-status-hover": mix(colors.background.tertiary, colors.primaryLight, 0.28),

    "--theme-options-hero-start": mix(colors.primary, colors.background.primary, 0.08),
    "--theme-options-hero-end": mix(colors.secondary, colors.background.primary, 0.12),
    "--theme-options-hero-overlay": toRgba(colors.background.primary, 0.22),
    "--theme-options-link": colors.primary,
    "--theme-options-link-hover": colors.primaryHover,

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
    "--theme-stats-unfollowed-text": colors.text.tertiary
  };
}
