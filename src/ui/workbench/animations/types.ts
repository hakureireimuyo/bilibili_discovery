/**
 * Shared types for the workbench animation system.
 */

export type AnimationId =
  | "particles"
  | "gradient-orb"
  | "stars"
  | "waves"
  | "geometric"
  | "ripple"
  | "aurora"
  | "none";

export interface AnimationDef {
  id: AnimationId;
  name: string;
  desc: string;
}

/** Shared interface for hand-written Canvas 2D animations. */
export interface CanvasAnimation {
  init(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;
  resize(): void;
  animate(timestamp: number): void;
  destroy(): void;
}

export type AnimationHandle = ReturnType<typeof import("./index.js").createAnimation>;
