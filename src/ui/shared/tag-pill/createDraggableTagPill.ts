import { clearDragState, createDragGhost, setDragContext } from "../../../utils/drag-utils.js";
import { createTagPill } from "./createTagPill.js";
import type { DraggableTagPillOptions } from "./types.js";

export function createDraggableTagPill(options: DraggableTagPillOptions): HTMLElement {
  const element = createTagPill({
    ...options,
    draggable: true
  });

  element.draggable = options.draggable ?? true;
  element.style.cursor = options.cursor ?? "grab";

  element.addEventListener("dragstart", (event) => {
    const dragEvent = event as DragEvent;
    const context = options.createDragContext();
    setDragContext(context);

    if (dragEvent.dataTransfer) {
      dragEvent.dataTransfer.effectAllowed = options.dragEffect ?? "copy";
      dragEvent.dataTransfer.setData("text/plain", options.text);
    }

    createDragGhost(dragEvent, options.text);
    options.onDragStart?.(dragEvent, element);
  });

  element.addEventListener("dragend", (event) => {
    clearDragState();
    options.onDragEnd?.(event as DragEvent, element);
  });

  return element;
}
