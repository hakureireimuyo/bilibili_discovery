/**
 * Workbench background animation system
 * Each animation is a self-contained class with lifecycle methods.
 * To add a new animation: implement AnimationInstance, register it in ANIMATION_MAP.
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

interface AnimationInstance {
  init(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;
  resize(): void;
  animate(timestamp: number): void;
  destroy(): void;
}

interface AnimationDef {
  id: AnimationId;
  name: string;
  desc: string;
  create: () => AnimationInstance;
}

/* ─── helpers ─── */

function getCssVar(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = Number.parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function cssVarToRgb(name: string, fallback: string): [number, number, number] {
  return hexToRgb(getCssVar(name, fallback));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/* ─── Particles ─── */

function createParticlesAnimation(): AnimationInstance {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let particles: Array<{
    x: number; y: number;
    vx: number; vy: number;
    size: number;
    alpha: number;
    alphaSpeed: number;
    color: [number, number, number];
  }> = [];
  let primaryRgb: [number, number, number];
  let accentRgb: [number, number, number];

  function spawn(count: number) {
    for (let i = 0; i < count; i++) {
      // 30% of particles use accent color for variety
      const useAccent = Math.random() < 0.3;
      const color = useAccent ? accentRgb : primaryRgb;
      particles.push({
        x: rand(0, canvas.width),
        y: rand(0, canvas.height),
        vx: rand(-0.3, 0.3),
        vy: rand(-0.3, 0.3),
        size: rand(2, 5),
        alpha: rand(0.4, 0.9),
        alphaSpeed: rand(0.002, 0.008) * (Math.random() > 0.5 ? 1 : -1),
        color,
      });
    }
  }

  return {
    init(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = c;
      ctx = cx;
      primaryRgb = cssVarToRgb("--theme-primary", "#4f8cff");
      accentRgb = cssVarToRgb("--theme-accent", "#d4a5a5");
      const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 12000));
      spawn(count);
    },
    resize() {
      particles = [];
      const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 12000));
      spawn(count);
    },
    animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += p.alphaSpeed;
        if (p.alpha > 0.9 || p.alpha < 0.15) p.alphaSpeed *= -1;

        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${p.alpha})`;
        ctx.fill();

        // Soft glow on larger particles
        if (p.size > 3) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${p.alpha * 0.15})`;
          ctx.fill();
        }
      }

      // Connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.25;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const mixR = Math.round((particles[i].color[0] + particles[j].color[0]) / 2);
            const mixG = Math.round((particles[i].color[1] + particles[j].color[1]) / 2);
            const mixB = Math.round((particles[i].color[2] + particles[j].color[2]) / 2);
            ctx.strokeStyle = `rgba(${mixR},${mixG},${mixB},${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
    },
    destroy() {
      particles = [];
    },
  };
}

/* ─── Gradient Orb ─── */

function createGradientOrbAnimation(): AnimationInstance {
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

        // Outer glow
        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(orb.x - orb.radius, orb.y - orb.radius, orb.radius * 2, orb.radius * 2);

        // Inner brighter core
        const coreGrad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius * 0.35);
        coreGrad.addColorStop(0, orb.coreColor);
        coreGrad.addColorStop(1, "transparent");
        ctx.fillStyle = coreGrad;
        ctx.fillRect(orb.x - orb.radius * 0.35, orb.y - orb.radius * 0.35, orb.radius * 0.7, orb.radius * 0.7);
      }
    },
    destroy() {
      orbs = [];
    },
  };
}

/* ─── Stars ─── */

function createStarsAnimation(): AnimationInstance {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let stars: Array<{
    x: number; y: number;
    size: number;
    phase: number;
    speed: number;
    baseAlpha: number;
    color: [number, number, number];
  }> = [];

  function spawn(count: number) {
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand(0, canvas.width),
        y: rand(0, canvas.height),
        size: rand(0.5, 3),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.005, 0.02),
        baseAlpha: rand(0.5, 0.95),
        color: [0, 0, 0], // placeholder, set in init
      });
    }
    // Assign colors in batches for visual variety
    const textRgb = cssVarToRgb("--theme-text-primary", "#e0e0e0");
    const primaryRgb = cssVarToRgb("--theme-primary", "#4f8cff");
    const accentRgb = cssVarToRgb("--theme-accent", "#d4a5a5");
    for (let i = 0; i < stars.length; i++) {
      const roll = Math.random();
      if (roll < 0.5) stars[i].color = textRgb;
      else if (roll < 0.8) stars[i].color = primaryRgb;
      else stars[i].color = accentRgb;
    }
  }

  return {
    init(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = c;
      ctx = cx;
      const count = Math.min(120, Math.floor((canvas.width * canvas.height) / 8000));
      spawn(count);
    },
    resize() {
      stars = [];
      const count = Math.min(120, Math.floor((canvas.width * canvas.height) / 8000));
      spawn(count);
    },
    animate(timestamp: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of stars) {
        const twinkle = Math.sin(timestamp * s.speed + s.phase);
        const alpha = s.baseAlpha * (0.3 + 0.7 * ((twinkle + 1) / 2));
        const [r, g, b] = s.color;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();

        // Glow for larger stars
        if (s.size > 1.5) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.25})`;
          ctx.fill();
        }
      }
    },
    destroy() {
      stars = [];
    },
  };
}

/* ─── Waves ─── */

function createWavesAnimation(): AnimationInstance {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let time = 0;
  let colors: string[] = [];

  return {
    init(_c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = _c;
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
          const y = yBase + Math.sin(x * freq + time + phaseOffset) * amplitude
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

/* ─── Geometric ─── */

interface GeoShape {
  x: number; y: number;
  sides: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  alpha: number;
  color: string;
}

function createGeometricAnimation(): AnimationInstance {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let shapes: GeoShape[] = [];
  let colorPalette: string[] = [];

  function drawShape(s: GeoShape) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotation);
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    const angle = (Math.PI * 2) / s.sides;
    for (let i = 0; i <= s.sides; i++) {
      const a = angle * i - Math.PI / 2;
      const px = Math.cos(a) * s.size;
      const py = Math.sin(a) * s.size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function spawn(count: number) {
    for (let i = 0; i < count; i++) {
      const isAccent = Math.random() < 0.25;
      const colorIdx = isAccent ? 1 : Math.floor(Math.random() * (colorPalette.length - 1));
      shapes.push({
        x: rand(0, canvas.width),
        y: rand(0, canvas.height),
        sides: Math.floor(rand(3, 7)),
        size: rand(10, 35),
        rotation: rand(0, Math.PI * 2),
        rotSpeed: rand(-0.008, 0.008),
        alpha: rand(0.10, 0.22),
        color: colorPalette[colorIdx],
      });
    }
  }

  return {
    init(c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = c;
      ctx = cx;
      const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
      const [sr, sg, sb] = cssVarToRgb("--theme-secondary", "#7c5cbf");
      const [tr, tg, tb] = cssVarToRgb("--theme-text-primary", "#e0e0e0");
      colorPalette = [
        `rgba(${pr},${pg},${pb},1)`,
        `rgba(${sr},${sg},${sb},1)`,
        `rgba(${tr},${tg},${tb},1)`,
      ];
      const count = Math.min(30, Math.floor((canvas.width * canvas.height) / 25000));
      spawn(count);
    },
    resize() {
      shapes = [];
      const count = Math.min(30, Math.floor((canvas.width * canvas.height) / 25000));
      spawn(count);
    },
    animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const s of shapes) {
        s.rotation += s.rotSpeed;
        // Slowly drift
        s.x += Math.sin(s.rotation * 0.5) * 0.15;
        s.y += Math.cos(s.rotation * 0.3) * 0.15;

        if (s.x < -50) s.x = canvas.width + 50;
        if (s.x > canvas.width + 50) s.x = -50;
        if (s.y < -50) s.y = canvas.height + 50;
        if (s.y > canvas.height + 50) s.y = -50;

        drawShape(s);
      }
    },
    destroy() {
      shapes = [];
    },
  };
}

/* ─── Ripple ─── */

function createRippleAnimation(): AnimationInstance {
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
    init(_c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = _c;
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
    resize() {
      ripples = [];
    },
    animate(timestamp: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn new ripples periodically
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
        // Keep max 12 ripples
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

        // Outer ring
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color.replace("1)", `${r.alpha * 0.5})`);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner glow fill
        const gradient = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
        gradient.addColorStop(0, r.color.replace("1)", `${r.alpha * 0.08})`));
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(r.x - r.radius, r.y - r.radius, r.radius * 2, r.radius * 2);
      }
    },
    destroy() {
      ripples = [];
    },
  };
}

/* ─── Aurora ─── */

function createAuroraAnimation(): AnimationInstance {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let time = 0;

  return {
    init(_c: HTMLCanvasElement, cx: CanvasRenderingContext2D) {
      canvas = _c;
      ctx = cx;
    },
    resize() { /* no persistent state */ },
    animate(timestamp: number) {
      time = timestamp * 0.0003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const [pr, pg, pb] = cssVarToRgb("--theme-primary", "#4f8cff");
      const [ar, ag, ab] = cssVarToRgb("--theme-accent", "#d4a5a5");
      const [sr, sg, sb] = cssVarToRgb("--theme-secondary", "#7c5cbf");

      const bands = [
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

/* ─── None (no animation) ─── */

function createNoneAnimation(): AnimationInstance {
  return {
    init() { /* no-op */ },
    resize() { /* no-op */ },
    animate() { /* no-op */ },
    destroy() { /* no-op */ },
  };
}

/* ─── Registry ─── */

const ANIMATION_MAP: Record<AnimationId, () => AnimationInstance> = {
  particles: createParticlesAnimation,
  "gradient-orb": createGradientOrbAnimation,
  stars: createStarsAnimation,
  waves: createWavesAnimation,
  geometric: createGeometricAnimation,
  ripple: createRippleAnimation,
  aurora: createAuroraAnimation,
  none: createNoneAnimation,
};

export const ANIMATION_OPTIONS: AnimationDef[] = [
  { id: "particles", name: "粒子效果", desc: "浮动粒子与连接线", create: createParticlesAnimation },
  { id: "gradient-orb", name: "渐变光晕", desc: "缓慢漂浮的彩色光晕", create: createGradientOrbAnimation },
  { id: "stars", name: "星空闪烁", desc: "闪烁的星点", create: createStarsAnimation },
  { id: "waves", name: "波浪线条", desc: "流动的波浪曲线", create: createWavesAnimation },
  { id: "geometric", name: "几何图形", desc: "缓慢旋转的几何多边形", create: createGeometricAnimation },
  { id: "ripple", name: "波纹涟漪", desc: "扩散的环形波纹", create: createRippleAnimation },
  { id: "aurora", name: "极光", desc: "流动的极光光带", create: createAuroraAnimation },
  { id: "none", name: "无动画", desc: "关闭背景动画", create: createNoneAnimation },
];

export type AnimationHandle = ReturnType<typeof createAnimation>;

export function createAnimation(id: AnimationId) {
  const factory = ANIMATION_MAP[id] ?? ANIMATION_MAP.particles;
  const instance = factory();

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId = 0;
  let running = false;
  let lastFrameTime = 0;
  const FRAME_INTERVAL = 1000 / 30; // ~33ms, 30fps cap

  function frame(timestamp: number) {
    if (!running) return;
    if (timestamp - lastFrameTime >= FRAME_INTERVAL) {
      lastFrameTime = timestamp;
      instance.animate(timestamp);
    }
    rafId = requestAnimationFrame(frame);
  }

  return {
    start(parent: HTMLElement) {
      canvas = document.createElement("canvas");
      canvas.className = "workbench-bg-canvas";
      parent.insertBefore(canvas, parent.firstChild);

      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      instance.init(canvas, ctx);

      const resizeHandler = () => {
        if (!canvas || !ctx) return;
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

      running = true;
      rafId = requestAnimationFrame(frame);

      return () => {
        running = false;
        cancelAnimationFrame(rafId);
        instance.destroy();
        window.removeEventListener("resize", resizeHandler);
        canvas?.remove();
        canvas = null;
        ctx = null;
      };
    },
  };
}
