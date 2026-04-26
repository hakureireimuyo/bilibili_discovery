/**
 * Canvas 2D animation implementations.
 *
 * These effects require custom drawing (sine waves, radial gradients, etc.)
 * that tsParticles cannot produce. Each effect implements the CanvasAnimation
 * interface so the manager can drive its lifecycle uniformly.
 */

import type { AnimationId, CanvasAnimation } from "./types.js";
import { cssVarToRgb, rand } from "./helpers.js";

/* ─── Waves ─── */

function createWavesAnimation(): CanvasAnimation {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let time = 0;
  let colors: string[] = [];

  return {
    init(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = c;
      ctx = cx;
      const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
      const [sr, sg, sb] = cssVarToRgb("--theme-secondary", "#7c5cbf");
      const [ar, ag, ab] = cssVarToRgb("--theme-accent", "#d4a5a5");
      colors = [
        `rgba(${pr},${pg},${pb},0.16)`,
        `rgba(${ar},${ag},${ab},0.13)`,
        `rgba(${sr},${sg},${sb},0.10)`,
        `rgba(${pr},${pg},${pb},0.07)`,
      ];
    },
    resize() { /* no persistent state */ },
    animate(timestamp: number) {
      time = timestamp * 0.0006;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const amplitude = canvas.height * 0.07;
      const freq = 0.008;

      for (let w = 0; w < 4; w++) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        const phaseOffset = w * 1.8;
        const yBase = canvas.height * (0.28 + w * 0.14);

        for (let x = 0; x <= canvas.width; x += 2) {
          const y = yBase
            + Math.sin(x * freq + time + phaseOffset) * amplitude
            + Math.sin(x * freq * 0.5 + time * 0.7 + phaseOffset * 1.5) * amplitude * 0.5;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        ctx.fillStyle = colors[w % colors.length];
        ctx.fill();
      }
    },
    destroy() { /* no cleanup needed */ },
  };
}

/* ─── Aurora ─── */

function createAuroraAnimation(): CanvasAnimation {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let time = 0;

  return {
    init(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = c;
      ctx = cx;
    },
    resize() { /* no persistent state */ },
    animate(timestamp: number) {
      time = timestamp * 0.0003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
      const [ar, ag, ab] = cssVarToRgb("--theme-accent", "#d4a5a5");
      const [sr, sg, sb] = cssVarToRgb("--theme-secondary", "#7c5cbf");

      const bands: Array<{ rgb: [number, number, number]; alpha: number; offset: number }> = [
        { rgb: [pr, pg, pb], alpha: 0.07, offset: 0 },
        { rgb: [ar, ag, ab], alpha: 0.05, offset: 2.5 },
        { rgb: [sr, sg, sb], alpha: 0.06, offset: 5.0 },
        { rgb: [pr, pg, pb], alpha: 0.04, offset: 7.5 },
      ];

      for (const band of bands) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);

        const midY = canvas.height * 0.35;
        const amplitude = canvas.height * 0.2;

        for (let x = 0; x <= canvas.width; x += 2) {
          const wave1 = Math.sin(x * 0.006 + time + band.offset) * amplitude;
          const wave2 = Math.sin(x * 0.012 + time * 0.6 + band.offset * 0.8) * amplitude * 0.4;
          const wave3 = Math.sin(x * 0.003 + time * 1.3 + band.offset * 1.2) * amplitude * 0.6;
          const y = midY + wave1 + wave2 + wave3;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(canvas.width, canvas.height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, `rgba(${band.rgb[0]},${band.rgb[1]},${band.rgb[2]},0)`);
        grad.addColorStop(0.3, `rgba(${band.rgb[0]},${band.rgb[1]},${band.rgb[2]},${band.alpha})`);
        grad.addColorStop(0.7, `rgba(${band.rgb[0]},${band.rgb[1]},${band.rgb[2]},${band.alpha * 0.6})`);
        grad.addColorStop(1, `rgba(${band.rgb[0]},${band.rgb[1]},${band.rgb[2]},0)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    },
    destroy() { /* no cleanup needed */ },
  };
}

/* ─── Ripple ─── */

function createRippleAnimation(): CanvasAnimation {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let ripples: Array<{
    x: number; y: number;
    radius: number;
    maxRadius: number;
    speed: number;
    alpha: number;
    color: string;
  }> = [];
  let lastSpawn = 0;
  let colors: string[] = [];

  return {
    init(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = c;
      ctx = cx;
      const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
      const [ar, ag, ab] = cssVarToRgb("--theme-accent", "#d4a5a5");
      const [sr, sg, sb] = cssVarToRgb("--theme-secondary", "#7c5cbf");
      colors = [
        `rgba(${pr},${pg},${pb},1)`,
        `rgba(${ar},${ag},${ab},1)`,
        `rgba(${sr},${sg},${sb},1)`,
      ];
    },
    resize() { ripples = []; },
    animate(timestamp: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (timestamp - lastSpawn > 1200) {
        lastSpawn = timestamp;
        const maxR = rand(60, 140);
        ripples.push({
          x: rand(maxR, canvas.width - maxR),
          y: rand(maxR, canvas.height - maxR),
          radius: 0,
          maxRadius: maxR,
          speed: rand(0.4, 0.9),
          alpha: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
        if (ripples.length > 12) ripples.shift();
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);

        if (r.alpha <= 0.01) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color.replace("1)", `${r.alpha * 0.5})`);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const gradient = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
        gradient.addColorStop(0, r.color.replace("1)", `${r.alpha * 0.08})`));
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(r.x - r.radius, r.y - r.radius, r.radius * 2, r.radius * 2);
      }
    },
    destroy() { ripples = []; },
  };
}

/* ─── Gradient Orb ─── */

function createGradientOrbCanvas(): CanvasAnimation {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let orbs: Array<{
    x: number; y: number;
    vx: number; vy: number;
    radius: number;
    color: string;
    coreColor: string;
  }> = [];
  let colors: string[] = [];
  let coreColors: string[] = [];

  function spawn(count: number) {
    for (let i = 0; i < count; i++) {
      orbs.push({
        x: rand(0, canvas.width),
        y: rand(0, canvas.height),
        vx: rand(-0.25, 0.25),
        vy: rand(-0.18, 0.18),
        radius: rand(100, 240),
        color: colors[i % colors.length],
        coreColor: coreColors[i % coreColors.length],
      });
    }
  }

  return {
    init(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = c;
      ctx = cx;
      const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
      const [sr, sg, sb] = cssVarToRgb("--theme-secondary", "#7c5cbf");
      const [ar, ag, ab] = cssVarToRgb("--theme-accent", "#d4a5a5");
      colors = [
        `rgba(${pr},${pg},${pb},0.22)`,
        `rgba(${sr},${sg},${sb},0.18)`,
        `rgba(${ar},${ag},${ab},0.14)`,
        `rgba(${pr},${pg},${pb},0.10)`,
      ];
      coreColors = [
        `rgba(${pr},${pg},${pb},0.10)`,
        `rgba(${sr},${sg},${sb},0.08)`,
        `rgba(${ar},${ag},${ab},0.06)`,
        `rgba(${pr},${pg},${pb},0.04)`,
      ];
      spawn(5);
    },
    resize() {
      orbs = [];
      spawn(5);
    },
    animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const orb of orbs) {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.radius || orb.x > canvas.width + orb.radius) orb.vx *= -1;
        if (orb.y < -orb.radius || orb.y > canvas.height + orb.radius) orb.vy *= -1;

        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(orb.x - orb.radius, orb.y - orb.radius, orb.radius * 2, orb.radius * 2);

        const coreGrad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius * 0.35);
        coreGrad.addColorStop(0, orb.coreColor);
        coreGrad.addColorStop(1, "transparent");
        ctx.fillStyle = coreGrad;
        ctx.fillRect(orb.x - orb.radius * 0.35, orb.y - orb.radius * 0.35, orb.radius * 0.7, orb.radius * 0.7);
      }
    },
    destroy() { orbs = []; },
  };
}

/* ─── None (no-op) ─── */

function createNoneCanvas(): CanvasAnimation {
  return {
    init() { /* no-op */ },
    resize() { /* no-op */ },
    animate() { /* no-op */ },
    destroy() { /* no-op */ },
  };
}

/* ─── Dispatcher ─── */

const CANVAS_ANIMATION_MAP: Record<string, () => CanvasAnimation> = {
  waves: createWavesAnimation,
  aurora: createAuroraAnimation,
  ripple: createRippleAnimation,
  "gradient-orb": createGradientOrbCanvas,
};

export function createCanvasAnimation(id: AnimationId): CanvasAnimation {
  const factory = CANVAS_ANIMATION_MAP[id];
  if (factory) return factory();
  return createNoneCanvas();
}
