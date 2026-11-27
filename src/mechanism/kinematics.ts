import {
  COMB_BARS,
  KEY_ACTUATORS,
  TIER_BASE_Y,
  TIER_EXPLODE_WEIGHT,
  type TierKey,
} from './blueprint';

export type AnimationMode = 'typing' | 'wave' | 'springs' | 'idle';

export interface MechanismKinematicState {
  /** Normalized depression [0..1+] for each of the 26 circular key actuators */
  keyPress: number[];
  /** Velocity of each of the 26 key plungers (2nd-order spring-mass-damper) */
  keyVel: number[];
  /** Target depression [0..1] for each key */
  keyTarget: number[];
  /** Comb bar lift angle (radians) for each of the 17 comb keybars */
  combAngles: number[];
  /** Angular velocity of each comb bar (adds authentic hammer follow-through) */
  combVel: number[];
  /** Spacebar bail depression [0..1] driving twin coil spring elongation */
  spacePress: number;
  spaceVel: number;
  spaceTarget: number;
  /** Helical tension spring elongation factor (1.0 = rest, up to ~1.28 = stretched) */
  springScale: number;
  /** Horizontal torsion coil twist angle (radians) synced to spacebar stroke */
  torsionTwist: number;
  /** Right stadium return handle actuation [0..1] */
  returnPress: number;
  returnVel: number;
  returnTarget: number;
  /** Left shift lock assembly actuation [0..1] */
  shiftPress: number;
  shiftVel: number;
  shiftTarget: number;
  /** Row 3 Right crimson Backspace pill key actuation [0..1] */
  backspacePress: number;
  backspaceVel: number;
  backspaceTarget: number;
  /** Row 4 Left 123 / ABC mode toggle pill key actuation [0..1] */
  modeKeyPress: number;
  modeKeyVel: number;
  modeKeyTarget: number;
  /** Row 4 Bottom-Left circular Emoji key actuation [0..1] */
  emojiPress: number;
  emojiVel: number;
  emojiTarget: number;
  /** Current smoothed exploded-view progress [0..1] */
  explodeProgress: number;
  explodeTarget: number;
  /** Active real-time choreography mode */
  animationMode: AnimationMode;
  /** Playback speed multiplier (0.5x .. 2.0x) */
  speed: number;
  /** Internal choreography clock */
  cycleTime: number;
  /** Next scheduled keystroke timestamp for organic typing cadence */
  nextTypingEvent: number;
  /** Deterministic pseudo-random cursor for typing cadence */
  typingCursor: number;
  /** Remaining hold timer per key during organic typing mode */
  typingHold: number[];
}

/** Frame-rate independent exponential damping factor */
export function dampValue(current: number, target: number, lambda: number, dt: number): number {
  const clampedDt = Math.min(Math.max(dt, 0), 0.1);
  return current + (target - current) * (1 - Math.exp(-lambda * clampedDt));
}

/**
 * Semi-implicit symplectic 2nd-order spring-mass-damper integrator.
 * Produces crisp, weighty mechanical acceleration with subtle physical rebound.
 */
export function stepSpringDamper(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] {
  // Sub-step if dt is large so spring physics remain unconditionally stable
  const steps = dt > 0.025 ? 2 : 1;
  const h = dt / steps;
  let x = value;
  let v = velocity;
  for (let s = 0; s < steps; s++) {
    const accel = (target - x) * stiffness - v * damping;
    v += accel * h;
    x += v * h;
  }
  return [x, v];
}

// Curated mechanical typing choreography spelling "TYPEWRITER POCKET BARS" with real backspace & carriage strokes
// Indices: Q0 W1 E2 R3 T4 Y5 U6 I7 O8 P9 | A10 S11 D12 F13 G14 H15 J16 K17 L18 | Z19 X20 C21 V22 B23 N24 M25
const TYPING_SEQUENCE: readonly (number | 'space' | 'return' | 'shift' | 'backspace')[] = [
  'shift', 4, 5, 9, 2, 1, 3, 7, 4, 2, 3, 'space',
  9, 8, 21, 17, 2, 4, 'space',
  23, 10, 3, 11, 'backspace', 11, 'return',
  11, 1, 7, 25, 'space', 1, 15, 2, 24, 'space',
  5, 8, 6, 'space', 4, 5, 9, 2, 'return',
];

export function createInitialKinematicState(
  initialMode: AnimationMode = 'typing',
): MechanismKinematicState {
  return {
    keyPress: new Array(KEY_ACTUATORS.length).fill(0),
    keyVel: new Array(KEY_ACTUATORS.length).fill(0),
    keyTarget: new Array(KEY_ACTUATORS.length).fill(0),
    combAngles: new Array(COMB_BARS.length).fill(0),
    combVel: new Array(COMB_BARS.length).fill(0),
    spacePress: 0,
    spaceVel: 0,
    spaceTarget: 0,
    springScale: 1,
    torsionTwist: 0,
    returnPress: 0,
    returnVel: 0,
    returnTarget: 0,
    shiftPress: 0,
    shiftVel: 0,
    shiftTarget: 0,
    backspacePress: 0,
    backspaceVel: 0,
    backspaceTarget: 0,
    modeKeyPress: 0,
    modeKeyVel: 0,
    modeKeyTarget: 0,
    emojiPress: 0,
    emojiVel: 0,
    emojiTarget: 0,
    explodeProgress: 0,
    explodeTarget: 0,
    animationMode: initialMode,
    speed: 1.0,
    cycleTime: 0,
    nextTypingEvent: 0.12,
    typingCursor: 0,
    typingHold: new Array(KEY_ACTUATORS.length).fill(0),
  };
}

/** Compute vertical Y offset for a mechanical tier given explode factor [0..1] */
export function getTierElevation(tier: TierKey, explodeProgress: number): number {
  const e = Math.min(Math.max(explodeProgress, 0), 1);
  return TIER_BASE_Y[tier] + TIER_EXPLODE_WEIGHT[tier] * e * 0.65;
}

export type MappedKeyboardInput =
  | { type: 'key'; index: number }
  | { type: 'space' }
  | { type: 'return' }
  | { type: 'shift' }
  | { type: 'backspace' };

const DIGIT_AND_SYMBOL_MAP: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9,
  '-': 10, '/': 11, ':': 12, ';': 13, '(': 14, ')': 15, '$': 16, '@': 17, '"': 18,
  '.': 19, ',': 20, '&': 21, '?': 22, '!': 23, "'": 24,
};

/** Map physical keyboard key string to actuator index or special control */
export function mapKeyboardInput(key: string): MappedKeyboardInput | null {
  const lower = key.toLowerCase();
  if (lower === ' ') return { type: 'space' };
  if (lower === 'enter') return { type: 'return' };
  if (lower === 'shift') return { type: 'shift' };
  if (lower === 'backspace') return { type: 'backspace' };
  const idx = KEY_ACTUATORS.findIndex((k) => k.keyLabel.toLowerCase() === lower);
  if (idx >= 0) return { type: 'key', index: idx };
  if (key in DIGIT_AND_SYMBOL_MAP) {
    return { type: 'key', index: DIGIT_AND_SYMBOL_MAP[key] };
  }
  return null;
}

export interface StepResult {
  moving: boolean;
  /** Number of new mechanical strikes initiated this frame (for optional audio synthesis) */
  strikeCount: number;
  /** Whether a heavy carriage strike (space/return/shift/backspace) triggered this frame */
  heavyStrike: boolean;
}

/**
 * Advance the 2nd-order physical kinematic solver by dt seconds.
 */
export function stepKinematics(state: MechanismKinematicState, dt: number): StepResult {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  const scaledDt = clampedDt * state.speed;
  let moving = false;
  let strikeCount = 0;
  let heavyStrike = false;

  if (state.animationMode === 'typing') {
    state.cycleTime += scaledDt;
    // Decay active typing holds
    for (let i = 0; i < state.typingHold.length; i++) {
      if (state.typingHold[i] > 0) {
        state.typingHold[i] = Math.max(0, state.typingHold[i] - scaledDt);
        state.keyTarget[i] = state.typingHold[i] > 0 ? 1 : 0;
      }
    }

    // Fire next rhythmic keystroke / carriage event
    if (state.cycleTime >= state.nextTypingEvent) {
      const event = TYPING_SEQUENCE[state.typingCursor % TYPING_SEQUENCE.length];
      state.typingCursor += 1;
      const rhythmJitter = 0.14 + ((state.typingCursor * 37) % 10) * 0.015;
      state.nextTypingEvent = state.cycleTime + rhythmJitter;

      if (event === 'space') {
        state.spaceTarget = 1;
        heavyStrike = true;
      } else if (event === 'return') {
        state.returnTarget = 1;
        heavyStrike = true;
      } else if (event === 'shift') {
        state.shiftTarget = 1;
        heavyStrike = true;
      } else if (event === 'backspace') {
        state.backspaceTarget = 1;
        heavyStrike = true;
      } else {
        state.typingHold[event] = 0.16;
        state.keyTarget[event] = 1;
        strikeCount += 1;
      }
    }

    // Auto-release heavy actuators smoothly after full stroke
    if (state.spaceTarget > 0.5 && state.spacePress > 0.85) state.spaceTarget = 0;
    if (state.returnTarget > 0.5 && state.returnPress > 0.85) state.returnTarget = 0;
    if (state.shiftTarget > 0.5 && state.shiftPress > 0.85) state.shiftTarget = 0;
    if (state.backspaceTarget > 0.5 && state.backspacePress > 0.85) state.backspaceTarget = 0;
    moving = true;
  } else if (state.animationMode === 'wave') {
    state.cycleTime += scaledDt;
    const t = state.cycleTime;
    for (let i = 0; i < KEY_ACTUATORS.length; i++) {
      const k = KEY_ACTUATORS[i];
      const phase = t * 4.4 - k.u * 8.2 - k.row * 0.95;
      const wave = 0.5 + 0.5 * Math.sin(phase);
      const nextT = wave > 0.68 ? Math.pow((wave - 0.68) / 0.32, 1.35) : 0;
      if (nextT > 0.55 && state.keyTarget[i] <= 0.55) strikeCount += 1;
      state.keyTarget[i] = nextT;
    }
    const spWave = Math.sin(t * 2.1);
    state.spaceTarget = spWave > 0.55 ? (spWave - 0.55) / 0.45 : 0;
    const retWave = Math.sin(t * 1.5 + 1.6);
    state.returnTarget = retWave > 0.6 ? (retWave - 0.6) / 0.4 : 0;
    const shWave = Math.sin(t * 1.7 + 3.2);
    state.shiftTarget = shWave > 0.65 ? (shWave - 0.65) / 0.35 : 0;
    const bsWave = Math.sin(t * 1.9 + 0.8);
    state.backspaceTarget = bsWave > 0.7 ? (bsWave - 0.7) / 0.3 : 0;
    moving = true;
  } else if (state.animationMode === 'springs') {
    state.cycleTime += scaledDt;
    const t = state.cycleTime;
    const pulse = 0.5 - 0.5 * Math.cos(t * 3.0);
    state.spaceTarget = Math.pow(pulse, 1.5);
    state.returnTarget = Math.pow(0.5 - 0.5 * Math.cos(t * 3.0 - 0.9), 1.8);
    state.shiftTarget = Math.pow(0.5 - 0.5 * Math.cos(t * 3.0 - 1.8), 1.8);
    state.backspaceTarget = Math.pow(0.5 - 0.5 * Math.cos(t * 3.0 - 2.4), 1.8);
    state.keyTarget.fill(0);
    state.keyTarget[3] = state.spaceTarget * 0.9;
    state.keyTarget[6] = state.spaceTarget * 0.9;
    moving = true;
  }

  // Smoothly damp explode slider
  const prevExplode = state.explodeProgress;
  state.explodeProgress = dampValue(state.explodeProgress, state.explodeTarget, 10, clampedDt);
  if (Math.abs(state.explodeProgress - state.explodeTarget) > 0.0008) {
    moving = true;
  } else if (prevExplode !== state.explodeTarget) {
    state.explodeProgress = state.explodeTarget;
  }

  // Integrate all 26 circular key plungers with crisp spring-mass-damper dynamics
  for (let i = 0; i < KEY_ACTUATORS.length; i++) {
    const target = state.keyTarget[i];
    const stiffness = target > state.keyPress[i] ? 440 : 220;
    const damping = target > state.keyPress[i] ? 26 : 16;
    const [nx, nv] = stepSpringDamper(
      state.keyPress[i],
      state.keyVel[i],
      target,
      stiffness,
      damping,
      clampedDt,
    );
    state.keyPress[i] = nx;
    state.keyVel[i] = nv;
    if (Math.abs(nx - target) > 0.002 || Math.abs(nv) > 0.01) {
      moving = true;
    } else {
      state.keyPress[i] = target;
      state.keyVel[i] = 0;
    }
  }

  // Helper to integrate single modifier/pill key channels cleanly
  const integrateChannel = (
    val: number,
    vel: number,
    target: number,
    stiffUp: number,
    stiffDown: number,
    dampUp: number,
    dampDown: number,
  ): [number, number] => {
    const stiff = target > val ? stiffUp : stiffDown;
    const damp = target > val ? dampUp : dampDown;
    const [nx, nv] = stepSpringDamper(val, vel, target, stiff, damp, clampedDt);
    if (Math.abs(nx - target) > 0.002 || Math.abs(nv) > 0.01) {
      moving = true;
      return [nx, nv];
    }
    return [target, 0];
  };

  [state.spacePress, state.spaceVel] = integrateChannel(
    state.spacePress,
    state.spaceVel,
    state.spaceTarget,
    260,
    175,
    20,
    11.5,
  );
  [state.returnPress, state.returnVel] = integrateChannel(
    state.returnPress,
    state.returnVel,
    state.returnTarget,
    250,
    200,
    17,
    15,
  );
  [state.shiftPress, state.shiftVel] = integrateChannel(
    state.shiftPress,
    state.shiftVel,
    state.shiftTarget,
    280,
    210,
    18,
    15,
  );
  [state.backspacePress, state.backspaceVel] = integrateChannel(
    state.backspacePress,
    state.backspaceVel,
    state.backspaceTarget,
    340,
    220,
    20,
    15,
  );
  [state.modeKeyPress, state.modeKeyVel] = integrateChannel(
    state.modeKeyPress,
    state.modeKeyVel,
    state.modeKeyTarget,
    320,
    210,
    20,
    15,
  );
  [state.emojiPress, state.emojiVel] = integrateChannel(
    state.emojiPress,
    state.emojiVel,
    state.emojiTarget,
    360,
    220,
    22,
    15,
  );

  // Derive helical spring elongation & torsion coil twist angle
  const leftSpringKey = Math.max(0, state.keyPress[3] ?? 0);
  const rightSpringKey = Math.max(0, state.keyPress[6] ?? 0);
  const pull = Math.max(
    -0.08,
    Math.min(1.15, state.spacePress + 0.35 * Math.max(leftSpringKey, rightSpringKey)),
  );
  state.springScale = 1 + pull * 0.24;
  state.torsionTwist = pull * 0.42;

  // Compute target comb bar fulcrum angles & integrate with hammer follow-through physics
  for (let i = 0; i < COMB_BARS.length; i++) {
    let targetAngle = 0;
    for (let k = 0; k < KEY_ACTUATORS.length; k++) {
      const stroke = Math.max(0, state.keyPress[k]);
      if (stroke > 0.0005 && KEY_ACTUATORS[k].linkedCombBars.includes(i)) {
        targetAngle = Math.max(targetAngle, stroke * 0.115);
      }
    }
    if ((i === 6 || i === 11) && state.spacePress > 0.0005) {
      targetAngle = Math.max(targetAngle, state.spacePress * 0.075);
    }

    const [na, nv] = stepSpringDamper(
      state.combAngles[i],
      state.combVel[i],
      targetAngle,
      360,
      20,
      clampedDt,
    );
    state.combAngles[i] = na;
    state.combVel[i] = nv;
    if (Math.abs(na - targetAngle) > 0.0006 || Math.abs(nv) > 0.005) {
      moving = true;
    } else {
      state.combAngles[i] = targetAngle;
      state.combVel[i] = 0;
    }
  }

  return { moving, strikeCount, heavyStrike };
}
