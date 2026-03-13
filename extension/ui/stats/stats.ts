/**
 * Stats page main entry point.
 */

import {
  getValue,
  setValue,
  getFollowedUPList,
  getUPTagWeights,
  getUPManualTags,
  setUPManualTags,
  getTagLibrary,
  getTagById,
  getTagIdByName,
  getCategoryLibrary,
  addTagsToLibrary,
  type UPTagWeights,
  type Tag,
  type Category,
  type UPTagWeightsCache,
  type TagLibrary
} from "../../storage/storage.js";

import {
  setText,
  countVideoTotals,
  countUpTags,
  buildInterestRows,
  colorFromTag
} from "./utils.js";

import {
  getDragContext,
  setDragContext
} from "./drag-drop.js";

import {
  renderTags,
  renderTagPill,
  renderAutoTagPill,
  addCustomTag,
  getCurrentCustomTags,
  setCurrentCustomTags,
  getAllTagCounts,
  setAllTagCounts
} from "./tags.js";

import {
  renderCategories,
  addTagToCategory,
  removeTagFromCategory,
  addCategory,
  removeCategory,
  getCategories,
  setCategories
} from "./categories.js";

import { createDragGhost, removeDragGhost } from "./drag-drop.js";

import type { InterestProfile, UPCache, DragContext } from "./types.js";

declare const chrome: {
  runtime: {
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
  };
};

// Global state
let upCache: UPCache = { upList: [] };
let currentUpList: UPCache["upList"] = [];
let currentUpTags: Record<string, string[]> = {};
let upTagCache: UPTagWeightsCache = {};
let includeTags: string[] = [];
let excludeTags: string[] = [];
let includeCategories: string[] = [];
let excludeCategories: string[] = [];

/**
 * Refresh UP list display.
 */
function refreshUpList(): void {
  renderUpList(currentUpList, currentUpTags);
}

/**
 * Get auto tags for UP.
 */
async function getAutoTagsForUp(mid: number, manualTagIds: string[]): Promise<{ tag: string; count: number }[]> {
  const upTagWeights = upTagCache[String(mid)];
  if (!upTagWeights) {
    return [];
  }

  const manualTagIdSet = new Set(manualTagIds);

  // 过滤掉与手动标签重复的标签，并取前3个
  const filteredTags = upTagWeights.tags
    .filter(tagWeight => !manualTagIdSet.has(tagWeight.tag_id))
    .slice(0, 5);

  // 将标签ID转换为标签名称
  const result: { tag: string; count: number }[] = [];
  for (const tagWeight of filteredTags) {
    const tag = await getTagById(tagWeight.tag_id);
    if (tag) {
      result.push({ tag: tag.name, count: tagWeight.weight });
    }
  }

  return result;
}

/**
 * Render UP list.
 */
async function renderUpList(
  upList: UPCache["upList"],
  upTags: Record<string, string[]>
): Promise<void> {
  const container = document.getElementById("up-list");
  const searchTerm = (document.getElementById("up-search") as HTMLInputElement | null)?.value ?? "";
  if (!container) return;
  container.innerHTML = "";
  if (!upList || upList.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无关注UP";
    container.appendChild(item);
    return;
  }

  // Filter UP list based on include/exclude tags
  let filteredUpList = upList;
  if (includeTags.length > 0 || excludeTags.length > 0 || includeCategories.length > 0 || excludeCategories.length > 0 || searchTerm) {
    // 需要先获取所有UP的自动标签，以便在过滤时使用
    const autoTagsCache = new Map<number, string[]>();
    for (const up of upList) {
      const manualTags = upTags[String(up.mid)] ?? [];
      const autoTags = await getAutoTagsForUp(up.mid, manualTags);
      autoTagsCache.set(up.mid, autoTags.map(at => at.tag));
    }

    filteredUpList = upList.filter(up => {
      // 合并手动标签和自动标签进行过滤
      const manualTags = upTags[String(up.mid)] ?? [];
      const autoTags = autoTagsCache.get(up.mid) ?? [];
      const allTags = [...manualTags, ...autoTags];

      // Check if all include tags are present
      const hasAllIncludeTags = includeTags.length === 0 ||
        includeTags.every(tag => allTags.includes(tag));

      // Check if none of the exclude tags are present
      const hasNoExcludeTags = excludeTags.length === 0 ||
        !excludeTags.some(tag => allTags.includes(tag));

      // Check if at least one tag from include categories is present (OR logic)
      const hasIncludeCategory = includeCategories.length === 0 ||
        includeCategories.some(categoryId => {
          const category = getCategories().find(c => c.id === categoryId);
          return category && category.tag_ids.some(tag => allTags.includes(tag));
        });

      // Check if no tag from exclude categories is present
      const hasNoExcludeCategory = excludeCategories.length === 0 ||
        !excludeCategories.some(categoryId => {
          const category = getCategories().find(c => c.id === categoryId);
          return category && category.tag_ids.some(tag => allTags.includes(tag));
        });

      // Check if UP name matches search term
      const matchesSearch = !searchTerm ||
        up.name.toLowerCase().includes(searchTerm.toLowerCase());

      return hasAllIncludeTags && hasNoExcludeTags && hasIncludeCategory && hasNoExcludeCategory && matchesSearch;
    });
  }

  for (const up of filteredUpList) {
    const item = document.createElement("div");
    item.className = "up-item";
    const avatarLink = document.createElement("a");
    avatarLink.href = `https://space.bilibili.com/${up.mid}`;
    avatarLink.target = "_blank";
    avatarLink.rel = "noreferrer";
    const avatar = document.createElement("img");
    avatar.className = "up-avatar";
    avatar.src = up.face || "";
    avatar.alt = up.name;
    avatarLink.appendChild(avatar);
    const info = document.createElement("div");
    info.className = "up-info";
    const name = document.createElement("a");
    name.className = "up-name";
    name.href = `https://space.bilibili.com/${up.mid}`;
    name.target = "_blank";
    name.rel = "noreferrer";
    name.textContent = up.name;
    const tags = document.createElement("div");
    tags.className = "up-tags";
    setupUpTagDropZone(tags, up.mid);

    // 获取手动标签
    const manualTagList = upTags[String(up.mid)] ?? [];

    // 获取自动标签（权重最高的前3个）
    const autoTagList = await getAutoTagsForUp(up.mid, manualTagList);

    // 渲染标签
    if (manualTagList.length === 0 && autoTagList.length === 0) {
      tags.textContent = "暂无分类";
    } else {
      // 先渲染手动标签
      for (const tag of manualTagList) {
        tags.appendChild(await renderUpTagPill(tag, up.mid));
      }

      // 添加分隔符
      if (manualTagList.length > 0 && autoTagList.length > 0) {
        const separator = document.createElement("span");
        separator.className = "tag-separator";
        separator.textContent = "|";
        tags.appendChild(separator);
      }

      // 再渲染自动标签
      for (const autoTag of autoTagList) {
        tags.appendChild(renderAutoTagPill(autoTag.tag, autoTag.count));
      }
    }

    info.appendChild(name);
    info.appendChild(tags);
    item.appendChild(avatarLink);
    item.appendChild(info);
    container.appendChild(item);
  }
}

/**
 * Render UP tag pill.
 */
async function renderUpTagPill(tag: string, mid: number): Promise<HTMLSpanElement> {
  const pill = document.createElement("span");
  pill.className = "tag-pill";
  pill.textContent = tag;
  pill.style.backgroundColor = colorFromTag(tag);
  pill.draggable = true;
  pill.addEventListener("click", () => {
    const keyword = encodeURIComponent(tag);
    window.open(`https://search.bilibili.com/all?keyword=${keyword}`, "_blank", "noreferrer");
  });
  pill.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/x-bili-tag", tag);
      e.dataTransfer.effectAllowed = "move";
    }
    createDragGhost(e, tag);
    setDragContext({ tag, originUpMid: mid, dropped: false });
  });
  pill.addEventListener("dragend", () => {
    removeDragGhost();
    const context = getDragContext();
    if (context?.originUpMid === mid && !context.dropped) {
      void removeTagFromUp(mid, tag);
    }
    setDragContext(null);
  });
  return pill;
}

/**
 * Add tag to UP.
 */
async function addTagToUp(mid: number, tag: string): Promise<void> {
  const { normalizeTag } = await import("./utils.js");
  const nextTag = normalizeTag(tag);
  if (!nextTag) return;
  const key = String(mid);
  const existing = currentUpTags[key] ?? [];
  if (existing.includes(nextTag)) return;
  
  // 添加标签到标签库
  const addedTag = await addTagsToLibrary([nextTag]);
  const tagId = addedTag[0]?.id;
  if (!tagId) return;
  
  // 更新UP的手动标签
  const existingTagIds = await getUPManualTags(mid);
  if (!existingTagIds.includes(tagId)) {
    await setUPManualTags(mid, [...existingTagIds, tagId]);
  }
  
  const next = [...existing, nextTag];
  currentUpTags = { ...currentUpTags, [key]: next };
  await renderUpList(currentUpList, currentUpTags);
  await renderTags(currentUpTags, (document.getElementById("tag-search") as HTMLInputElement | null)?.value ?? "");
}

/**
 * Remove tag from UP.
 */
async function removeTagFromUp(mid: number, tag: string): Promise<void> {
  const key = String(mid);
  const existing = currentUpTags[key] ?? [];
  if (!existing.includes(tag)) return;
  
  // 从标签库中获取标签ID
  const tagId = await getTagIdByName(tag);
  if (!tagId) return;
  
  // 从UP的手动标签中移除
  const existingTagIds = await getUPManualTags(mid);
  const nextTagIds = existingTagIds.filter(id => id !== tagId);
  await setUPManualTags(mid, nextTagIds);
  
  const next = existing.filter((t) => t !== tag);
  currentUpTags = { ...currentUpTags, [key]: next };
  await renderUpList(currentUpList, currentUpTags);
  await renderTags(currentUpTags, (document.getElementById("tag-search") as HTMLInputElement | null)?.value ?? "");
}

/**
 * Setup UP tag drop zone.
 */
function setupUpTagDropZone(tagsEl: HTMLElement, mid: number): void {
  tagsEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    tagsEl.classList.add("drag-over");
  });

  tagsEl.addEventListener("dragleave", () => {
    tagsEl.classList.remove("drag-over");
  });

  tagsEl.addEventListener("drop", (e) => {
    e.preventDefault();
    tagsEl.classList.remove("drag-over");
    const tag = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
    if (!tag) return;
    const context = getDragContext();
    if (context) {
      setDragContext({ ...context, dropped: true });
    }
    void addTagToUp(mid, tag);
  });
}

/**
 * Render filter tags.
 */
function renderFilterTags(): void {
  const includeContainer = document.getElementById("filter-include-tags");
  const excludeContainer = document.getElementById("filter-exclude-tags");
  if (!includeContainer || !excludeContainer) return;

  includeContainer.innerHTML = "";
  excludeContainer.innerHTML = "";

  for (const tag of includeTags) {
    const tagEl = createFilterTag(tag, "include");
    includeContainer.appendChild(tagEl);
  }

  for (const tag of excludeTags) {
    const tagEl = createFilterTag(tag, "exclude");
    excludeContainer.appendChild(tagEl);
  }

  for (const categoryId of includeCategories) {
    const categoryEl = createFilterCategory(categoryId, "include");
    includeContainer.appendChild(categoryEl);
  }

  for (const categoryId of excludeCategories) {
    const categoryEl = createFilterCategory(categoryId, "exclude");
    excludeContainer.appendChild(categoryEl);
  }
}

/**
 * Create filter tag element.
 */
function createFilterTag(tag: string, type: "include" | "exclude"): HTMLElement {
  const tagEl = document.createElement("div");
  tagEl.className = "filter-tag";
  tagEl.textContent = tag;
  tagEl.style.backgroundColor = colorFromTag(tag);

  const removeBtn = document.createElement("span");
  removeBtn.className = "remove-tag";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => {
    if (type === "include") {
      includeTags = includeTags.filter(t => t !== tag);
    } else {
      excludeTags = excludeTags.filter(t => t !== tag);
    }
    renderFilterTags();
    refreshUpList();
  });

  tagEl.appendChild(removeBtn);
  return tagEl;
}

/**
 * Create filter category element.
 */
function createFilterCategory(categoryId: string, type: "include" | "exclude"): HTMLElement {
  const category = getCategories().find(c => c.id === categoryId);
  if (!category) {
    const errorEl = document.createElement("div");
    errorEl.className = "filter-tag filter-tag-error";
    errorEl.textContent = "未知分区";
    return errorEl;
  }

  const categoryEl = document.createElement("div");
  categoryEl.className = "filter-tag filter-tag-category";
  categoryEl.textContent = category.name;
  categoryEl.style.backgroundColor = "#2b6cff";
  categoryEl.style.color = "#fff";

  const removeBtn = document.createElement("span");
  removeBtn.className = "remove-tag";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => {
    if (type === "include") {
      includeCategories = includeCategories.filter(id => id !== categoryId);
    } else {
      excludeCategories = excludeCategories.filter(id => id !== categoryId);
    }
    renderFilterTags();
    refreshUpList();
  });

  categoryEl.appendChild(removeBtn);
  return categoryEl;
}

/**
 * Setup drag and drop.
 */
function setupDragAndDrop(): void {
  const includeZone = document.getElementById("filter-include-tags");
  const excludeZone = document.getElementById("filter-exclude-tags");

  if (!includeZone || !excludeZone) return;

  const zones = [
    { element: includeZone, type: "include" as const },
    { element: excludeZone, type: "exclude" as const }
  ];

  for (const zone of zones) {
    zone.element.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.element.classList.add("drag-over");
    });

    zone.element.addEventListener("dragleave", () => {
      zone.element.classList.remove("drag-over");
    });

    zone.element.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.element.classList.remove("drag-over");

      // Check if it's a category tag
      const categoryTagData = e.dataTransfer?.getData("application/x-bili-category-tag");
      if (categoryTagData) {
        try {
          const { tag, categoryId } = JSON.parse(categoryTagData);
          const category = getCategories().find(c => c.id === categoryId);
          if (category) {
            // Add category to filter
            if (zone.type === "include") {
              if (!includeCategories.includes(categoryId)) {
                includeCategories.push(categoryId);
              }
              excludeCategories = excludeCategories.filter(id => id !== categoryId);
            } else {
              if (!excludeCategories.includes(categoryId)) {
                excludeCategories.push(categoryId);
              }
              includeCategories = includeCategories.filter(id => id !== categoryId);
            }
            renderFilterTags();
            refreshUpList();
          }
        } catch {
          // Ignore parse errors
        }
        return;
      }

      // Handle regular tag
      const tag = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
      if (!tag) return;
      const context = getDragContext();
      if (context) {
        setDragContext({ ...context, dropped: true });
      }

      // Remove from other zone if exists
      if (zone.type === "include") {
        excludeTags = excludeTags.filter(t => t !== tag);
        if (!includeTags.includes(tag)) {
          includeTags.push(tag);
        }
      } else {
        includeTags = includeTags.filter(t => t !== tag);
        if (!excludeTags.includes(tag)) {
          excludeTags.push(tag);
        }
      }

      renderFilterTags();
      refreshUpList();
    });
  }
}

/**
 * Initialize stats page.
 */
export async function initStats(): Promise<void> {
  if (typeof document === "undefined") return;

  const clearBtn = document.getElementById("btn-clear-classify");
  clearBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    chrome.runtime.sendMessage({ type: "clear_classify_data" }, () => {
      window.location.reload();
    });
  });

  const updateUpListBtn = document.getElementById("btn-update-up-list");
  updateUpListBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    chrome.runtime.sendMessage({ type: "update_up_list" }, (response: unknown) => {
      console.log("[Stats] Update UP list response:", response);
      window.location.reload();
    });
  });

  const autoClassifyBtn = document.getElementById("btn-auto-classify");
  autoClassifyBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    chrome.runtime.sendMessage({ type: "start_auto_classify" }, (response: unknown) => {
      console.log("[Stats] Start auto classify response:", response);
    });
  });

  const probeBtn = document.getElementById("btn-probe-up");
  const probeInput = document.getElementById("probe-mid") as HTMLInputElement | null;
  const probeResult = document.getElementById("probe-result");
  probeBtn?.addEventListener("click", () => {
    if (typeof chrome === "undefined") return;
    const mid = Number(probeInput?.value ?? 0);
    if (!mid || Number.isNaN(mid)) {
      if (probeResult) probeResult.textContent = "请输入有效 mid";
      return;
    }
    chrome.runtime.sendMessage(
      { type: "probe_up", payload: { mid } },
      (response: unknown) => {
      const result = response as
        | { ok?: boolean; name?: string; videoCount?: number }
        | null;
      if (!probeResult) return;
      if (!result || !result.ok) {
        probeResult.textContent =
          "获取失败，请确认已打开任意 B 站页面并保持登录";
        return;
      }
      probeResult.textContent = `UP: ${result.name ?? "-"} | videos: ${result.videoCount ?? 0}`;
      }
    );
  });

  // 获取已关注的UP列表
  const followedUPs = await getFollowedUPList();
  const tagLibrary = await getTagLibrary();
  const customTags = (await getValue<string[]>("customTags")) ?? [];
  const videoCounts = (await getValue<Record<string, number>>("videoCounts")) ?? {};
  
  // 加载分类库
  const categoryLibrary = await getCategoryLibrary();
  setCategories(Object.values(categoryLibrary));

  // 设置当前UP列表和缓存
  currentUpList = followedUPs;
  upCache = { upList: followedUPs};
  
  // 从标签库和UP手动标签构建currentUpTags
  const upTags: Record<string, string[]> = {};
  for (const up of followedUPs) {
    const manualTagIds = await getUPManualTags(up.mid);
    upTags[String(up.mid)] = manualTagIds
      .map(tagId => tagLibrary[tagId]?.name)
      .filter((name): name is string => name !== undefined);
  }
  currentUpTags = upTags;
  setCurrentCustomTags(customTags);

  // 加载UP标签权重缓存
  upTagCache = (await getValue<UPTagWeightsCache>("upTagWeightsCache")) ?? {};

  setText("stat-up-count", String(upCache.upList?.length ?? 0));
  setText("stat-tag-count", String(countUpTags(upTags)));
  setText("stat-video-count", String(countVideoTotals(videoCounts)));

  await renderUpList(currentUpList, currentUpTags);
  await renderTags(currentUpTags);
  renderCategories();
  setupDragAndDrop();

  // Search box event
  const searchInput = document.getElementById("tag-search") as HTMLInputElement | null;
  searchInput?.addEventListener("input", (e) => {
    const searchTerm = (e.target as HTMLInputElement).value;
    void renderTags(currentUpTags, searchTerm);
  });

  // UP search box event
  const upSearchInput = document.getElementById("up-search") as HTMLInputElement | null;
  upSearchInput?.addEventListener("input", () => {
    refreshUpList();
  });

  const addTagBtn = document.getElementById("btn-add-tag");
  addTagBtn?.addEventListener("click", () => {
    const value = searchInput?.value ?? "";
    void addCustomTag(value, currentUpTags);
  });

  // Category search and add
  const categorySearchInput = document.getElementById("category-search") as HTMLInputElement | null;
  const addCategoryBtn = document.getElementById("btn-add-category");
  categorySearchInput?.addEventListener("input", () => {
    renderCategories(categorySearchInput.value);
  });
  addCategoryBtn?.addEventListener("click", () => {
    const value = categorySearchInput?.value ?? "";
    if (value.trim()) {
      addCategory(value.trim());
      if (categorySearchInput) {
        categorySearchInput.value = "";
      }
    }
  });

  // Filter buttons
  const applyFilterBtn = document.getElementById("btn-apply-filter");
  const clearFilterBtn = document.getElementById("btn-clear-filter");

  applyFilterBtn?.addEventListener("click", () => {
    refreshUpList();
  });

  clearFilterBtn?.addEventListener("click", () => {
    includeTags = [];
    excludeTags = [];
    includeCategories = [];
    excludeCategories = [];
    renderFilterTags();
    refreshUpList();
  });
}

if (typeof document !== "undefined") {
  void initStats();
}
