/**
 * Stats page logic.
 */

import { getValue, setValue, getUPTagCounts, getUPManualTags, getAllUPManualTags, addTagToUPManualTags, removeTagFromUPManualTags, getTagLibrary, addTagToLibrary, type UPTagCache } from "../../storage/storage.js";

export interface InterestProfile {
  [tag: string]: { tag: string; score: number };
}

export interface UPCache {
  upList: { mid: number; name: string; face: string; is_followed?: boolean }[];
}

export interface UPTagCount {
  tag: string;
  count: number;
}

export interface Category {
  id: string;
  name: string;
  tags: string[];
}

declare const chrome: {
  runtime: {
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => void;
  };
};

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

export function countVideoTotals(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, value) => total + (value ?? 0), 0);
}

export function countUpTags(upTags: Record<string, string[]>): number {
  return Object.values(upTags).reduce((total, tags) => total + (tags?.length ?? 0), 0);
}

export function buildInterestRows(profile: InterestProfile): { tag: string; score: number }[] {
  return Object.values(profile).sort((a, b) => b.score - a.score);
}

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

function renderTagPill(tag: string, count?: number): HTMLSpanElement {
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
    dragContext = { tag, dropped: false };
  });
  pill.addEventListener("dragend", () => {
    removeDragGhost();
    // If tag was not dropped in a valid zone, remove it from category
    if (dragContext && !dragContext.dropped && dragContext.categoryId) {
      removeTagFromCategory(dragContext.categoryId, tag);
    }
    dragContext = null;
  });
  
  return pill;
}

let dragGhost: HTMLElement | null = null;
let dragContext: { tag: string; originUpMid?: number; categoryId?: string; dropped: boolean } | null = null;
let globalDragOverHandler: ((e: DragEvent) => void) | null = null;

function createDragGhost(e: DragEvent, tag: string): void {
  removeDragGhost();
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.textContent = tag;
  ghost.style.backgroundColor = colorFromTag(tag);
  ghost.style.padding = "8px 16px";
  ghost.style.borderRadius = "999px";
  ghost.style.color = "#1f2430";
  ghost.style.fontSize = "13px";
  ghost.style.fontWeight = "600";
  document.body.appendChild(ghost);
  dragGhost = ghost;
  if (e.dataTransfer) {
    e.dataTransfer.setDragImage(ghost, 0, 0);
  }
  if (!globalDragOverHandler) {
    globalDragOverHandler = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    };
    document.addEventListener("dragover", globalDragOverHandler);
  }
  
  const moveGhost = (moveEvent: MouseEvent) => {
    if (dragGhost) {
      dragGhost.style.left = moveEvent.clientX + "px";
      dragGhost.style.top = moveEvent.clientY + "px";
    }
  };
  
  document.addEventListener("mousemove", moveGhost);
  document.addEventListener("mouseup", () => {
    document.removeEventListener("mousemove", moveGhost);
    setTimeout(() => removeDragGhost(), 100);
  }, { once: true });
}

function removeDragGhost(): void {
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  if (globalDragOverHandler) {
    document.removeEventListener("dragover", globalDragOverHandler);
    globalDragOverHandler = null;
  }
}

let allTagCounts: Record<string, number> = {};
let filteredTags: string[] = [];
let currentCustomTags: string[] = [];
let categories: Category[] = [];
let filteredCategories: Category[] = [];
let showFollowedOnly = true; // 默认显示已关注的UP

function renderTags(upTags: Record<string, string[]>, searchTerm: string = ""): void {
  const container = document.getElementById("tag-list");
  if (!container) return;
  container.innerHTML = "";
  const tags = Object.values(upTags).flat();
  if (tags.length === 0 && currentCustomTags.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无分类词条";
    container.appendChild(item);
    return;
  }
  
  // Count all tags
  allTagCounts = {};
  for (const tag of tags) {
    allTagCounts[tag] = (allTagCounts[tag] ?? 0) + 1;
  }
  
  // Ensure custom tags are included
  for (const tag of currentCustomTags) {
    if (!allTagCounts[tag]) {
      allTagCounts[tag] = 0;
    }
  }
  
  // Filter tags by search term
  if (searchTerm) {
    filteredTags = Object.keys(allTagCounts).filter(tag => 
      tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } else {
    filteredTags = Object.keys(allTagCounts);
  }
  
  // Sort by count
  const rows = filteredTags.map(tag => [tag, allTagCounts[tag]] as [string, number])
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

function renderCategories(searchTerm: string = ""): void {
  const container = document.getElementById("category-list");
  if (!container) return;
  container.innerHTML = "";
  
  if (categories.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无大分区";
    container.appendChild(item);
    return;
  }

  // Filter categories by search term
  if (searchTerm) {
    filteredCategories = categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } else {
    filteredCategories = categories;
  }

  for (const category of filteredCategories) {
    const item = document.createElement("div");
    item.draggable = true;
    item.addEventListener("dragstart", (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-bili-category-tag", JSON.stringify({ 
          tag: category.name, 
          categoryId: category.id 
        }));
        e.dataTransfer.effectAllowed = "move";
      }
      createDragGhost(e, category.name);
      dragContext = { tag: category.name, categoryId: category.id, dropped: false };
    });

    item.addEventListener("dragend", () => {
      removeDragGhost();
      dragContext = null;
    });

    item.className = "category-item";
    
    const header = document.createElement("div");
    header.className = "category-header";
    
    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category.name;
    
    const removeBtn = document.createElement("span");
    removeBtn.className = "category-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      removeCategory(category.id);
    });
    
    header.appendChild(name);
    header.appendChild(removeBtn);
    
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "category-tags";
    tagsContainer.dataset.categoryId = category.id;
    
    // Setup drag and drop for category tags
    setupCategoryTagDropZone(tagsContainer, category.id);
    
    for (const tag of category.tags) {
      tagsContainer.appendChild(renderCategoryTagPill(tag, category.id));
    }
    
    item.appendChild(header);
    item.appendChild(tagsContainer);
    container.appendChild(item);
  }
}

function renderCategoryTagPill(tag: string, categoryId: string): HTMLElement {
  const pill = document.createElement("span");
  pill.className = "tag-pill";
  pill.textContent = tag;
  pill.style.backgroundColor = colorFromTag(tag);
  pill.draggable = true;
  
  pill.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/x-bili-category-tag", JSON.stringify({ tag, categoryId }));
      e.dataTransfer.effectAllowed = "move";
    }
    createDragGhost(e, tag);
    dragContext = { tag, categoryId, dropped: false };
  });
  
  pill.addEventListener("dragend", () => {
    removeDragGhost();
    // If tag was not dropped in a valid zone, remove it from category
    if (dragContext && !dragContext.dropped && dragContext.categoryId) {
      removeTagFromCategory(dragContext.categoryId, tag);
    }
    dragContext = null;
  });
  
  return pill;
}

function setupCategoryTagDropZone(element: HTMLElement, categoryId: string): void {
  element.addEventListener("dragover", (e) => {
    e.preventDefault();
    element.classList.add("drag-over");
  });

  element.addEventListener("dragleave", () => {
    element.classList.remove("drag-over");
  });

  element.addEventListener("drop", (e) => {
    e.preventDefault();
    element.classList.remove("drag-over");

    const tag = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
    if (!tag) return;
    if (dragContext) {
      dragContext.dropped = true;
    }

    addTagToCategory(categoryId, tag);
  });
}

function addTagToCategory(categoryId: string, tag: string): void {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;
  
  if (!category.tags.includes(tag)) {
    category.tags.push(tag);
    saveCategories();
    renderCategories((document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "");
  }
}

function removeTagFromCategory(categoryId: string, tag: string): void {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;
  
  category.tags = category.tags.filter(t => t !== tag);
  saveCategories();
  renderCategories((document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "");
}

function addCategory(name: string): void {
  const id = `category-${Date.now()}`;
  const newCategory: Category = {
    id,
    name,
    tags: []
  };
  categories.push(newCategory);
  saveCategories();
  renderCategories((document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "");
}

function removeCategory(categoryId: string): void {
  categories = categories.filter(c => c.id !== categoryId);
  saveCategories();
  renderCategories((document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "");
}

function saveCategories(): void {
  void setValue("categories", categories);
}

let includeTags: string[] = [];
let excludeTags: string[] = [];
let includeCategories: string[] = [];
let excludeCategories: string[] = [];
let upTagCache: UPTagCache = {};

/**
 * 获取UP的自动标签（权重最高的前3个，且不与手动标签重复）
 */
function getAutoTagsForUp(mid: number, manualTags: string[]): { tag: string; count: number }[] {
  const autoTags = upTagCache[String(mid)]?.tags ?? [];
  const manualTagSet = new Set(manualTags);

  // 过滤掉与手动标签重复的标签，并取前3个
  return autoTags
    .filter((tag: UPTagCount) => !manualTagSet.has(tag.tag))
    .slice(0, 3);
}

function renderUpList(
  upList: UPCache["upList"],
  upTags: Record<string, string[]>
): void {
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
  
  // 根据切换开关过滤UP列表
  let filteredUpList = upList;
  if (showFollowedOnly) {
    filteredUpList = upList.filter(up => up.is_followed !== false);
  } else {
    filteredUpList = upList.filter(up => up.is_followed === false);
  }
  
  // Filter UP list based on include/exclude tags
  if (includeTags.length > 0 || excludeTags.length > 0 || includeCategories.length > 0 || excludeCategories.length > 0 || searchTerm) {
    filteredUpList = filteredUpList.filter(up => {
      const tags = upTags[String(up.mid)] ?? [];
      
      // Check if all include tags are present
      const hasAllIncludeTags = includeTags.length === 0 || 
        includeTags.every(tag => tags.includes(tag));
      
      // Check if none of the exclude tags are present
      const hasNoExcludeTags = excludeTags.length === 0 || 
        !excludeTags.some(tag => tags.includes(tag));
      
      // Check if at least one tag from include categories is present (OR logic)
      const hasIncludeCategory = includeCategories.length === 0 ||
        includeCategories.some(categoryId => {
          const category = categories.find(c => c.id === categoryId);
          return category && category.tags.some(tag => tags.includes(tag));
        });

      // Check if no tag from exclude categories is present
      const hasNoExcludeCategory = excludeCategories.length === 0 ||
        !excludeCategories.some(categoryId => {
          const category = categories.find(c => c.id === categoryId);
          return category && category.tags.some(tag => tags.includes(tag));
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
    const autoTagList = getAutoTagsForUp(up.mid, manualTagList);

    // 渲染标签
    if (manualTagList.length === 0 && autoTagList.length === 0) {
      tags.textContent = "暂无分类";
    } else {
      // 先渲染手动标签
      for (const tag of manualTagList) {
        tags.appendChild(renderUpTagPill(tag, up.mid));
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

function renderInterests(rows: { tag: string; score: number }[]): void {
  const container = document.getElementById("interest-list");
  if (!container) return;
  container.innerHTML = "";
  if (rows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无兴趣数据";
    container.appendChild(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.textContent = row.tag;
    const value = document.createElement("span");
    value.textContent = row.score.toFixed(2);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}

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

function createFilterCategory(categoryId: string, type: "include" | "exclude"): HTMLElement {
  const category = categories.find(c => c.id === categoryId);
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
          const category = categories.find(c => c.id === categoryId);
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
      if (dragContext) {
        dragContext.dropped = true;
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

let currentUpList: UPCache["upList"] = [];
let currentUpTags: Record<string, string[]> = {};

function refreshUpList(): void {
  renderUpList(currentUpList, currentUpTags);
  updateToggleLabel();
}

function updateToggleLabel(): void {
  const toggleLabel = document.querySelector(".toggle-label");
  if (toggleLabel) {
    toggleLabel.textContent = showFollowedOnly ? "已关注" : "未关注";
  }
}

function normalizeTag(tag: string): string {
  return tag.trim();
}

async function addTagToUp(mid: number, tag: string): Promise<void> {
  const nextTag = normalizeTag(tag);
  if (!nextTag) return;
  const key = String(mid);
  const existing = currentUpTags[key] ?? [];
  if (existing.includes(nextTag)) return;
  
  // 将 tag 名称添加到标签库，并获取 tag ID
  const tagObj = await addTagToLibrary(nextTag);
  
  const next = [...existing, nextTag];
  currentUpTags = { ...currentUpTags, [key]: next };
  await addTagToUPManualTags(mid, tagObj.id);
  renderUpList(currentUpList, currentUpTags);
  renderTags(currentUpTags, (document.getElementById("tag-search") as HTMLInputElement | null)?.value ?? "");
}

async function removeTagFromUp(mid: number, tag: string): Promise<void> {
  const key = String(mid);
  const existing = currentUpTags[key] ?? [];
  if (!existing.includes(tag)) return;
  
  // 获取标签库，将 tag 名称转换为 tag ID
  const tagLibrary = await getTagLibrary();
  const tagObj = Object.values(tagLibrary).find(t => t.name === tag);
  
  const next = existing.filter((t) => t !== tag);
  currentUpTags = { ...currentUpTags, [key]: next };
  
  if (tagObj) {
    await removeTagFromUPManualTags(mid, tagObj.id);
  }
  
  renderUpList(currentUpList, currentUpTags);
  renderTags(currentUpTags, (document.getElementById("tag-search") as HTMLInputElement | null)?.value ?? "");
}

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
    if (dragContext) {
      dragContext.dropped = true;
    }
    void addTagToUp(mid, tag);
  });
}

function renderUpTagPill(tag: string, mid: number): HTMLSpanElement {
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
    dragContext = { tag, originUpMid: mid, dropped: false };
  });
  pill.addEventListener("dragend", () => {
    removeDragGhost();
    if (dragContext?.originUpMid === mid && !dragContext.dropped) {
      void removeTagFromUp(mid, tag);
    }
    dragContext = null;
  });
  return pill;
}

function renderAutoTagPill(tag: string, count: number): HTMLSpanElement {
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

async function addCustomTag(tag: string): Promise<void> {
  const next = normalizeTag(tag);
  if (!next) return;
  if (currentCustomTags.includes(next)) return;
  currentCustomTags = [...currentCustomTags, next];
  await setValue("customTags", currentCustomTags);
  renderTags(currentUpTags, (document.getElementById("tag-search") as HTMLInputElement | null)?.value ?? "");
}

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

  const upCache = (await getValue<UPCache>("upList")) ?? { upList: [] };
  const upTagCounts = await getUPTagCounts();
  const upManualTags = await getAllUPManualTags();
  const customTags = (await getValue<string[]>("customTags")) ?? [];
  const videoCounts = (await getValue<Record<string, number>>("videoCounts")) ?? {};
  
  // 获取标签库，用于将 tag ID 转换为 tag 名称
  const tagLibrary = await getTagLibrary();
  
  // 将 upTagCounts 转换为 upTags 格式
  const upTags: Record<string, string[]> = {};
  for (const [mid, tagData] of Object.entries(upTagCounts)) {
    upTags[mid] = tagData.tags.map(t => {
      const tag = tagLibrary[t.tag];
      return tag ? tag.name : t.tag;
    });
  }
  
  // 合并手动标签
  for (const [mid, tagIds] of Object.entries(upManualTags)) {
    if (!upTags[mid]) {
      upTags[mid] = [];
    }
    for (const tagId of tagIds) {
      const tag = tagLibrary[tagId];
      const tagName = tag ? tag.name : tagId;
      if (!upTags[mid].includes(tagName)) {
        upTags[mid].push(tagName);
      }
    }
  }
  
  currentUpList = upCache.upList ?? [];
  currentUpTags = upTags;
  currentCustomTags = customTags;
  categories = (await getValue<Category[]>("categories")) ?? [];

  setText("stat-up-count", String(upCache.upList?.length ?? 0));
  setText("stat-tag-count", String(countUpTags(upTags)));
  setText("stat-video-count", String(countVideoTotals(videoCounts)));

  renderUpList(currentUpList, currentUpTags);
  renderTags(currentUpTags);
  renderCategories();
  setupDragAndDrop();
  
  // Search box event
  const searchInput = document.getElementById("tag-search") as HTMLInputElement | null;
  searchInput?.addEventListener("input", (e) => {
    const searchTerm = (e.target as HTMLInputElement).value;
    renderTags(currentUpTags, searchTerm);
  });

  // UP search box event
  const upSearchInput = document.getElementById("up-search") as HTMLInputElement | null;
  upSearchInput?.addEventListener("input", () => {
    refreshUpList();
  });
  
  // Show followed toggle event
  const showFollowedToggle = document.getElementById("show-followed-toggle") as HTMLInputElement | null;
  showFollowedToggle?.addEventListener("change", (e) => {
    showFollowedOnly = (e.target as HTMLInputElement).checked;
    refreshUpList();
  });
  
  // 初始化切换开关文本
  updateToggleLabel();

  const addTagBtn = document.getElementById("btn-add-tag");
  addTagBtn?.addEventListener("click", () => {
    const value = searchInput?.value ?? "";
    void addCustomTag(value);
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
