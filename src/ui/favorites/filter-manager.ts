import { getInputValue, colorFromTag, removeFromList, resetFilters } from "./helpers.js";
import type { FavoritesState } from "./types.js";
import { getAllTags as getAllVideoTags } from "../../query/video/index.js";
import { getTagsByIds } from "../../query/tag/index.js";

type RefreshFn = () => void;

// 标签名称缓存
const tagNameCache = new Map<string, string>();

/**
 * 获取标签名称
 * 通过查询层获取标签数据
 */
async function getTagName(tagId: string): Promise<string> {
  const cached = tagNameCache.get(tagId);
  if (cached) {
    return cached;
  }

  try {
    const tag = await getTagsByIds([tagId]);
    const tagName = tag.get(tagId)?.name || tagId;
    tagNameCache.set(tagId, tagName);
    return tagName;
  } catch (error) {
    console.warn('[FilterManager] Error getting tag name:', error);
    return tagId;
  }
}

async function createFilterTag(tag: string, type: "include" | "exclude", state: FavoritesState, refresh: RefreshFn): Promise<HTMLElement> {
  const tagName = await getTagName(tag);
  const tagEl = document.createElement("div");
  tagEl.className = "filter-tag";
  tagEl.textContent = tagName;
  tagEl.style.backgroundColor = colorFromTag(tagName);

  const removeBtn = document.createElement("span");
  removeBtn.className = "remove-tag";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", async () => {
    if (type === "include") {
      state.filters.includeTags = removeFromList(state.filters.includeTags, tag);
    } else {
      state.filters.excludeTags = removeFromList(state.filters.excludeTags, tag);
    }
    await applyFilters(state);
    await renderFilterTags(state, refresh);
    await refresh();
  });

  tagEl.appendChild(removeBtn);
  return tagEl;
}

export async function renderFilterTags(state: FavoritesState, refresh: RefreshFn): Promise<void> {
  const includeContainer = document.getElementById("filter-include-tags");
  const excludeContainer = document.getElementById("filter-exclude-tags");
  if (!includeContainer || !excludeContainer) {
    return;
  }

  includeContainer.innerHTML = "";
  excludeContainer.innerHTML = "";

  const includePromises = state.filters.includeTags.map(async (tag) => {
    const tagEl = await createFilterTag(tag, "include", state, refresh);
    includeContainer.appendChild(tagEl);
  });

  const excludePromises = state.filters.excludeTags.map(async (tag) => {
    const tagEl = await createFilterTag(tag, "exclude", state, refresh);
    excludeContainer.appendChild(tagEl);
  });

  await Promise.all([...includePromises, ...excludePromises]);
}

function applyTagFilter(state: FavoritesState, tag: string, type: "include" | "exclude"): void {
  if (type === "include") {
    state.filters.excludeTags = removeFromList(state.filters.excludeTags, tag);
    if (!state.filters.includeTags.includes(tag)) {
      state.filters.includeTags.push(tag);
    }
    return;
  }

  state.filters.includeTags = removeFromList(state.filters.includeTags, tag);
  if (!state.filters.excludeTags.includes(tag)) {
    state.filters.excludeTags.push(tag);
  }
}

export async function applyFilters(state: FavoritesState): Promise<void> {
  const keyword = getInputValue('searchInput').trim();

  // 解析搜索关键词，支持@UP主名格式
  let searchKeyword = keyword;
  let creatorName = '';

  if (keyword.startsWith('@')) {
    const atIndex = keyword.indexOf('@');
    const spaceIndex = keyword.indexOf(' ', atIndex);

    if (spaceIndex !== -1) {
      creatorName = keyword.substring(atIndex + 1, spaceIndex);
      searchKeyword = keyword.substring(spaceIndex + 1).trim();
    } else {
      creatorName = keyword.substring(atIndex + 1);
      searchKeyword = '';
    }
  }

  state.filters = {
    keyword: searchKeyword,
    tagId: '',
    creatorId: creatorName,
    includeTags: state.filters.includeTags,
    excludeTags: state.filters.excludeTags
  };

  // 筛选逻辑已移至后端，通过loadCollectionData实现
  // 重置页码
  state.currentPage = 0;
}

export async function updateFilterOptions(state: FavoritesState): Promise<void> {
  // 从查询层获取所有标签
  try {
    const tags = await getAllVideoTags(state.currentCollectionId || undefined);
    // 渲染标签列表
    await renderTagList(state, tags);
  } catch (error) {
    console.error('[FilterManager] Error loading tags:', error);
    // 渲染空标签列表
    await renderTagList(state, []);
  }
}

async function renderTagList(state: FavoritesState, tags: string[]): Promise<void> {
  const container = document.getElementById("tag-list");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  if (tags.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无标签";
    container.appendChild(item);
    return;
  }

  for (const tag of tags) {
    const tagName = await getTagName(tag);
    const item = document.createElement("div");
    item.className = "list-item";
    item.dataset.tagId = tag;

    const label = document.createElement("span");
    label.className = "tag-pill";
    label.textContent = tagName;
    label.style.backgroundColor = colorFromTag(tagName);
    label.draggable = true;

    // 拖拽事件
    label.addEventListener("dragstart", (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-bili-tag", tag);
        e.dataTransfer.effectAllowed = "copy";
      }
    });

    item.appendChild(label);
    container.appendChild(item);
  }
}

export function clearFilters(state: FavoritesState): void {
  resetFilters(state.filters);

  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  if (searchInput) searchInput.value = '';

  state.filteredVideos = state.aggregatedVideos;
  state.currentPage = 0;
}

export function setupDragAndDrop(state: FavoritesState, refresh: RefreshFn): void {
  const includeZone = document.getElementById("filter-include-tags");
  const excludeZone = document.getElementById("filter-exclude-tags");
  const tagSearchInput = document.getElementById("tagSearchInput") as HTMLInputElement | null;

  if (!includeZone || !excludeZone) {
    return;
  }

  // 标签搜索功能
  if (tagSearchInput) {
    tagSearchInput.addEventListener("input", (e) => {
      const searchTerm = (e.target as HTMLInputElement).value.toLowerCase().trim();
      filterTagList(searchTerm);
    });
  }

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
    zone.element.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.element.classList.remove("drag-over");

      const tag = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
      if (!tag) {
        return;
      }

      applyTagFilter(state, tag, zone.type);
      await applyFilters(state);
      await renderFilterTags(state, refresh);
      await refresh();
    });
  }
}

function filterTagList(searchTerm: string): void {
  const container = document.getElementById("tag-list");
  if (!container) {
    return;
  }

  const items = container.querySelectorAll(".list-item");
  items.forEach(item => {
    const element = item as HTMLElement;
    const tagLabel = element.querySelector(".tag-pill")?.textContent?.toLowerCase() || "";

    const shouldShow = searchTerm === "" || tagLabel.includes(searchTerm);
    element.style.display = shouldShow ? "flex" : "none";
  });
}
