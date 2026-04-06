import { clearDragState, getDragContext } from "../../../utils/drag-utils.js";
import type { DropZoneBindingOptions } from "./types.js";

export function bindDropZone(options: DropZoneBindingOptions): () => void {
  const { zone } = options;

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = options.dropEffect ?? "copy";
    }
    zone.classList.add("drag-over");
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!zone.contains(event.relatedTarget as Node)) {
      zone.classList.remove("drag-over");
    }
  };

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault();
    zone.classList.remove("drag-over");

    const context = getDragContext();
    if (!context) {
      return;
    }

    if (options.accept && !options.accept(context)) {
      clearDragState();
      return;
    }

    await options.onDrop(context);
    context.dropped = true;
    clearDragState();
  };

  zone.addEventListener("dragover", handleDragOver);
  zone.addEventListener("dragleave", handleDragLeave);
  zone.addEventListener("drop", handleDrop);

  return () => {
    zone.removeEventListener("dragover", handleDragOver);
    zone.removeEventListener("dragleave", handleDragLeave);
    zone.removeEventListener("drop", handleDrop);
  };
}
