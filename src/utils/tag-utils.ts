/**
 * 标签和颜色相关通用工具函数
 */

import { themeManager } from "../themes/theme-manager.js";

function getStableHash(input: string): number {
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function mapIntoRange(seed: number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }

  return min + (seed % (max - min + 1));
}

export function colorFromTag(tag: string): string {
  const normalizedTag = normalizeTag(tag);
  const theme = themeManager.getCurrentTheme();
  const config = theme.tagColors;
  const hash = getStableHash(normalizedTag);
  const hueRange = Math.max(config.hueRange, 1);
  const hue = (config.hueStart + (hash % hueRange) + 360) % 360;
  const saturation = mapIntoRange(hash * 7, config.saturationMin, config.saturationMax);
  const lightness = mapIntoRange(hash * 13, config.lightnessMin, config.lightnessMax);

  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function normalizeTag(tag: string): string {
  return tag.trim();
}

export function removeFromList(values: string[], target: string): string[] {
  return values.filter((value) => value !== target);
}
