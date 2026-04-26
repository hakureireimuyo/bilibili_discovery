import { initThemedPage } from "../../themes/index.js";
import { createAnimation, ANIMATION_OPTIONS, type AnimationId } from "../workbench/animations.js";

let stopCurrent: (() => void) | null = null;

function switchAnimation(id: AnimationId): void {
  stopCurrent?.();

  const stage = document.getElementById("animation-stage");
  if (!stage) return;

  const anim = createAnimation(id);
  stopCurrent = anim.start(stage);

  // Update active button
  document.querySelectorAll(".control-btn").forEach((btn) => {
    btn.classList.toggle("is-active", (btn as HTMLElement).dataset.animId === id);
  });
}

function renderControls(): void {
  const container = document.getElementById("animation-controls");
  if (!container) return;

  container.innerHTML = ANIMATION_OPTIONS.map(
    (opt) => `
      <button
        type="button"
        class="control-btn${opt.id === "particles" ? " is-active" : ""}"
        data-anim-id="${opt.id}"
        title="${opt.desc}"
      >
        ${opt.name}
      </button>
    `
  ).join("");

  container.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-anim-id]");
    if (!btn) return;
    switchAnimation(btn.dataset.animId as AnimationId);
  });
}

function initTestPage(): void {
  if (typeof document === "undefined") return;

  initThemedPage("animation-test");
  renderControls();
  switchAnimation("particles");
}

if (typeof document !== "undefined") {
  initTestPage();
}
