
import { getDragContext } from "./drag.js";
import { colorFromTag, findCategory, removeFromList, resetFilters } from "./helpers.js";
import type { StatsState } from "./types.js";

type RefreshFn = () => void;

function createFilterTag(tagId: string, type: "include" | "exclude", state: StatsState, refresh: RefreshFn): HTMLElement {
  const tagName = state.tagIdToName[tagId] || tagId;
  const tagEl = document.createElement("div");
  tagEl.className = "filter-tag";
  tagEl.textContent = tagName;
  tagEl.style.backgroundColor = colorFromTag(tagName);
  tagEl.dataset.tagId = tagId;

  const removeBtn = document.createElement("span");
  removeBtn.className = "remove-tag";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => {
    // 立即移除 DOM 元素
    tagEl.remove();

    // 更新状态
    if (type === "include") {
      state.filters.includeTags = removeFromList(state.filters.includeTags, tagId);
    } else {
      state.filters.excludeTags = removeFromList(state.filters.excludeTags, tagId);
    }

    // 只刷新 UP 列表，不重新渲染筛选标签
    refresh();
  });

  tagEl.appendChild(removeBtn);
  return tagEl;
}

function createFilterCategory(
  categoryId: string,
  type: "include" | "exclude",
  state: StatsState,
  refresh: RefreshFn
): HTMLElement {
  const category = findCategory(state.categories, categoryId);
  const categoryEl = document.createElement("div");
  categoryEl.className = "filter-tag filter-tag-category";
  categoryEl.style.backgroundColor = "#2b6cff";
  categoryEl.style.color = "#fff";
  categoryEl.textContent = category?.name ?? "未知分区";

  const removeBtn = document.createElement("span");
  removeBtn.className = "remove-tag";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => {
    // 立即移除 DOM 元素
    categoryEl.remove();

    // 更新状态
    if (type === "include") {
      state.filters.includeCategories = removeFromList(state.filters.includeCategories, categoryId);
    } else {
      state.filters.excludeCategories = removeFromList(state.filters.excludeCategories, categoryId);
    }

    // 只刷新 UP 列表，不重新渲染筛选标签
    refresh();
  });

  categoryEl.appendChild(removeBtn);
  return categoryEl;
}

export function renderFilterTags(state: StatsState, refresh: RefreshFn): void {
  const includeContainer = document.getElementById("filter-include-tags");
  const excludeContainer = document.getElementById("filter-exclude-tags");
  if (!includeContainer || !excludeContainer) {
    return;
  }

  includeContainer.innerHTML = "";
  excludeContainer.innerHTML = "";

  for (const tag of state.filters.includeTags) {
    includeContainer.appendChild(createFilterTag(tag, "include", state, refresh));
  }
  for (const tag of state.filters.excludeTags) {
    excludeContainer.appendChild(createFilterTag(tag, "exclude", state, refresh));
  }
  for (const categoryId of state.filters.includeCategories) {
    includeContainer.appendChild(createFilterCategory(categoryId, "include", state, refresh));
  }
  for (const categoryId of state.filters.excludeCategories) {
    excludeContainer.appendChild(createFilterCategory(categoryId, "exclude", state, refresh));
  }
}

function applyCategoryFilter(state: StatsState, categoryId: string, type: "include" | "exclude"): void {
  if (type === "include") {
    if (!state.filters.includeCategories.includes(categoryId)) {
      state.filters.includeCategories.push(categoryId);
    }
    state.filters.excludeCategories = removeFromList(state.filters.excludeCategories, categoryId);
    return;
  }

  if (!state.filters.excludeCategories.includes(categoryId)) {
    state.filters.excludeCategories.push(categoryId);
  }
  state.filters.includeCategories = removeFromList(state.filters.includeCategories, categoryId);
}

function applyTagFilter(state: StatsState, tagId: string, type: "include" | "exclude"): void {
  if (type === "include") {
    state.filters.excludeTags = removeFromList(state.filters.excludeTags, tagId);
    if (!state.filters.includeTags.includes(tagId)) {
      state.filters.includeTags.push(tagId);
    }
    return;
  }

  state.filters.includeTags = removeFromList(state.filters.includeTags, tagId);
  if (!state.filters.excludeTags.includes(tagId)) {
    state.filters.excludeTags.push(tagId);
  }
}

export function setupDragAndDrop(state: StatsState, refresh: RefreshFn): void {
  const includeZone = document.getElementById("filter-include-tags");
  const excludeZone = document.getElementById("filter-exclude-tags");
  if (!includeZone || !excludeZone) {
    return;
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
    zone.element.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.element.classList.remove("drag-over");

      const categoryTagData = e.dataTransfer?.getData("application/x-bili-category-tag");
      if (categoryTagData) {
        try {
          const payload = JSON.parse(categoryTagData) as { categoryId?: string };
          if (payload.categoryId) {
            applyCategoryFilter(state, payload.categoryId, zone.type);
            renderFilterTags(state, refresh);
            refresh();
          }
        } catch {
          return;
        }
        return;
      }

      const tagData = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
      if (!tagData) {
        return;
      }

      // 解析标签 ID 和名称
      let tagId: string;
      try {
        const parsed = JSON.parse(tagData);
        if (parsed.tagId) {
          tagId = parsed.tagId;
        } else {
          // 兼容旧格式（仅标签名称）
          tagId = Object.entries(state.tagIdToName).find(([_, name]) => name === tagData)?.[0] || tagData;
        }
      } catch {
        // 如果不是 JSON 格式，尝试作为标签名称处理
        tagId = Object.entries(state.tagIdToName).find(([_, name]) => name === tagData)?.[0] || tagData;
      }

      const currentDrag = getDragContext();
      if (currentDrag) {
        currentDrag.dropped = true;
      }

      applyTagFilter(state, tagId, zone.type);
      renderFilterTags(state, refresh);
      refresh();
    });
  }
}

export function clearFilters(state: StatsState, refresh: RefreshFn): void {
  resetFilters(state.filters);
  renderFilterTags(state, refresh);
  refresh();
}
