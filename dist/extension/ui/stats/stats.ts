/**
 * Stats page logic.
 */

import { getValue, setValue } from "../../storage/storage.js";

export interface InterestProfile {
  [tag: string]: { tag: string; score: number };
}

export interface UPCache {
  upList: { mid: number; name: string; face: string }[];
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
    dragContext = null;
  });
  
  return pill;
}

let dragGhost: HTMLElement | null = null;
let dragContext: { tag: string; originUpMid?: number; dropped: boolean } | null = null;
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

let includeTags: string[] = [];
let excludeTags: string[] = [];

function renderUpList(
  upList: UPCache["upList"],
  upTags: Record<string, string[]>
): void {
  const container = document.getElementById("up-list");
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
  if (includeTags.length > 0 || excludeTags.length > 0) {
    filteredUpList = upList.filter(up => {
      const tags = upTags[String(up.mid)] ?? [];
      
      // Check if all include tags are present
      const hasAllIncludeTags = includeTags.length === 0 || 
        includeTags.every(tag => tags.includes(tag));
      
      // Check if none of the exclude tags are present
      const hasNoExcludeTags = excludeTags.length === 0 || 
        !excludeTags.some(tag => tags.includes(tag));
      
      return hasAllIncludeTags && hasNoExcludeTags;
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
    const tagList = upTags[String(up.mid)] ?? [];
    if (tagList.length === 0) {
      tags.textContent = "暂无分类";
    } else {
      for (const tag of tagList) {
        tags.appendChild(renderUpTagPill(tag, up.mid));
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
}

function createFilterTag(tag: string, type: "include" | "exclude"): HTMLElement {
  const tagEl = document.createElement("div");
  tagEl.className = "filter-tag";
  tagEl.textContent = tag;
  
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
  const next = [...existing, nextTag];
  currentUpTags = { ...currentUpTags, [key]: next };
  await setValue("upTags", currentUpTags);
  renderUpList(currentUpList, currentUpTags);
  renderTags(currentUpTags, (document.getElementById("tag-search") as HTMLInputElement | null)?.value ?? "");
}

async function removeTagFromUp(mid: number, tag: string): Promise<void> {
  const key = String(mid);
  const existing = currentUpTags[key] ?? [];
  if (!existing.includes(tag)) return;
  const next = existing.filter((t) => t !== tag);
  currentUpTags = { ...currentUpTags, [key]: next };
  await setValue("upTags", currentUpTags);
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
  const upTags = (await getValue<Record<string, string[]>>("upTags")) ?? {};
  const customTags = (await getValue<string[]>("customTags")) ?? [];
  const videoCounts = (await getValue<Record<string, number>>("videoCounts")) ?? {};
  
  currentUpList = upCache.upList ?? [];
  currentUpTags = upTags;
  currentCustomTags = customTags;

  setText("stat-up-count", String(upCache.upList?.length ?? 0));
  setText("stat-tag-count", String(countUpTags(upTags)));
  setText("stat-video-count", String(countVideoTotals(videoCounts)));

  renderUpList(currentUpList, currentUpTags);
  renderTags(currentUpTags);
  setupDragAndDrop();
  
  // Search box event
  const searchInput = document.getElementById("tag-search") as HTMLInputElement | null;
  searchInput?.addEventListener("input", (e) => {
    const searchTerm = (e.target as HTMLInputElement).value;
    renderTags(currentUpTags, searchTerm);
  });

  const addTagBtn = document.getElementById("btn-add-tag");
  addTagBtn?.addEventListener("click", () => {
    const value = searchInput?.value ?? "";
    void addCustomTag(value);
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
    renderFilterTags();
    refreshUpList();
  });
}

if (typeof document !== "undefined") {
  void initStats();
}
