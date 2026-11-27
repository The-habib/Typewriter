import { type AnimationMode } from './kinematics';

export interface ScrollChapterSpec {
  id: string;
  index: string;
  shortLabel: string;
  kicker: string;
  title: string;
  /** Two-to-three deliberate display lines for masked kinetic line-by-line reveals */
  titleLines: readonly string[];
  body: string;
  metrics: Array<{ label: string; value: string }>;
  align: 'left' | 'right';
  /** Normalized scroll stop [0..1] where this chapter's camera keyframe is centered */
  stop: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  explode: number;
  animationMode: AnimationMode;
}

export interface ScrollChoreographySample {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  explode: number;
  animationMode: AnimationMode;
  chapterIndex: number;
  chapterProgress: number;
}

export interface ChapterPresenceState {
  /** Index of the active chapter, or -1 if strictly in a transition gap */
  activeIndex: number;
  /** Smooth [0..1] opacity/presence envelope peaking at each chapter stop and clearing during sweeps */
  presence: number;
  /** Signed offset [-1..+1] around the active chapter stop for subtle directional scroll parallax */
  localOffset: number;
}

/**
 * 5 scroll-choreographed chapters introducing Typewriter — the open-source Android
 * mechanical typewriter keyboard & interactive 3D showcase.
 * Every camera target shifts the 3D keyboard firmly to one side so the active text block
 * sits inside the clean empty space opposite the model—never colliding with the keys.
 */
export const SCROLL_CHAPTERS: readonly ScrollChapterSpec[] = [
  {
    id: 'chapter-hero',
    index: '01',
    shortLabel: 'Overview',
    kicker: 'Android IME & 3D Studio',
    title: 'A classic typewriter, for Android.',
    titleLines: ['A classic', 'typewriter,', 'for Android.'],
    body: 'Typewriter is a free, open-source Android keyboard and companion app with 32 sculpted porcelain keys, 17 moving steel bars, and real sampled WAV audio—explored live in 3D.',
    metrics: [
      { label: 'Total keys', value: '32 (ABC · 123)' },
      { label: 'Moving bars', value: '17 steel levers' },
      { label: 'License', value: 'MIT Open Source' },
    ],
    align: 'left',
    stop: 0.0,
    // Keyboard framed cleanly on the right 62% -> generous open space on the left for Hero text
    position: [-2.75, 20.4, 4.9],
    target: [-2.75, 0.2, 0.12],
    fov: 35,
    explode: 0,
    animationMode: 'typing',
  },
  {
    id: 'chapter-comb',
    index: '02',
    shortLabel: 'Keybars',
    kicker: 'Moving Keybars',
    title: 'Seventeen bars that move with every tap.',
    titleLines: ['Seventeen bars', 'that move with', 'every tap.'],
    body: 'Every tap drives a 44 ms plunge and swings a steel bar inside its milled rear slot, triggering sympathetic tremor across neighboring levers just like real iron.',
    metrics: [
      { label: 'Steel bars', value: '17 parallel' },
      { label: 'Strike cycle', value: '44 / 46 / 118 ms' },
      { label: 'Rear slots', value: '17 milled' },
    ],
    align: 'right',
    stop: 0.25,
    // Looking toward +Z: negative target.x pushes the rear comb & Q keycap well into the left 50%, keeping right completely clear
    position: [0.5, 7.8, -7.4],
    target: [-5.45, 0.25, -0.25],
    fov: 35,
    explode: 0,
    animationMode: 'wave',
  },
  {
    id: 'chapter-gimbals',
    index: '03',
    shortLabel: 'Keys & Views',
    kicker: 'Classic · Crystal · Blueprint',
    title: 'Porcelain dishes framed in chrome.',
    titleLines: ['Porcelain dishes', 'framed in', 'machined chrome.'],
    body: 'Twenty-six round keys and six pill modifiers switch seamlessly across ABC, 123, and #+= layers. Toggle Split X-Ray or Inside View—matching Crystal and Blueprint modes on Android.',
    metrics: [
      { label: 'Round caps', value: '26 keys' },
      { label: 'Input layers', value: 'ABC / 123 / #+=' },
      { label: 'IME views', value: '3 live modes' },
    ],
    align: 'left',
    stop: 0.5,
    // Looking toward -Z: wider framing + stronger negative target.x leaves a generous clear left column for text
    position: [3.4, 10.6, 8.0],
    target: [-3.95, 0.25, 0.15],
    fov: 35,
    explode: 0,
    animationMode: 'typing',
  },
  {
    id: 'chapter-springs',
    index: '04',
    shortLabel: 'Springs',
    kicker: 'Twin Return Springs',
    title: 'Two real springs bring the spacebar back.',
    titleLines: ['Two real springs', 'bring the', 'spacebar back.'],
    body: 'Tap the spacebar and both 12-turn coil springs stretch together with harmonic overshoot—and on Android, hold and slide across the bar to scrub your text cursor.',
    metrics: [
      { label: 'Coil springs', value: '2 × 12 turns' },
      { label: 'Spacebar gesture', value: 'Cursor trackpad' },
      { label: 'Slow-motion', value: '0.25× inspect' },
    ],
    align: 'right',
    stop: 0.75,
    // Looking toward -Z: positive target.x pushes the spring assembly firmly into the left 58%, leaving right open
    position: [0.45, 4.6, 10.6],
    target: [4.35, 0.14, 2.55],
    fov: 32,
    explode: 0,
    animationMode: 'springs',
  },
  {
    id: 'chapter-exploded',
    index: '05',
    shortLabel: 'All Layers',
    kicker: 'Open-Source Monorepo',
    title: 'Every layer, open from app to shader.',
    titleLines: ['Every layer,', 'open from', 'app to shader.'],
    body: 'Scroll to lift all six mechanical tiers apart in mid-air. Both the Flutter + Kotlin Android IME codebase and this Three.js showcase live together under the MIT license.',
    metrics: [
      { label: 'Assembly tiers', value: '6 levels' },
      { label: 'Android IME', value: 'Flutter + Kotlin' },
      { label: 'Web 3D Engine', value: 'Three.js + GLSL' },
    ],
    align: 'left',
    stop: 1.0,
    // Looking toward -Z: pulled slightly back so all 6 tiers fit cleanly between left text and right progress rail
    position: [7.4, 7.8, 12.8],
    target: [-2.95, 1.5, 0.2],
    fov: 36,
    explode: 0.88,
    animationMode: 'wave',
  },
] as const;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Quintic smoothstep for silky, zero-jerk camera easing between scroll stops */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Pure, deterministic sampler mapping normalized scroll progress [0..1]
 * to interpolated 3D camera pose, FOV, exploded elevation, and active kinematic mode.
 */
export function sampleScrollChoreography(rawProgress: number): ScrollChoreographySample {
  const p = clamp01(rawProgress);
  const count = SCROLL_CHAPTERS.length;

  let segIdx = 0;
  for (let i = 0; i < count - 1; i++) {
    if (p >= SCROLL_CHAPTERS[i].stop) {
      segIdx = i;
    }
  }

  const a = SCROLL_CHAPTERS[segIdx];
  const b = SCROLL_CHAPTERS[Math.min(segIdx + 1, count - 1)];
  const span = Math.max(0.0001, b.stop - a.stop);
  const localRaw = clamp01((p - a.stop) / span);
  const eased = smootherstep(localRaw);

  // Determine nearest active chapter for editorial UI highlight & choreography mode
  let activeChapter = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const dist = Math.abs(p - SCROLL_CHAPTERS[i].stop);
    if (dist < bestDist) {
      bestDist = dist;
      activeChapter = i;
    }
  }

  return {
    position: [
      lerp(a.position[0], b.position[0], eased),
      lerp(a.position[1], b.position[1], eased),
      lerp(a.position[2], b.position[2], eased),
    ],
    target: [
      lerp(a.target[0], b.target[0], eased),
      lerp(a.target[1], b.target[1], eased),
      lerp(a.target[2], b.target[2], eased),
    ],
    fov: lerp(a.fov, b.fov, eased),
    explode: lerp(a.explode, b.explode, eased),
    animationMode: SCROLL_CHAPTERS[activeChapter].animationMode,
    chapterIndex: activeChapter,
    chapterProgress: localRaw,
  };
}

/**
 * Computes scroll-synchronized text presence so text holds steady at 100% clarity
 * when the 3D keyboard is framed at a chapter stop, and cleanly clears out during
 * mid-sweep camera transitions (so text never crosses or bothers the moving keyboard).
 */
export function computeChapterPresence(rawProgress: number): ChapterPresenceState {
  const p = clamp01(rawProgress);
  const count = SCROLL_CHAPTERS.length;

  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const dist = Math.abs(p - SCROLL_CHAPTERS[i].stop);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  }

  const stop = SCROLL_CHAPTERS[nearestIdx].stop;
  const halfSpacing = 0.125; // half of 0.25 chapter spacing
  const holdRadius = 0.068; // 100% full presence plateau around each chapter stop
  const fadeEdge = 0.112; // clears cleanly before the midpoint camera sweep at 0.125

  let presence = 1;
  if (nearestDist > holdRadius) {
    const t = clamp01((nearestDist - holdRadius) / Math.max(0.0001, fadeEdge - holdRadius));
    presence = 1 - smootherstep(t);
  }

  const localOffset = Math.max(-1, Math.min(1, (p - stop) / halfSpacing));

  return {
    activeIndex: presence > 0.04 ? nearestIdx : -1,
    presence,
    localOffset,
  };
}
