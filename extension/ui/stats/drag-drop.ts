/**
 * Drag and drop functionality for stats page.
 */

import { colorFromTag } from "./utils.js";
import type { DragContext } from "./types.js";

let dragGhost: HTMLElement | null = null;
let dragContext: DragContext | null = null;
let globalDragOverHandler: ((e: DragEvent) => void) | null = null;

/**
 * Get current drag context.
 */
export function getDragContext(): DragContext | null {
  return dragContext;
}

/**
 * Set drag context.
 */
export function setDragContext(context: DragContext | null): void {
  dragContext = context;
}

/**
 * Create drag ghost element.
 */
export function createDragGhost(e: DragEvent, tag: string): void {
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
 * Remove drag ghost element.
 */
export function removeDragGhost(): void {
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  if (globalDragOverHandler) {
    document.removeEventListener("dragover", globalDragOverHandler);
    globalDragOverHandler = null;
  }
}
