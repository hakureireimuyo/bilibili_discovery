import {
  getAllUPManualTags,
  getCategoryLibrary,
  getTagLibrary,
  getUPTagCounts,
  getValue,
  loadUPList,
  type UPTagCache
} from "../../database/implementations/index.js";
import { bindPageActions } from "./page-actions.js";
import { addCategory, renderCategories } from "./category-manager.js";
import { clearFilters, renderFilterTags, setupDragAndDrop } from "./filter-manager.js";
import { countUpTags, countVideoTotals, createInitialState, getInputValue, setText, updateToggleLabel } from "./helpers.js";
import { addCustomTag, renderTagList } from "./tag-manager.js";
import type { Category, StatsState } from "./types.js";
import type { UPCache } from "../../database/implementations/index.js";
import { refreshUpList } from "./up-list.js";

export { countVideoTotals, countUpTags, colorFromTag } from "./helpers.js";

async function hydrateTagState(state: StatsState, upTagCounts: UPTagCache): Promise<Record<string, string[]>> {
  const tagLibrary = await getTagLibrary();
  state.upAutoTags = {};
  for (const [mid, tagData] of Object.entries(upTagCounts)) {
    state.upAutoTags[mid] = tagData.tags.map((tag) => {
      const tagInfo = tagLibrary[tag.tag];
      return tagInfo ? tagInfo.name : tag.tag;
    });
  }

  const upManualTags = await getAllUPManualTags();
  state.upManualTagsMap = {};
  for (const [mid, tagIds] of Object.entries(upManualTags)) {
    state.upManualTagsMap[mid] = tagIds.map((tagId) => {
      const tag = tagLibrary[tagId];
      return tag ? tag.name : tagId;
    });
  }

  const upTags: Record<string, string[]> = {};
  for (const mid of Object.keys(state.upAutoTags)) {
    upTags[mid] = [...new Set([...(state.upAutoTags[mid] || []), ...(state.upManualTagsMap[mid] || [])])];
  }
  for (const mid of Object.keys(state.upManualTagsMap)) {
    if (!upTags[mid]) {
      upTags[mid] = state.upManualTagsMap[mid];
    }
  }
  return upTags;
}

function rerenderPage(state: StatsState): void {
  const refreshOnly = () => refreshUpList(state, () => rerenderPage(state));
  refreshOnly();
  renderTagList(state);
  renderCategories(state, () => rerenderPage(state));
  renderFilterTags(state, refreshOnly);
}

function bindInputs(state: StatsState): void {
  const tagSearchInput = document.getElementById("tag-search") as HTMLInputElement | null;
  tagSearchInput?.addEventListener("input", () => renderTagList(state));

  const upSearchInput = document.getElementById("up-search") as HTMLInputElement | null;
  upSearchInput?.addEventListener("input", () => refreshUpList(state, () => rerenderPage(state)));

  const showFollowedToggle = document.getElementById("show-followed-toggle") as HTMLInputElement | null;
  showFollowedToggle?.addEventListener("change", (e) => {
    state.showFollowedOnly = (e.target as HTMLInputElement).checked;
    refreshUpList(state, () => rerenderPage(state));
  });

  const addTagBtn = document.getElementById("btn-add-tag");
  addTagBtn?.addEventListener("click", () => {
    void addCustomTag(state, getInputValue("tag-search"), () => renderTagList(state));
  });

  const categorySearchInput = document.getElementById("category-search") as HTMLInputElement | null;
  categorySearchInput?.addEventListener("input", () => renderCategories(state, () => rerenderPage(state)));

  const addCategoryBtn = document.getElementById("btn-add-category");
  addCategoryBtn?.addEventListener("click", () => {
    const value = getInputValue("category-search").trim();
    if (!value) {
      return;
    }
    addCategory(state, value, () => renderCategories(state, () => rerenderPage(state)));
    if (categorySearchInput) {
      categorySearchInput.value = "";
    }
  });

  const clearFilterBtn = document.getElementById("btn-clear-filter");
  clearFilterBtn?.addEventListener("click", () => {
    clearFilters(state, () => refreshUpList(state, () => rerenderPage(state)));
  });
}

async function loadState(state: StatsState): Promise<void> {
  const upCache = (await loadUPList()) ?? ({ upList: [], lastUpdate: 0 } as UPCache);
  const upTagCounts = await getUPTagCounts();
  const customTags = (await getValue<string[]>("customTags")) ?? [];
  const videoCounts = (await getValue<Record<string, number>>("videoCounts")) ?? {};
  const categoryLibrary = await getCategoryLibrary();
  const tagLibrary = await getTagLibrary();
  const categories = Object.values(categoryLibrary).map((category) => ({
    id: category.id,
    name: category.name,
    tags: category.tag_ids.map((tagId) => tagLibrary[tagId]?.name ?? tagId)
  })) as Category[];

  state.upTagCache = upTagCounts;
  state.currentUpList = upCache.upList ?? [];
  state.currentUpTags = await hydrateTagState(state, upTagCounts);
  state.currentCustomTags = customTags;
  state.categories = categories;

  setText("stat-up-count", String(state.currentUpList.length));
  setText("stat-tag-count", String(countUpTags(state.currentUpTags)));
  setText("stat-video-count", String(countVideoTotals(videoCounts)));
}

export async function initStats(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }

  const state = createInitialState();
  bindPageActions();
  await loadState(state);

  setupDragAndDrop(state, () => refreshUpList(state, () => rerenderPage(state)));
  bindInputs(state);
  updateToggleLabel(state.showFollowedOnly);
  rerenderPage(state);
}

if (typeof document !== "undefined") {
  void initStats();
}
