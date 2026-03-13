/**
 * Stats page utility functions.
 */

import type { InterestProfile } from "./types.js";

/**
 * Set text content of an element by ID.
 */
export function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

/**
 * Count total video counts.
 */
export function countVideoTotals(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, value) => total + (value ?? 0), 0);
}

/**
 * Count total UP tags.
 */
export function countUpTags(upTags: Record<string, string[]>): number {
  return Object.values(upTags).reduce((total, tags) => total + (tags?.length ?? 0), 0);
}

/**
 * Build interest rows from profile.
 */
export function buildInterestRows(profile: InterestProfile): { tag: string; score: number }[] {
  return Object.values(profile).sort((a, b) => b.score - a.score);
}

/**
 * Generate color from tag name.
 */
export function colorFromTag(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  }
  const hue = Math.abs(hash) % 360;
  const sat = 70 + (Math.abs(hash * 7) % 21);
  const light = 85 + (Math.abs(hash * 13) % 11);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/**
 * Normalize tag by trimming whitespace.
 */
export function normalizeTag(tag: string): string {
  return tag.trim();
}
