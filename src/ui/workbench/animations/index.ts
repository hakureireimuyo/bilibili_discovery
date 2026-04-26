/**
 * Animation manager — central entry point.
 *
 * Dispatches to either tsParticles (for particle-based effects) or Canvas 2D
 * (for curve / gradient effects).  Register new animations by adding their
 * config / implementation to the appropriate module, then listing them in
 * ANIMATION_OPTIONS below.
 */

import type { AnimationId, AnimationDef } from "./types.js";
import { createCanvasAnimation } from "./canvas-effects.js";
import { TS_PARTICLE_IDS, getParticleConfig, initLock, tsParticles } from "./particle-configs.js";
import type { Container } from "./particle-configs.js";

/* ─── Catalogue ─── */

export const ANIMATION_OPTIONS: AnimationDef[] = [
  { id: "particles", name: "粒子效果", desc: "浮动粒子与连接线" },
  { id: "gradient-orb", name: "渐变光晕", desc: "缓慢漂浮的彩色光晕" },
  { id: "stars", name: "星空闪烁", desc: "闪烁的星点" },
  { id: "waves", name: "波浪线条", desc: "流动的波浪曲线" },
  { id: "geometric", name: "几何图形", desc: "缓慢旋转的几何多边形" },
  { id: "ripple", name: "波纹涟漪", desc: "扩散的环形波纹" },
  { id: "aurora", name: "极光", desc: "流动的极光光带" },
  { id: "none", name: "无动画", desc: "关闭背景动画" },
];

/* ─── Factory ─── */

export type AnimationHandle = ReturnType<typeof createAnimation>;

const FRAME_INTERVAL = 1000 / 30; // 30 fps cap

export function createAnimation(id: AnimationId) {
  /* ── tsParticles branch ── */
  if (TS_PARTICLE_IDS.has(id)) {
    return {
      start(parent: HTMLElement): () => void {
        const container = document.createElement("div");
        container.className = "workbench-bg-canvas";
        parent.insertBefore(container, parent.firstChild);

        let destroyed = false;
        let particlesContainer: Container | null = null;

        initLock.then(() => {
          if (destroyed) return;

          const rect = parent.getBoundingClientRect();
          const config = getParticleConfig(id, rect.width, rect.height);

          tsParticles.load({
            element: container,
            options: config,
          }).then((c) => {
            if (destroyed) {
              c?.destroy();
              return;
            }
            particlesContainer = c ?? null;
          });
        });

        return () => {
          destroyed = true;
          if (particlesContainer) {
            particlesContainer.destroy();
            particlesContainer = null;
          }
          container.remove();
        };
      },
    };
  }

  /* ── Canvas 2D branch ── */
  const instance = createCanvasAnimation(id);

  return {
    start(parent: HTMLElement): () => void {
      const canvas = document.createElement("canvas");
      canvas.className = "workbench-bg-canvas";
      parent.insertBefore(canvas, parent.firstChild);

      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      instance.init(canvas, ctx);

      let rafId = 0;
      let running = true;
      let lastFrameTime = 0;

      function frame(timestamp: number) {
        if (!running) return;
        if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
          lastFrameTime = timestamp;
          instance.animate(timestamp);
        }
        rafId = requestAnimationFrame(frame);
      }
      rafId = requestAnimationFrame(frame);

      const resizeHandler = () => {
        const dpr2 = window.devicePixelRatio || 1;
        const rect2 = parent.getBoundingClientRect();
        canvas.width = rect2.width * dpr2;
        canvas.height = rect2.height * dpr2;
        canvas.style.width = `${rect2.width}px`;
        canvas.style.height = `${rect2.height}px`;
        ctx.scale(dpr2, dpr2);
        instance.resize();
      };
      window.addEventListener("resize", resizeHandler);

      return () => {
        running = false;
        cancelAnimationFrame(rafId);
        instance.destroy();
        window.removeEventListener("resize", resizeHandler);
        canvas.remove();
      };
    },
  };
}

/* ─── Re-exports for convenience ─── */

export type { AnimationId } from "./types.js";
