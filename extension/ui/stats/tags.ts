/**
 * Tag-related functionality for stats page.
 */

import { colorFromTag, normalizeTag } from "./utils.js";
import { createDragGhost, removeDragGhost, getDragContext, setDragContext } from "./drag-drop.js";
import type { DragContext } from "./types.js";

// Global state
let allTagCounts: Record<string, number> = {};
let filteredTags: string[] = [];
let currentCustomTags: string[] = [];

/**
 * Get all tag counts.
 */
export function getAllTagCounts(): Record<string, number> {
  return allTagCounts;
}

/**
 * Set all tag counts.
 */
export function setAllTagCounts(counts: Record<string, number>): void {
  allTagCounts = counts;
}

/**
 * Get filtered tags.
 */
export function getFilteredTags(): string[] {
  return filteredTags;
}

/**
 * Get current custom tags.
 */
export function getCurrentCustomTags(): string[] {
  return currentCustomTags;
}

/**
 * Set current custom tags.
 */
export function setCurrentCustomTags(tags: string[]): void {
  currentCustomTags = tags;
}

/**
 * Render tag pill element.
 */
export function renderTagPill(tag: string, count?: number): HTMLSpanElement {
  const pill = document.createElement("span");
  pill.className = "tag-pill";
  pill.textContent = count !== undefined ? `${tag} (${count})` : tag;
  pill.style.backgroundColor = colorFromTag(tag);

  // Make tag draggable
  pill.draggable = true;
  pill.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/x-bili-tag", tag);
      e.dataTransfer.effectAllowed = "move";
    }
    createDragGhost(e, tag);
    setDragContext({ tag, dropped: false });
  });
  pill.addEventListener("dragend", () => {
    removeDragGhost();
    // If tag was not dropped in a valid zone, remove it from category
    const context = getDragContext();
    if (context && !context.dropped && context.categoryId) {
      // This will be handled by the categories module
      const event = new CustomEvent("removeTagFromCategory", {
        detail: { categoryId: context.categoryId, tag }
      });
      document.dispatchEvent(event);
    }
    setDragContext(null);
  });

  return pill;
}

/**
 * Render auto tag pill element.
 */
export function renderAutoTagPill(tag: string, count: number): HTMLSpanElement {
  const pill = document.createElement("span");
  pill.className = "tag-pill tag-pill-auto";
  pill.textContent = `${tag} (${count})`;
  pill.style.backgroundColor = colorFromTag(tag);
  pill.style.opacity = "0.7";
  // 自动标签不可拖拽
  pill.draggable = false;
  // 自动标签不可交互，只能查看
  pill.style.cursor = "default";
  // 添加自动标签标识
  const icon = document.createElement("i");
  icon.className = "auto-tag-icon";
  icon.textContent = "✧";
  pill.appendChild(icon);
  return pill;
}

/**
 * Render tags list.
 */
export async function renderTags(
  upTags: Record<string, string[]>,
  searchTerm: string = ""
): Promise<void> {
  const container = document.getElementById("tag-list");
  if (!container) return;
  container.innerHTML = "";

  // Calculate tag counts from upTags
  const counts: Record<string, number> = {};
  for (const tags of Object.values(upTags)) {
    for (const tag of tags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  setAllTagCounts(counts);

  if (Object.keys(counts).length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无分类词条";
    container.appendChild(item);
    return;
  }

  // Filter tags by search term
  if (searchTerm) {
    filteredTags = Object.keys(counts).filter(tag =>
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } else {
    filteredTags = Object.keys(counts);
  }

  // Sort by count
  const rows = filteredTags.map(tag => [tag, counts[tag]] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  for (const [tag, count] of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.appendChild(renderTagPill(tag, count));
    const value = document.createElement("span");
    value.textContent = String(count);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

/**
 * Add custom tag.
 */
export async function addCustomTag(
  tag: string,
  upTags: Record<string, string[]>
): Promise<void> {
  const next = normalizeTag(tag);
  if (!next) return;
  if (currentCustomTags.includes(next)) return;
  currentCustomTags = [...currentCustomTags, next];
  // This will be handled by the main module
  const event = new CustomEvent("saveCustomTags", {
    detail: { tags: currentCustomTags }
  });
  document.dispatchEvent(event);
  const searchTerm = (document.getElementById("tag-search") as HTMLInputElement | null)?.value ?? "";
  await renderTags(upTags, searchTerm);
}
