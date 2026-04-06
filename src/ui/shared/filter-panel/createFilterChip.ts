import { applyTagColor } from "../../../utils/tag-utils.js";
import { clearDragState, createDragGhost, setDragContext } from "../../../utils/drag-utils.js";
import type { FilterChipOptions } from "./types.js";

export function createFilterChip(options: FilterChipOptions): HTMLElement {
  const element = document.createElement("span");
  element.className = options.className ?? `filter-tag filter-tag-${options.variant}`;
  element.draggable = options.draggable ?? true;
  element.style.cursor = element.draggable ? "grab" : "default";

  const label = document.createElement("span");
  label.textContent = options.label;
  element.appendChild(label);

  if (options.colorTag) {
    applyTagColor(element, options.colorTag);
  }

  if (options.createDragContext) {
    element.addEventListener("dragstart", (event) => {
      const dragEvent = event as DragEvent;
      setDragContext(options.createDragContext?.() ?? null);

      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.effectAllowed = options.dragEffect ?? "move";
        dragEvent.dataTransfer.setData("text/plain", options.label);
      }

      createDragGhost(dragEvent, options.label);
      options.onDragStart?.(dragEvent, element);
    });
  }

  element.addEventListener("dragend", (event) => {
    clearDragState();
    options.onDragEnd?.(event as DragEvent, element);
  });

  if (options.onRemove && options.showRemoveButton !== false) {
    const removeButton = document.createElement("button");
    removeButton.className = "filter-tag-remove";
    removeButton.textContent = "×";
    removeButton.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      options.onRemove?.(event, element);
    });
    element.appendChild(removeButton);
  }

  return element;
}
