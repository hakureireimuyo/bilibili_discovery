import type { StatsState } from "./types.js";
import type { UP } from "../../database/implementations/index.js";
import { createDragGhost, getDragContext, removeDragGhost, setDragContext } from "./drag.js";
import { colorFromTag, findCategory, getInputValue, updateToggleLabel } from "./helpers.js";
import { addTagToUp, getAutoTagsForUp, removeTagFromUp, renderAutoTagPill, renderTagPill } from "./tag-manager.js";

type RenderFn = () => void;

function matchesFilters(state: StatsState, up: UP): boolean {
  const tags = state.currentUpTags[String(up.mid)] ?? [];
  const searchTerm = getInputValue("up-search").toLowerCase();

  const hasAllIncludeTags =
    state.filters.includeTags.length === 0 || state.filters.includeTags.every((tag) => tags.includes(tag));
  const hasNoExcludeTags =
    state.filters.excludeTags.length === 0 || !state.filters.excludeTags.some((tag) => tags.includes(tag));
  const hasIncludeCategory =
    state.filters.includeCategories.length === 0 ||
    state.filters.includeCategories.some((categoryId) => {
      const category = findCategory(state.categories, categoryId);
      return Boolean(category && category.tags.some((tag) => tags.includes(tag)));
    });
  const hasNoExcludeCategory =
    state.filters.excludeCategories.length === 0 ||
    !state.filters.excludeCategories.some((categoryId) => {
      const category = findCategory(state.categories, categoryId);
      return Boolean(category && category.tags.some((tag) => tags.includes(tag)));
    });
  const matchesSearch = !searchTerm || up.name.toLowerCase().includes(searchTerm);

  return hasAllIncludeTags && hasNoExcludeTags && hasIncludeCategory && hasNoExcludeCategory && matchesSearch;
}

function filterUpList(state: StatsState): UP[] {
  const filteredByFollow = state.currentUpList.filter((up) => {
    if (state.showFollowedOnly) {
      return up.is_followed !== false;
    }
    return up.is_followed === false;
  });
  return filteredByFollow.filter((up) => matchesFilters(state, up));
}

function setupUpTagDropZone(tagsEl: HTMLElement, mid: number, state: StatsState, rerender: RenderFn): void {
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
    if (!tag) {
      return;
    }
    const currentDrag = getDragContext();
    if (currentDrag) {
      currentDrag.dropped = true;
    }
    void addTagToUp(state, mid, tag, rerender);
  });
}

function renderUpTagPill(tag: string, mid: number, state: StatsState, rerender: RenderFn): HTMLSpanElement {
  return renderTagPill(tag, { mid, state, rerender });
}

async function buildTagContainer(state: StatsState, mid: number, rerender: RenderFn): Promise<HTMLElement> {
  const tags = document.createElement("div");
  tags.className = "up-tags";
  setupUpTagDropZone(tags, mid, state, rerender);

  const manualTagList = state.upManualTagsMap[String(mid)] ?? [];
  const autoTagList = await getAutoTagsForUp(state, mid, manualTagList);
  if (manualTagList.length === 0 && autoTagList.length === 0) {
    tags.textContent = "暂无分类";
    return tags;
  }

  for (const tag of manualTagList) {
    tags.appendChild(renderUpTagPill(tag, mid, state, rerender));
  }
  if (manualTagList.length > 0 && autoTagList.length > 0) {
    const separator = document.createElement("span");
    separator.className = "tag-separator";
    separator.textContent = "|";
    separator.style.margin = "0 12px";
    separator.style.opacity = "0.5";
    separator.style.fontSize = "16px";
    separator.style.height = "20px";
    separator.style.display = "inline-block";
    tags.appendChild(separator);
  }
  for (const autoTag of autoTagList) {
    tags.appendChild(renderAutoTagPill(autoTag.tag, autoTag.count));
  }
  return tags;
}

export function refreshUpList(state: StatsState, rerender: RenderFn): void {
  void renderUpList(state, rerender);
  updateToggleLabel(state.showFollowedOnly);
}

export async function renderUpList(state: StatsState, rerender: RenderFn): Promise<void> {
  const container = document.getElementById("up-list");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  if (state.currentUpList.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无关注UP";
    container.appendChild(item);
    return;
  }

  const list = filterUpList(state);
  for (const up of list) {
    const item = document.createElement("div");
    item.className = "up-item";
    item.dataset.mid = String(up.mid);

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

    info.appendChild(name);
    info.appendChild(await buildTagContainer(state, up.mid, rerender));
    item.appendChild(avatarLink);
    item.appendChild(info);
    container.appendChild(item);
  }
}
