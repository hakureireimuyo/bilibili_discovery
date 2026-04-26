/**
 * Utility helpers shared across animation modules.
 */

export function getCssVar(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = Number.parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function cssVarToRgb(name: string, fallback: string): [number, number, number] {
  return hexToRgb(getCssVar(name, fallback));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
