import {
  addTagToLibrary,
  addTagToUPManualTags,
  getTagLibrary,
  removeTagFromUPManualTags,
  setValue,
  type AppTag as Tag,
  type UPTagCount
} from "../../database/implementations/index.js";
import { createDragGhost, getDragContext, removeDragGhost, setDragContext } from "./drag.js";
import { colorFromTag, getInputValue, normalizeTag } from "./helpers.js";
import type { StatsState } from "./types.js";

type RenderFn = () => void;

export async function getAutoTagsForUp(
  state: StatsState,
  mid: number,
  manualTags: string[]
): Promise<{ tag: string; count: number }[]> {
  const autoTags = state.upTagCache[String(mid)]?.tags ?? [];
  const manualTagSet = new Set(manualTags);
  const tagLibrary = await getTagLibrary();
  const tagLibraryMap = new Map(Object.values(tagLibrary).map((tag) => [tag.id, tag]));

  return autoTags
    .filter((tag: UPTagCount) => {
      const tagInfo = tagLibraryMap.get(tag.tag);
      const isEditable = tag.editable || (tagInfo && tagInfo.editable);
      return !manualTagSet.has(tag.tag) && !isEditable;
    })
    .map((tag) => {
      const tagInfo = tagLibraryMap.get(tag.tag);
      return { tag: tagInfo ? tagInfo.name : tag.tag, count: tag.count };
    })
    .slice(0, 5);
}

function resolveDetach(): boolean {
  return Boolean(getDragContext() && !getDragContext()?.dropped);
}

export function renderTagPill(
  tag: string,
  options?: {
    count?: number;
    onDetached?: () => void;
    isAuto?: boolean;
    mid?: number;
    state?: StatsState;
    rerender?: RenderFn;
  }
): HTMLSpanElement {
  const {
    count,
    onDetached,
    isAuto = false,
    mid,
    state,
    rerender
  } = options ?? {};

  const pill = document.createElement("span");
  pill.className = isAuto ? "tag-pill tag-pill-auto" : "tag-pill";
  pill.textContent = count !== undefined ? `${tag} (${count})` : tag;
  pill.style.backgroundColor = colorFromTag(tag);
  pill.draggable = true;

  if (isAuto) {
    pill.style.cursor = "grab";
    const icon = document.createElement("i");
    icon.className = "auto-tag-icon";
    icon.textContent = "✧";
    pill.appendChild(icon);
  }

  pill.addEventListener("click", () => {
    const keyword = encodeURIComponent(tag);
    window.open(`https://search.bilibili.com/all?keyword=${keyword}`, "_blank", "noreferrer");
  });

  pill.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/x-bili-tag", tag);
      e.dataTransfer.effectAllowed = isAuto ? "copy" : "move";
    }
    createDragGhost(e, tag);
    if (isAuto) {
      setDragContext({ tag, dropped: false });
      pill.style.cursor = "grabbing";
    } else {
      setDragContext({ tag, originUpMid: mid, dropped: false });
    }
  });

  pill.addEventListener("dragend", () => {
    removeDragGhost();
    if (isAuto) {
      setDragContext(null);
      pill.style.cursor = "grab";
    } else {
      if (mid !== undefined && state && rerender) {
        if (getDragContext()?.originUpMid === mid && !getDragContext()?.dropped) {
          void removeTagFromUp(state, mid, tag, rerender);
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


async function resolveTagByName(tag: string): Promise<Tag | undefined> {
  const tagLibrary = await getTagLibrary();
  return Object.values(tagLibrary).find((entry) => entry.name === tag);
}

export async function addTagToUp(
  state: StatsState,
  mid: number,
  tag: string,
  onChanged: RenderFn
): Promise<void> {
  const nextTag = normalizeTag(tag);
  if (!nextTag) {
    return;
  }

  const key = String(mid);
  const existing = state.upManualTagsMap[key] ?? [];
  if (existing.includes(nextTag)) {
    return;
  }

  const tagObj = await addTagToLibrary(nextTag);
  const next = [...existing, nextTag];
  state.upManualTagsMap = { ...state.upManualTagsMap, [key]: next };
  state.currentUpTags[key] = [...new Set([...(state.upAutoTags[key] || []), ...next])];
  await addTagToUPManualTags(mid, tagObj.id);
  onChanged();
}

export async function removeTagFromUp(
  state: StatsState,
  mid: number,
  tag: string,
  onChanged: RenderFn
): Promise<void> {
  const key = String(mid);
  const existing = state.upManualTagsMap[key] ?? [];
  if (!existing.includes(tag)) {
    return;
  }

  const next = existing.filter((item) => item !== tag);
  state.upManualTagsMap = { ...state.upManualTagsMap, [key]: next };
  state.currentUpTags[key] = [...new Set([...(state.upAutoTags[key] || []), ...next])];

  const tagObj = await resolveTagByName(tag);
  if (tagObj) {
    await removeTagFromUPManualTags(mid, tagObj.id);
  }

  onChanged();
}

export async function addCustomTag(state: StatsState, tag: string, onChanged: RenderFn): Promise<void> {
  const next = normalizeTag(tag);
  if (!next || state.currentCustomTags.includes(next)) {
    return;
  }
  state.currentCustomTags = [...state.currentCustomTags, next];
  await setValue("customTags", state.currentCustomTags);
  onChanged();
}

export function renderTagList(state: StatsState): void {
  const container = document.getElementById("tag-list");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  const tags = Object.values(state.currentUpTags).flat();
  if (tags.length === 0 && state.currentCustomTags.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无分类词条";
    container.appendChild(item);
    return;
  }

  state.allTagCounts = {};
  for (const tag of tags) {
    state.allTagCounts[tag] = (state.allTagCounts[tag] ?? 0) + 1;
  }
  for (const tag of state.currentCustomTags) {
    if (!state.allTagCounts[tag]) {
      state.allTagCounts[tag] = 0;
    }
  }

  const searchTerm = getInputValue("tag-search").toLowerCase();
  state.filteredTags = Object.keys(state.allTagCounts).filter((tag) => tag.toLowerCase().includes(searchTerm));
  const rows = state.filteredTags
    .map((tag) => [tag, state.allTagCounts[tag]] as const)
    .sort((a, b) => b[1] - a[1]);

  for (const [tag, count] of rows) {
    const item = document.createElement("div");
    item.className = "list-item";
    const label = document.createElement("span");
    label.appendChild(renderTagPill(tag, { count }));
    const value = document.createElement("span");
    value.textContent = String(count);
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }
}
