
import { createDragGhost, getDragContext, removeDragGhost, setDragContext } from "./drag.js";
import { colorFromTag, getInputValue, normalizeTag } from "./helpers.js";
import type { StatsState } from "./types.js";
import { createTag, getTagById } from "../../../query/tag/index.js";
import { getCreator, updateTagWeights } from "../../../query/creator/index.js";

type RenderFn = () => void | Promise<void>;

function resolveDetach(): boolean {
  return Boolean(getDragContext() && !getDragContext()?.dropped);
}

export function renderTagPill(
  tagId: string,
  options?: {
    count?: number;
    onDetached?: () => void;
    isAuto?: boolean;
    creatorId?: string;
    state?: StatsState;
    rerender?: RenderFn;
  }
): HTMLSpanElement {
  const {
    count,
    onDetached,
    isAuto = false,
    creatorId,
    state,
    rerender
  } = options ?? {};

  // 从状态中获取标签名称（仅用于UI显示）
  const tagName = state?.tagIdToName[tagId] || tagId;

  const pill = document.createElement("span");
  pill.className = isAuto ? "tag-pill tag-pill-auto" : "tag-pill";
  pill.textContent = count !== undefined ? `${tagName} (${count})` : tagName;
  pill.style.backgroundColor = colorFromTag(tagName);
  pill.draggable = true;
  pill.dataset.tagId = tagId;
  pill.dataset.tagName = tagName;

  if (isAuto) {
    pill.style.cursor = "grab";
    const icon = document.createElement("i");
    icon.className = "auto-tag-icon";
    icon.textContent = "✧";
    pill.appendChild(icon);
  }

  pill.addEventListener("click", () => {
    const keyword = encodeURIComponent(tagName);
    window.open(`https://search.bilibili.com/all?keyword=${keyword}`, "_blank", "noreferrer");
  });

  pill.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      // 传输标签 ID 和名称
      const dragData = JSON.stringify({ tagId, tagName });
      e.dataTransfer.setData("application/x-bili-tag", dragData);
      e.dataTransfer.effectAllowed = isAuto ? "copy" : "move";
    }
    createDragGhost(e, tagName);
    if (isAuto) {
      setDragContext({ tagId, tagName, dropped: false });
      pill.style.cursor = "grabbing";
    } else {
      setDragContext({ tagId, tagName, originUpMid: creatorId, dropped: false });
    }
  });

  pill.addEventListener("dragend", () => {
    removeDragGhost();
    if (isAuto) {
      setDragContext(null);
      pill.style.cursor = "grab";
    } else {
      if (creatorId !== undefined && state && rerender) {
        if (getDragContext()?.originUpMid === creatorId && !getDragContext()?.dropped) {
          void queryRemoveTagFromUp(state, creatorId, tagName, rerender);
        }
      } else if (onDetached && resolveDetach()) {
        onDetached();
      }
      setDragContext(null);
    }
  });

  return pill;
}

export function renderAutoTagPill(tag: string, count: number): HTMLSpanElement {
  return renderTagPill(tag, { count, isAuto: true });
}

export async function addTagToUp(
  state: StatsState,
  creatorId: string,
  tagName: string,
  onChanged?: RenderFn
): Promise<void> {
  const nextTag = normalizeTag(tagName);
  if (!nextTag) {
    return;
  }

  // 查找或创建标签ID
  let tagId = Object.entries(state.tagIdToName).find(([_, name]) => name === nextTag)?.[0];
  if (!tagId) {
    tagId = await createTag({
      name: nextTag,
      source: 'user',
      createdAt: Date.now()
    });
    // 更新标签库和映射
    state.tagLibrary[tagId] = {
      tagId,
      name: nextTag,
      source: 'user'
    };
    state.tagIdToName[tagId] = nextTag;
  }

  // 检查标签是否已存在于UP主
  const existingTags = state.currentUpTags[creatorId] || [];
  if (existingTags.includes(tagId)) {
    return;
  }

  // 添加标签到UP主
  await updateTagWeights(creatorId, state.platform, [{
    tagId,
    source: 'user',
    count: 0,
    createdAt: Date.now()
  }]);

  // 更新缓存(存储标签ID)
  const upData = state.upCache[creatorId];
  if (upData) {
    upData.tags = [...upData.tags, tagId];
  }
  state.currentUpTags[creatorId] = [...new Set([...existingTags, tagId])];

  // 更新标签计数
  state.allTagCounts[tagId] = (state.allTagCounts[tagId] || 0) + 1;

  if (onChanged) {
    await onChanged();
  }
}

export async function removeTagFromUp(
  state: StatsState,
  creatorId: string,
  tagId: string,
  onChanged: RenderFn
): Promise<void> {
  // 检查标签是否存在于UP主
  const existingTags = state.currentUpTags[creatorId] || [];
  if (!existingTags.includes(tagId)) {
    return;
  }

  // 获取创作者当前的标签权重
  const creator = await getCreator(creatorId, state.platform);
  if (!creator) {
    return;
  }

  // 移除指定的标签
  const updatedTagWeights = creator.tagWeights.filter(tw => tw.tagId !== tagId);
  await updateTagWeights(creatorId, state.platform, updatedTagWeights);

  // 更新缓存(存储标签ID)
  const upData = state.upCache[creatorId];
  if (upData) {
    upData.tags = upData.tags.filter(t => t !== tagId);
  }
  state.currentUpTags[creatorId] = existingTags.filter(t => t !== tagId);

  // 更新标签计数
  state.allTagCounts[tagId] = Math.max(0, (state.allTagCounts[tagId] || 0) - 1);

  if (onChanged) {
    await onChanged();
  }
}

export async function addCustomTag(state: StatsState, tagName: string, onChanged: RenderFn): Promise<void> {
  const next = normalizeTag(tagName);
  if (!next || state.currentCustomTags.includes(next)) {
    return;
  }

  // 创建标签
  const tagId = await createTag({
    name: next,
    source: 'user',
    createdAt: Date.now()
  });

  // 更新标签库和映射
  state.tagLibrary[tagId] = {
    tagId,
    name: next,
    source: 'user'
  };
  state.tagIdToName[tagId] = next;

  state.currentCustomTags = [...state.currentCustomTags, next];
  if (onChanged) {
    await onChanged();
  }
}

export async function renderTagList(state: StatsState): Promise<void> {
  const container = document.getElementById("tag-list");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  // 使用内存中的标签计数，不从数据库查询
  const tagCounts = new Map<string, number>(Object.entries(state.allTagCounts));

  // 添加自定义标签（使用次数为0）
  for (const tagName of state.currentCustomTags) {
    const tagId = Object.entries(state.tagIdToName).find(([_, name]) => name === tagName)?.[0];
    if (tagId && !tagCounts.has(tagId)) {
      tagCounts.set(tagId, 0);
    }
  }

  if (tagCounts.size === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无分类词条";
    container.appendChild(item);
    return;
  }

  // 更新状态
  state.allTagCounts = Object.fromEntries(tagCounts);

  // 搜索过滤（使用标签名称进行搜索）
  const searchTerm = getInputValue("tag-search").toLowerCase();
  state.filteredTags = Array.from(tagCounts.keys()).filter((tagId) => {
    const tagName = state.tagIdToName[tagId] || tagId;
    return tagName.toLowerCase().includes(searchTerm);
  });

  // 排序
  const rows = state.filteredTags
    .map((tagId) => [tagId, tagCounts.get(tagId)!] as const)
    .sort((a, b) => b[1] - a[1]);

  // 渲染
  for (const [tagId, count] of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.appendChild(renderTagPill(tagId, { count, state }));
    const value = document.createElement("span");
    value.textContent = String(count);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}
