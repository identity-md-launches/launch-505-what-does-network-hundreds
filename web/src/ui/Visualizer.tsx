import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface VisualizerHandle {
  /** Add a ripple for an event. `seed` keeps the same job or agent in the same place. */
  ripple(hue: number, seed: string): void;
  /** Flash on a pulse beat. */
  beat(index: number): void;
}

interface Props {
  agentsOnline: number;
  /** When false the canvas renders one still frame and stops animating. */
  active: boolean;
  reducedMotion: boolean;
  label: string;
}

interface Ripple {
  /** Angle around the centre, in radians. */
  angle: number;
  /** Distance from the centre as a fraction of the field radius, so resizes keep it in place. */
  distance: number;
  hue: number;
  born: number;
}

const RIPPLE_LIFE_MS = 2600;
const MAX_DOTS = 600;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export const Visualizer = forwardRef<VisualizerHandle, Props>(function Visualizer(
  { agentsOnline, active, reducedMotion, label },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ripples = useRef<Ripple[]>([]);
  const flash = useRef(0);
  const downbeat = useRef(0);
  const frame = useRef<number | null>(null);
  const state = useRef({ agentsOnline, active, reducedMotion });
  state.current = { agentsOnline, active, reducedMotion };

  useImperativeHandle(ref, () => ({
    ripple(hue, seed) {
      ripples.current.push({
        angle: hashSeed(seed) * Math.PI * 2,
        distance: 0.15 + hashSeed(`${seed}#r`) * 0.7,
        hue,
        born: performance.now(),
      });
      if (ripples.current.length > 40) ripples.current.shift();
      ensureLoop();
    },
    beat(index) {
      flash.current = 1;
      if (index % 4 === 0) downbeat.current = 1;
      ensureLoop();
    },
  }));

  function ensureLoop(): void {
    if (frame.current === null) frame.current = requestAnimationFrame(draw);
  }

  function draw(now: number): void {
    frame.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { agentsOnline: agents, active: isActive, reducedMotion: reduced } = state.current;
    const cx = w / 2;
    const cy = h / 2;
    const fieldRadius = Math.min(w, h) * 0.42;
    const t = now / 1000;

    ctx.clearRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    glow.addColorStop(0, `hsl(222 40% ${9 + flash.current * 4}%)`);
    glow.addColorStop(1, 'hsl(224 42% 5%)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const dots = Math.min(MAX_DOTS, Math.max(agents, 0));
    const spin = reduced || !isActive ? 0 : t * 0.02;
    for (let i = 0; i < dots; i += 1) {
      const rr = Math.sqrt((i + 0.5) / Math.max(dots, 1)) * fieldRadius;
      const aa = i * GOLDEN_ANGLE + spin;
      const twinkle = reduced || !isActive ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.37);
      const alpha = 0.18 + twinkle * 0.32 + flash.current * 0.2;
      ctx.fillStyle = `hsl(204 70% 72% / ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr, 1.4 + downbeat.current * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const pulseRadius = fieldRadius * (0.08 + flash.current * 0.03);
    ctx.fillStyle = `hsl(40 85% 68% / ${(0.4 + flash.current * 0.5).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    let anyRipple = false;
    ripples.current = ripples.current.filter((r) => now - r.born < RIPPLE_LIFE_MS);
    for (const r of ripples.current) {
      anyRipple = true;
      const age = (now - r.born) / RIPPLE_LIFE_MS;
      const alpha = (1 - age) * 0.9;
      const radius = reduced ? 28 : 10 + age * fieldRadius * 0.55;
      const x = cx + Math.cos(r.angle) * r.distance * fieldRadius;
      const y = cy + Math.sin(r.angle) * r.distance * fieldRadius;
      ctx.strokeStyle = `hsl(${r.hue} 80% 68% / ${alpha.toFixed(3)})`;
      ctx.lineWidth = reduced ? 3 : 2.5 - age * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `hsl(${r.hue} 85% 70% / ${(alpha * 0.8).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    flash.current *= reduced ? 0.8 : 0.9;
    downbeat.current *= 0.85;
    if (flash.current < 0.01) flash.current = 0;
    if (downbeat.current < 0.01) downbeat.current = 0;

    const keepGoing = (isActive && !reduced) || anyRipple || flash.current > 0;
    if (keepGoing) frame.current = requestAnimationFrame(draw);
  }

  useEffect(() => {
    ensureLoop();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => ensureLoop());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    // The draw loop reads live state through refs; it only needs to be kicked once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ensureLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentsOnline, active, reducedMotion]);

  return <canvas ref={canvasRef} className="viz" role="img" aria-label={label} />;
});
