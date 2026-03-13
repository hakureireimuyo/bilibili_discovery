import { formatSeconds } from "./utils.js";
import type { WatchStats } from "../../background/modules/common-types.js";
import type { UP } from "../../storage/storage.js";
import { getTagLibrary } from "../../storage/storage.js";

// 全局状态
let includeTags: string[] = [];
let excludeTags: string[] = [];
let currentStats: WatchStats | null = null;
let dragContext: { tag: string; dropped: boolean } | null = null;
let dragGhost: HTMLElement | null = null;
let globalDragOverHandler: ((e: DragEvent) => void) | null = null;

/**
 * 初始化视频搜索功能
 */
export function initVideoSearch(stats: WatchStats): void {
  currentStats = stats;
  const searchInput = document.getElementById("video-search") as HTMLInputElement;
  const resultsContainer = document.getElementById("video-search-results");

  if (!searchInput || !resultsContainer) return;

  // 初始显示所有视频（按观看时长排序）
  renderVideoResults(stats, resultsContainer, "");

  // 添加搜索事件
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    renderVideoResults(stats, resultsContainer, query);
  });
}

/**
 * 渲染视频搜索结果
 */
function renderVideoResults(
  stats: WatchStats,
  container: HTMLElement,
  query: string
): void {
  container.innerHTML = "";

  const videoRows = Object.entries(stats.videoSeconds)
    .filter(([bvid]) => {
      // 检查标题是否匹配搜索词
      const title = stats.videoTitles[bvid] ?? bvid;
      if (!title.toLowerCase().includes(query)) {
        return false;
      }

      // 检查标签是否匹配过滤条件
      if (includeTags.length > 0 || excludeTags.length > 0) {
        const tags = stats.videoTags[bvid] ?? [];

        // 检查是否包含所有必需的标签
        const hasAllIncludeTags = includeTags.length === 0 ||
          includeTags.every(tag => tags.includes(tag));

        // 检查是否不包含任何排除的标签
        const hasNoExcludeTags = excludeTags.length === 0 ||
          !excludeTags.some(tag => tags.includes(tag));

        return hasAllIncludeTags && hasNoExcludeTags;
      }

      return true;
    })
    .sort((a, b) => {
      // 按最近观看时间排序（使用videoFirstWatched或videoCreatedAt）
      const aTime = stats.videoFirstWatched?.[a[0]] ?? stats.videoCreatedAt?.[a[0]] ?? 0;
      const bTime = stats.videoFirstWatched?.[b[0]] ?? stats.videoCreatedAt?.[b[0]] ?? 0;
      return bTime - aTime;
    })
    .slice(0, 20);

  if (videoRows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    container.appendChild(item);
    return;
  }

  for (const [bvid, seconds] of videoRows) {
    const item = document.createElement("div");
    item.className = "list-item clickable";
    item.style.cursor = "pointer";

    const title = document.createElement("span");
    title.textContent = stats.videoTitles[bvid] ?? bvid;
    title.style.flex = "1";

    const duration = document.createElement("span");
    duration.textContent = formatSeconds(seconds);
    duration.style.fontWeight = "600";

    item.appendChild(title);
    item.appendChild(duration);

    // 点击跳转
    item.addEventListener("click", () => {
      window.open(`https://www.bilibili.com/video/${bvid}`, "_blank");
    });

    container.appendChild(item);
  }
}

/**
 * 初始化标签搜索功能
 */
export async function initTagSearch(stats: WatchStats): Promise<void> {
  currentStats = stats;
  const searchInput = document.getElementById("tag-search") as HTMLInputElement;
  const resultsContainer = document.getElementById("tag-search-results");

  if (!searchInput || !resultsContainer) return;

  // 计算所有标签的统计信息
  const tagStats = await calculateTagStats(stats);

  // 初始显示所有标签（按观看时长排序）
  renderTagResults(tagStats, resultsContainer, "");

  // 添加搜索事件
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    renderTagResults(tagStats, resultsContainer, query);
  });

  // 设置拖放功能
  setupDragAndDrop();
}

/**
 * 计算标签统计信息
 */
async function calculateTagStats(stats: WatchStats): Promise<Map<string, { seconds: number; videoCount: number }>> {
  const tagStats = new Map<string, { seconds: number; videoCount: number }>();
  
  // 获取标签库，用于将标签ID转换为标签名称
  const tagLibrary = await getTagLibrary();

  for (const [videoKey, tagIds] of Object.entries(stats.videoTags)) {
    const seconds = stats.videoSeconds[videoKey] ?? 0;
    const upId = stats.videoUpIds[videoKey];
    const upKey = upId ? String(upId) : null;
    const upSeconds = upKey ? (stats.upSeconds[upKey] ?? 0) : 0;
    
    // 使用视频观看时长，如果没有则使用UP观看时长（作为近似值）
    const effectiveSeconds = seconds > 0 ? seconds : upSeconds;
    
    for (const tagId of tagIds || []) {
      // 将标签ID转换为标签名称
      const tag = tagLibrary[tagId];
      const tagName = tag ? tag.name : tagId;
      
      const existing = tagStats.get(tagName) ?? { seconds: 0, videoCount: 0 };
      tagStats.set(tagName, {
        seconds: existing.seconds + effectiveSeconds,
        videoCount: existing.videoCount + 1
      });
    }
  }

  return tagStats;
}

/**
 * 渲染标签搜索结果
 */
function renderTagResults(
  tagStats: Map<string, { seconds: number; videoCount: number }>,
  container: HTMLElement,
  query: string
): void {
  container.innerHTML = "";

  const tagRows = Array.from(tagStats.entries())
    .filter(([tag]) => tag.toLowerCase().includes(query))
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 20);

  if (tagRows.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无数据";
    container.appendChild(item);
    return;
  }

  for (const [tag, stats] of tagRows) {
    const item = document.createElement("div");
    item.className = "list-item";

    const label = document.createElement("span");
    label.appendChild(renderTagPill(tag));

    const valueContainer = document.createElement("span");
    valueContainer.style.display = "flex";
    valueContainer.style.gap = "12px";

    const value = document.createElement("span");
    value.textContent = formatSeconds(stats.seconds);
    value.style.fontWeight = "600";

    const extra = document.createElement("span");
    extra.textContent = `视频: ${stats.videoCount}`;
    extra.style.color = "#6b7280";

    valueContainer.appendChild(value);
    valueContainer.appendChild(extra);

    item.appendChild(label);
    item.appendChild(valueContainer);

    container.appendChild(item);
  }
}

/**
 * 渲染标签药丸
 */
function renderTagPill(tag: string): HTMLSpanElement {
  const pill = document.createElement("span");
  pill.className = "tag-pill";
  pill.textContent = tag;
  pill.style.backgroundColor = colorFromTag(tag);

  // 使标签可拖动
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

/**
 * 根据标签生成颜色
 */
function colorFromTag(tag: string): string {
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
 * 创建拖动时的幽灵元素
 */
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

/**
 * 移除拖动时的幽灵元素
 */
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

/**
 * 设置拖放功能
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

      const tag = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
      if (!tag) return;
      if (dragContext) {
        dragContext.dropped = true;
      }

      // 如果已存在于另一个区域，则移除
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
      refreshVideoResults();
    });
  }
}

/**
 * 渲染过滤标签
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
}

/**
 * 创建过滤标签元素
 */
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
    refreshVideoResults();
  });

  tagEl.appendChild(removeBtn);
  return tagEl;
}

/**
 * 刷新视频搜索结果
 */
function refreshVideoResults(): void {
  if (!currentStats) return;
  const searchInput = document.getElementById("video-search") as HTMLInputElement;
  const resultsContainer = document.getElementById("video-search-results");
  if (!searchInput || !resultsContainer) return;
  const query = searchInput.value.toLowerCase();
  renderVideoResults(currentStats, resultsContainer, query);
}
