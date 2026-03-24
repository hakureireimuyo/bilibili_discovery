
import { createDragGhost, getDragContext, removeDragGhost, setDragContext } from "./drag.js";
import { colorFromTag, findCategory, getInputValue } from "./helpers.js";
import type { Category, StatsState } from "./types.js";
import { addCategory as queryAddCategory, removeCategory as queryRemoveCategory, addTagToCategory as queryAddTagToCategory, removeTagFromCategory as queryRemoveTagFromCategory } from "../query/index.js";

type RenderFn = () => void;

export function addCategory(state: StatsState, name: string, onChanged: RenderFn): void {
  void queryAddCategory(state, name, onChanged);
}

export function removeCategory(state: StatsState, categoryId: string, onChanged: RenderFn): void {
  void queryRemoveCategory(state, categoryId, onChanged);
}

export function addTagToCategory(state: StatsState, categoryId: string, tag: string, onChanged: RenderFn): void {
  void queryAddTagToCategory(state, categoryId, tag, onChanged);
}

export function removeTagFromCategory(
  state: StatsState,
  categoryId: string,
  tag: string,
  onChanged: RenderFn
): void {
  void queryRemoveTagFromCategory(state, categoryId, tag, onChanged);
}

function renderCategoryTagPill(
  state: StatsState,
  tagId: string,
  categoryId: string,
  onChanged: RenderFn
): HTMLElement {
  const tagName = state.tagIdToName[tagId] || tagId;
  const pill = document.createElement("span");
  pill.className = "tag-pill";
  pill.textContent = tagName;
  pill.style.backgroundColor = colorFromTag(tagName);
  pill.draggable = true;
  pill.dataset.tagId = tagId;
  pill.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/x-bili-category-tag", JSON.stringify({ tagId, categoryId }));
      e.dataTransfer.effectAllowed = "move";
    }
    createDragGhost(e, tagName);
    setDragContext({ tagId, tagName, categoryId, dropped: false });
  });
  pill.addEventListener("dragend", () => {
    removeDragGhost();
    if (getDragContext() && !getDragContext()?.dropped) {
      removeTagFromCategory(state, categoryId, tagId, onChanged);
    }
    setDragContext(null);
  });
  return pill;
}

function setupCategoryTagDropZone(element: HTMLElement, state: StatsState, categoryId: string, onChanged: RenderFn): void {
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
    const tagData = e.dataTransfer?.getData("application/x-bili-tag") ?? e.dataTransfer?.getData("text/plain");
    if (!tagData) {
      return;
    }

    // 解析标签数据
    let tag: string;
    try {
      const parsed = JSON.parse(tagData);
      tag = parsed.tagName || tagData;
    } catch {
      tag = tagData;
    }

    const currentDrag = getDragContext();
    if (currentDrag) {
      currentDrag.dropped = true;
    }
    addTagToCategory(state, categoryId, tag, onChanged);
  });
}

function renderCategoryItem(state: StatsState, category: Category, onChanged: RenderFn): HTMLElement {
  const item = document.createElement("div");
  item.className = "category-item";
  item.draggable = true;
  item.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData(
        "application/x-bili-category-tag",
        JSON.stringify({ tag: category.name, categoryId: category.id })
      );
      e.dataTransfer.effectAllowed = "move";
    }
    createDragGhost(e, category.name);
    setDragContext({ tagId: category.id, tagName: category.name, categoryId: category.id, dropped: false });
  });
  item.addEventListener("dragend", () => {
    removeDragGhost();
    setDragContext(null);
  });

  const header = document.createElement("div");
  header.className = "category-header";

  const name = document.createElement("span");
  name.className = "category-name";
  name.textContent = category.name;

  const removeBtn = document.createElement("span");
  removeBtn.className = "category-remove";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => removeCategory(state, category.id, onChanged));

  header.appendChild(name);
  header.appendChild(removeBtn);

  const tagsContainer = document.createElement("div");
  tagsContainer.className = "category-tags";
  tagsContainer.dataset.categoryId = category.id;
  setupCategoryTagDropZone(tagsContainer, state, category.id, onChanged);

  for (const tagId of category.tags) {
    tagsContainer.appendChild(renderCategoryTagPill(state, tagId, category.id, onChanged));
  }

  item.appendChild(header);
  item.appendChild(tagsContainer);
  return item;
}

export function renderCategories(state: StatsState, onChanged: RenderFn): void {
  const container = document.getElementById("category-list");
  if (!container) {
    return;
  }

  container.innerHTML = "";
  if (state.categories.length === 0) {
    const item = document.createElement("div");
    item.className = "list-item";
    item.textContent = "暂无大分区";
    container.appendChild(item);
    return;
  }

  const searchTerm = getInputValue("category-search").toLowerCase();
  state.filteredCategories = state.categories.filter((category) => category.name.toLowerCase().includes(searchTerm));
  for (const category of state.filteredCategories) {
    container.appendChild(renderCategoryItem(state, category, onChanged));
  }
}
