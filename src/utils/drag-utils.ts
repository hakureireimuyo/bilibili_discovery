/**
 * 拖拽操作通用工具函数
 */

import { colorFromTag } from "./tag-utils.js";

export interface DragContext {
  tagId: number;
  tagName: string;
  originUpMid?: number;
  categoryId?: string;
  dropped: boolean;
  isFilterTag?: boolean;
  isSystemTag?: boolean;
}

let dragGhost: HTMLElement | null = null;
let dragContext: DragContext | null = null;
let globalDragOverHandler: ((e: DragEvent) => void) | null = null;

export function getDragContext(): DragContext | null {
  return dragContext;
}

export function setDragContext(next: DragContext | null): void {
  dragContext = next;
}

export function createDragGhost(e: DragEvent, tag: string): void {
  removeDragGhost();
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.textContent = tag;
  const rootStyles = getComputedStyle(document.documentElement);
  ghost.style.backgroundColor = colorFromTag(tag);
  ghost.style.padding = "8px 16px";
  ghost.style.borderRadius = "999px";
  ghost.style.color = rootStyles.getPropertyValue("--theme-text-primary").trim() || "#1f2430";
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
        event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed === "copy" ? "copy" : "move";
      }
    };
    document.addEventListener("dragover", globalDragOverHandler);
  }

  let rafId: number | null = null;
  const moveGhost = (moveEvent: MouseEvent) => {
    if (dragGhost && rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (dragGhost) {
          dragGhost.style.transform = `translate(${moveEvent.clientX}px, ${moveEvent.clientY}px)`;
        }
        rafId = null;
      });
    }
  };

  document.addEventListener("mousemove", moveGhost);
  document.addEventListener(
    "mouseup",
    () => {
      document.removeEventListener("mousemove", moveGhost);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setTimeout(() => removeDragGhost(), 100);
    },
    { once: true }
  );
}

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
