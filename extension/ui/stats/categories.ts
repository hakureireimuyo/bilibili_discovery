/**
 * Category-related functionality for stats page.
 */

import { colorFromTag } from "./utils.js";
import { createDragGhost, removeDragGhost, setDragContext } from "./drag-drop.js";
import type { Category } from "../../storage/storage.js";

// Global state
let categories: Category[] = [];
let filteredCategories: Category[] = [];

/**
 * Get categories.
 */
export function getCategories(): Category[] {
  return categories;
}

/**
 * Set categories.
 */
export function setCategories(cats: Category[]): void {
  categories = cats;
}

/**
 * Get filtered categories.
 */
export function getFilteredCategories(): Category[] {
  return filteredCategories;
}

/**
 * Render category tag pill element.
 */
export function renderCategoryTagPill(tag: string, categoryId: string): HTMLElement {
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
    setDragContext({ tag, categoryId, dropped: false });
  });

  pill.addEventListener("dragend", () => {
    removeDragGhost();
    const context = { tag, categoryId, dropped: false };
    // If tag was not dropped in a valid zone, remove it from category
    if (!context.dropped && context.categoryId) {
      removeTagFromCategory(context.categoryId, tag);
    }
    setDragContext(null);
  });

  return pill;
}

/**
 * Setup category tag drop zone.
 */
export function setupCategoryTagDropZone(element: HTMLElement, categoryId: string): void {
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

    const context = { tag, categoryId, dropped: false };
    // Mark as dropped
    const dragContext = { ...context, dropped: true };
    setDragContext(dragContext);

    addTagToCategory(categoryId, tag);
  });
}

/**
 * Add tag to category.
 */
export function addTagToCategory(categoryId: string, tag: string): void {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  if (!category.tag_ids.includes(tag)) {
    category.tag_ids.push(tag);
    saveCategories();
    const searchTerm = (document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "";
    renderCategories(searchTerm);
  }
}

/**
 * Remove tag from category.
 */
export function removeTagFromCategory(categoryId: string, tag: string): void {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  category.tag_ids = category.tag_ids.filter(t => t !== tag);
  saveCategories();
  const searchTerm = (document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "";
  renderCategories(searchTerm);
}

/**
 * Add category.
 */
export function addCategory(name: string): void {
  const id = `category-${Date.now()}`;
  const newCategory: Category = {
    id,
    name,
    tag_ids: [],
    created_at: Date.now()
  };
  categories.push(newCategory);
  saveCategories();
  const searchTerm = (document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "";
  renderCategories(searchTerm);
}

/**
 * Remove category.
 */
export function removeCategory(categoryId: string): void {
  categories = categories.filter(c => c.id !== categoryId);
  saveCategories();
  const searchTerm = (document.getElementById("category-search") as HTMLInputElement | null)?.value ?? "";
  renderCategories(searchTerm);
}

/**
 * Save categories.
 */
function saveCategories(): void {
  // This will be handled by the main module
  const event = new CustomEvent("saveCategories", {
    detail: { categories }
  });
  document.dispatchEvent(event);
}

/**
 * Render categories.
 */
export function renderCategories(searchTerm: string = ""): void {
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
      setDragContext({ tag: category.name, categoryId: category.id, dropped: false });
    });

    item.addEventListener("dragend", () => {
      removeDragGhost();
      setDragContext(null);
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

    for (const tag of category.tag_ids) {
      tagsContainer.appendChild(renderCategoryTagPill(tag, category.id));
    }

    item.appendChild(header);
    item.appendChild(tagsContainer);
    container.appendChild(item);
  }
}
