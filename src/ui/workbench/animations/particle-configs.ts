/**
 * tsParticles configuration factories.
 *
 * These effects are well-served by tsParticles (dot / polygon shapes with
 * built-in physics).  The tsParticles engine is loaded lazily on first use.
 */

import { tsParticles, type Container } from "@tsparticles/engine";
import { loadFull } from "tsparticles";
import type { AnimationId } from "./types.js";
import { cssVarToRgb } from "./helpers.js";

/* ─── Lazy init ─── */

let particlesInited = false;

const initLock = initParticles();

async function initParticles(): Promise<void> {
  if (particlesInited) return;
  await loadFull(tsParticles);
  particlesInited = true;
}

/* ─── Configs ─── */

function getParticlesOptions(
  width: number,
  height: number,
): Record<string, unknown> {
  const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
  const [ar, ag, ab] = cssVarToRgb("--theme-accent", "#d4a5a5");

  return {
    fpsLimit: 30,
    detectRetina: false,
    background: { color: "transparent" },
    backgroundMode: { enable: false },
    fullScreen: { enable: false },
    particles: {
      number: {
        value: Math.min(80, Math.floor((width * height) / 12000)),
      },
      color: {
        value: [`rgb(${pr},${pg},${pb})`, `rgb(${ar},${ag},${ab})`],
      },
      links: {
        enable: true,
        distance: 130,
        color: `rgb(${pr},${pg},${pb})`,
        opacity: 0.25,
        width: 0.7,
        triangles: { enable: false },
      },
      move: {
        enable: true,
        speed: 0.5,
        direction: "none" as const,
        random: true,
        outModes: { default: "bounce" as const },
      },
      size: {
        value: { min: 2, max: 5 },
      },
      opacity: {
        value: { min: 0.4, max: 0.9 },
        animation: {
          enable: true,
          speed: 0.5,
          sync: false,
        },
      },
    },
    interactivity: {
      detectsOn: "parent" as const,
      events: { resize: { enable: true } },
    },
  };
}

function getStarsOptions(
  width: number,
  height: number,
): Record<string, unknown> {
  const [tr, tg, tb] = cssVarToRgb("--theme-text-primary", "#e0e0e0");
  const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
  const [ar, ag, ab] = cssVarToRgb("--theme-accent", "#d4a5a5");

  return {
    fpsLimit: 30,
    detectRetina: false,
    background: { color: "transparent" },
    backgroundMode: { enable: false },
    fullScreen: { enable: false },
    particles: {
      number: {
        value: Math.min(120, Math.floor((width * height) / 8000)),
      },
      color: {
        value: [
          `rgb(${tr},${tg},${tb})`,
          `rgb(${pr},${pg},${pb})`,
          `rgb(${ar},${ag},${ab})`,
        ],
      },
      move: { enable: false },
      size: {
        value: { min: 0.5, max: 3 },
      },
      opacity: {
        value: { min: 0.15, max: 0.5 },
        animation: {
          enable: true,
          speed: 0.6,
          minimumValue: 0.05,
          sync: false,
        },
      },
    },
    interactivity: {
      detectsOn: "parent" as const,
      events: { resize: { enable: true } },
    },
  };
}

function getGeometricOptions(
  width: number,
  height: number,
): Record<string, unknown> {
  const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
  const [sr, sg, sb] = cssVarToRgb("--theme-secondary", "#7c5cbf");
  const [tr, tg, tb] = cssVarToRgb("--theme-text-primary", "#e0e0e0");

  return {
    fpsLimit: 30,
    detectRetina: false,
    background: { color: "transparent" },
    backgroundMode: { enable: false },
    fullScreen: { enable: false },
    particles: {
      number: {
        value: Math.min(30, Math.floor((width * height) / 25000)),
      },
      color: {
        value: [
          `rgb(${pr},${pg},${pb})`,
          `rgb(${sr},${sg},${sb})`,
          `rgb(${tr},${tg},${tb})`,
        ],
      },
      shape: {
        type: "polygon" as const,
        options: {
          polygon: [
            { sides: 3 },
            { sides: 4 },
            { sides: 5 },
            { sides: 6 },
          ],
        },
      },
      rotate: {
        value: { min: 0, max: 360 },
        animation: { enable: true, speed: 1, sync: false },
      },
      move: {
        enable: true,
        speed: 0.2,
        direction: "none" as const,
        random: true,
        outModes: { default: "bounce" as const },
      },
      size: { value: { min: 10, max: 35 } },
      opacity: { value: { min: 0.10, max: 0.22 } },
    },
    interactivity: {
      detectsOn: "parent" as const,
      events: { resize: { enable: true } },
    },
  };
}

function getNoneParticleOptions(): Record<string, unknown> {
  return {
    autoPlay: false,
    background: { color: "transparent" },
    backgroundMode: { enable: false },
    fullScreen: { enable: false },
    particles: { number: { value: 0 } },
    interactivity: {
      detectsOn: "parent" as const,
      events: { resize: { enable: true } },
    },
  };
}

/* ─── Effects that use tsParticles ─── */

export const TS_PARTICLE_IDS = new Set<AnimationId>(["particles", "stars", "geometric", "none"]);

export function getParticleConfig(
  id: AnimationId,
  width: number,
  height: number,
): Record<string, unknown> {
  switch (id) {
    case "particles":
      return getParticlesOptions(width, height);
    case "stars":
      return getStarsOptions(width, height);
    case "geometric":
      return getGeometricOptions(width, height);
    default:
      return getNoneParticleOptions();
  }
}

export { tsParticles, initLock };
export type { Container };
