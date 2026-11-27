/**
 * Exact parametric CAD blueprint of the Precision Keybar & Gimbal Linkage Mechanism.
 *
 * All planar coordinates are normalized directly from the 2240 x 1888 reference plate
 * (aspect ratio 1.186440678) and projected isotropically onto the X-Z studio plane:
 *   x = (u - 0.5) * WORLD_WIDTH
 *   z = (v - 0.5) * WORLD_HEIGHT
 * Vertical elevation (Y) encodes the true 3D stacked mechanical clearance tiers above
 * the y = 0 studio tabletop.
 */

export const REF_PIXEL_WIDTH = 2240;
export const REF_PIXEL_HEIGHT = 1888;
export const REF_ASPECT = REF_PIXEL_WIDTH / REF_PIXEL_HEIGHT; // 1.186440678

export const WORLD_HEIGHT = 10.0;
export const WORLD_WIDTH = WORLD_HEIGHT * REF_ASPECT; // 11.86440678

/** Convert normalized reference X (0..1 left-to-right) to world X */
export function toX(u: number): number {
  return (u - 0.5) * WORLD_WIDTH;
}

/** Convert normalized reference Y (0..1 top-to-bottom) to world Z */
export function toZ(v: number): number {
  return (v - 0.5) * WORLD_HEIGHT;
}

/** Convert normalized reference width fraction to world units */
export function uSize(du: number): number {
  return du * WORLD_WIDTH;
}

/** Convert normalized reference height fraction to world units */
export function vSize(dv: number): number {
  return dv * WORLD_HEIGHT;
}

/**
 * 5 vertical functional assembly tiers (Y elevation in world units above y=0 tabletop).
 * Exploded view separates these tiers proportionally for internal inspection.
 */
export const TIER_BASE_Y = {
  baseBrackets: 0.16, // Lower mounting brackets, bottom tabs, torsion collars
  combBars: 0.36, // 17 vertical comb keybars + curved rear hooks
  linkageRods: 0.52, // Hinge barrels, articulated vertical rods, crossbars, coil springs
  gimbalArcs: 0.66, // Split circular C-arc gimbal guards & oval return handle
  plungerDiscs: 0.80, // Top beveled key-pad plunger discs, top finger stems, shift housings
  keycapArray: 1.04, // Sculpted concave-dish keycaps, double-shot legends, modifier caps & collets
} as const;

export type TierKey = keyof typeof TIER_BASE_Y;

export const TIER_EXPLODE_WEIGHT: Record<TierKey, number> = {
  baseBrackets: 0.0,
  combBars: 0.95,
  linkageRods: 1.9,
  gimbalArcs: 2.85,
  plungerDiscs: 3.8,
  keycapArray: 5.15,
};

export type KeycapViewMode = 'assembled' | 'cutaway' | 'mechanism';
export type KeycapLayoutMode = 'qwerty' | 'symbols';

/** Secondary 123 / Symbol layout matching the video's exact key flip layer */
export const SYMBOL_LABELS: readonly string[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  '-', '/', ':', ';', '(', ')', '$', '@', '”',
  '.', ',', '&', '?', '!', '‘', '’',
];

export interface CombBarSpec {
  id: string;
  index: number;
  u: number;
  vStart: number;
  vEnd: number;
  /** Whether the bar terminates in a bottom guide fin tab */
  hasBottomTab: boolean;
  /** Optional linked key index (0..25) that drives this comb bar */
  linkedKeyIndex: number | null;
  /** Slight Y offset to avoid interpenetration with adjacent bars */
  yOffset: number;
}

export interface KeyActuatorSpec {
  id: string;
  index: number;
  row: 0 | 1 | 2;
  col: number;
  keyLabel: string;
  u: number;
  v: number;
  /** Half-angle (radians) of upper and lower split C-arcs around north/south */
  arcHalfAngle: number;
  /** Radius of C-arc in world units */
  arcRadius: number;
  /** End v-coordinate of the descending vertical actuator finger/stem */
  stemEndV: number;
  /** Whether this unit has the auxiliary eccentric roller disc tucked bottom-left (Row 3 #3) */
  hasEccentricRoller?: boolean;
  /** Linked comb bar indices that lift when this key is depressed */
  linkedCombBars: number[];
}

export interface HingeClusterSpec {
  id: string;
  uStart: number;
  uEnd: number;
  v: number;
  knuckleU: number[];
  barrelRadius: number;
}

export interface ClevisJointSpec {
  id: string;
  u: number;
  v: number;
  radius: number;
}

export interface SpringSpec {
  id: string;
  side: 'left' | 'right';
  u: number;
  vTop: number;
  vBottom: number;
  coilRadius: number;
  wireRadius: number;
  turns: number;
  torsionV: number;
  torsionUStart: number;
  torsionUEnd: number;
}

export interface PartMetadata {
  id: string;
  name: string;
  subsystem: string;
  dimensionsMm: string;
  material: string;
  actionHint: string;
}

/**
 * 17 Top Comb Keybars spaced across u = 0.209 .. 0.783 (pitch Δu = 0.035875).
 * Each bar's vEnd matches the traced termination point in the reference plate.
 */
const COMB_BAR_V_ENDS: readonly number[] = [
  0.680, // Bar 01 (u=0.209): straight down through Row 2 #2 & Row 3 #1
  0.458, // Bar 02 (u=0.245): terminates in left 3-bar hinge cluster
  0.458, // Bar 03 (u=0.281): terminates in left 3-bar hinge cluster
  0.868, // Bar 04 (u=0.317): full length down into left lower mounting bracket
  0.674, // Bar 05 (u=0.353): drives left tension coil spring pull-rod
  0.688, // Bar 06 (u=0.389): runs down through Row 3 #3 eccentric roller
  0.852, // Bar 07 (u=0.425): left spacebar guide rail -> bottom guide fin
  0.458, // Bar 08 (u=0.460): terminates in center-left hinge collar
  0.692, // Bar 09 (u=0.496): central spine through Row 2 #5 & Row 3 #4
  0.458, // Bar 10 (u=0.532): terminates in center-right 2-bar hinge cluster
  0.458, // Bar 11 (u=0.568): terminates in center-right 2-bar hinge cluster
  0.868, // Bar 12 (u=0.604): right spacebar guide rail -> bottom guide fin
  0.674, // Bar 13 (u=0.639): drives right tension coil spring pull-rod
  0.868, // Bar 14 (u=0.675): full length down into right lower mounting bracket
  0.458, // Bar 15 (u=0.711): terminates in right 3-bar hinge cluster
  0.458, // Bar 16 (u=0.747): terminates in right 3-bar hinge cluster
  0.680, // Bar 17 (u=0.783): straight down through Row 2 #8 & Row 3 #7
];

const COMB_BAR_LINKED_KEY: readonly (number | null)[] = [
  11, // Bar 01 -> Row 2 #2 (S)
  2, // Bar 02 -> Row 1 #3 (E)
  2, // Bar 03 -> Row 1 #3 (E)
  12, // Bar 04 -> Row 2 #3 (D)
  3, // Bar 05 -> Row 1 #4 (R)
  13, // Bar 06 -> Row 2 #4 (F)
  21, // Bar 07 -> Row 3 #3 (C)
  4, // Bar 08 -> Row 1 #5 (T)
  14, // Bar 09 -> Row 2 #5 (G)
  5, // Bar 10 -> Row 1 #6 (Y)
  5, // Bar 11 -> Row 1 #6 (Y)
  15, // Bar 12 -> Row 2 #6 (H)
  6, // Bar 13 -> Row 1 #7 (U)
  16, // Bar 14 -> Row 2 #7 (J)
  7, // Bar 15 -> Row 1 #8 (I)
  7, // Bar 16 -> Row 1 #8 (I)
  17, // Bar 17 -> Row 2 #8 (K)
];

export const COMB_BARS: readonly CombBarSpec[] = COMB_BAR_V_ENDS.map((vEnd, i) => ({
  id: `comb-bar-${i + 1}`,
  index: i,
  u: 0.209 + i * 0.035875,
  vStart: 0.184,
  vEnd,
  hasBottomTab: i === 6 || i === 11,
  linkedKeyIndex: COMB_BAR_LINKED_KEY[i],
  yOffset: (i % 2) * 0.008,
}));

/**
 * 26 Key Actuator Gimbal Units arranged in 3 staggered QWERTY rows (10 + 9 + 7).
 */
const ROW1_U = [0.074, 0.168, 0.264, 0.358, 0.453, 0.548, 0.642, 0.737, 0.832, 0.927];
const ROW1_LABELS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const ROW1_STEM_ENDS = [0.456, 0.722, 0.458, 0.674, 0.458, 0.458, 0.674, 0.458, 0.715, 0.456];
const ROW1_COMBS: number[][] = [[], [], [1, 2], [4], [7], [9, 10], [12], [14, 15], [], []];

const ROW2_U = [0.119, 0.214, 0.310, 0.405, 0.500, 0.595, 0.691, 0.787, 0.882];
const ROW2_LABELS = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
const ROW2_STEM_ENDS = [0.595, 0.598, 0.598, 0.598, 0.598, 0.598, 0.598, 0.598, 0.595];
const ROW2_COMBS: number[][] = [[], [0], [3], [5], [8], [11], [13], [16], []];

const ROW3_U = [0.214, 0.310, 0.405, 0.500, 0.595, 0.691, 0.787];
const ROW3_LABELS = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];
const ROW3_STEM_ENDS = [0.684, 0.730, 0.688, 0.692, 0.692, 0.730, 0.682];
const ROW3_ARC_HALVES = [1.32, 1.32, 1.34, 1.00, 1.00, 1.32, 1.32]; // Outer Row 3 rings wrap wider (~152° per arc)
const ROW3_COMBS: number[][] = [[0], [3], [5, 6], [8], [11], [13], [16]];

export const KEY_ACTUATORS: readonly KeyActuatorSpec[] = [
  ...ROW1_U.map((u, col) => ({
    id: `key-${ROW1_LABELS[col].toLowerCase()}`,
    index: col,
    row: 0 as const,
    col,
    keyLabel: ROW1_LABELS[col],
    u,
    v: 0.335,
    arcHalfAngle: 0.96, // ~110° top and bottom split arcs
    arcRadius: 0.455,
    stemEndV: ROW1_STEM_ENDS[col],
    linkedCombBars: ROW1_COMBS[col],
  })),
  ...ROW2_U.map((u, col) => ({
    id: `key-${ROW2_LABELS[col].toLowerCase()}`,
    index: 10 + col,
    row: 1 as const,
    col,
    keyLabel: ROW2_LABELS[col],
    u,
    v: 0.466,
    arcHalfAngle: col === 0 || col === 4 || col === 5 || col === 8 ? 0.96 : 1.06,
    arcRadius: 0.455,
    stemEndV: ROW2_STEM_ENDS[col],
    linkedCombBars: ROW2_COMBS[col],
  })),
  ...ROW3_U.map((u, col) => ({
    id: `key-${ROW3_LABELS[col].toLowerCase()}`,
    index: 19 + col,
    row: 2 as const,
    col,
    keyLabel: ROW3_LABELS[col],
    u,
    v: 0.598,
    arcHalfAngle: ROW3_ARC_HALVES[col],
    arcRadius: 0.462,
    stemEndV: ROW3_STEM_ENDS[col],
    hasEccentricRoller: col === 2,
    linkedCombBars: ROW3_COMBS[col],
  })),
];

/** Mid-plane transverse pivot hinge barrels & multi-bar knuckle clusters */
export const HINGE_CLUSTERS: readonly HingeClusterSpec[] = [
  {
    id: 'hinge-far-left',
    uStart: 0.052,
    uEnd: 0.094,
    v: 0.456,
    knuckleU: [0.062, 0.074, 0.086],
    barrelRadius: 0.125,
  },
  {
    id: 'hinge-left-cluster',
    uStart: 0.236,
    uEnd: 0.290,
    v: 0.458,
    knuckleU: [0.245, 0.264, 0.281],
    barrelRadius: 0.115,
  },
  {
    id: 'hinge-center-left',
    uStart: 0.442,
    uEnd: 0.467,
    v: 0.458,
    knuckleU: [0.453, 0.460],
    barrelRadius: 0.112,
  },
  {
    id: 'hinge-center-right',
    uStart: 0.533,
    uEnd: 0.576,
    v: 0.458,
    knuckleU: [0.540, 0.556, 0.568],
    barrelRadius: 0.115,
  },
  {
    id: 'hinge-right-cluster',
    uStart: 0.706,
    uEnd: 0.761,
    v: 0.458,
    knuckleU: [0.713, 0.735, 0.749],
    barrelRadius: 0.115,
  },
  {
    id: 'hinge-far-right',
    uStart: 0.909,
    uEnd: 0.937,
    v: 0.456,
    knuckleU: [0.918, 0.927],
    barrelRadius: 0.12,
  },
];

/** Articulated intermediate clevis pin joints along the four long control rods */
export const CLEVIS_JOINTS: readonly ClevisJointSpec[] = [
  { id: 'clevis-l1-top', u: 0.171, v: 0.486, radius: 0.092 },
  { id: 'clevis-l1-bot', u: 0.171, v: 0.575, radius: 0.092 },
  { id: 'clevis-l2-top', u: 0.354, v: 0.486, radius: 0.092 },
  { id: 'clevis-l2-bot', u: 0.354, v: 0.575, radius: 0.092 },
  { id: 'clevis-r2-top', u: 0.640, v: 0.486, radius: 0.092 },
  { id: 'clevis-r2-bot', u: 0.640, v: 0.575, radius: 0.092 },
  { id: 'clevis-r1-top', u: 0.828, v: 0.486, radius: 0.092 },
  { id: 'clevis-r1-bot', u: 0.828, v: 0.575, radius: 0.092 },
];

/** Twin helical tension coil springs + horizontal torsion coil sleeves */
export const COIL_SPRINGS: readonly SpringSpec[] = [
  {
    id: 'spring-left',
    side: 'left',
    u: 0.351,
    vTop: 0.679,
    vBottom: 0.755,
    coilRadius: 0.095,
    wireRadius: 0.017,
    turns: 12,
    torsionV: 0.800,
    torsionUStart: 0.336,
    torsionUEnd: 0.367,
  },
  {
    id: 'spring-right',
    side: 'right',
    u: 0.640,
    vTop: 0.679,
    vBottom: 0.755,
    coilRadius: 0.095,
    wireRadius: 0.017,
    turns: 12,
    torsionV: 0.800,
    torsionUStart: 0.625,
    torsionUEnd: 0.656,
  },
];

/** Right-side oval / stadium return handle dimensions */
export const STADIUM_HANDLE = {
  uMin: 0.745,
  uMax: 0.973,
  vMin: 0.675,
  vMax: 0.781,
  tubeRadius: 0.056,
  clampUMin: 0.822,
  clampUMax: 0.907,
  clampVTop: 0.712,
  clampVBottom: 0.778,
} as const;

/** Lower horizontal crossbars & ear-flange mounting brackets */
export const LOWER_CARRIAGE = {
  upperBarUMin: 0.397,
  upperBarUMax: 0.622,
  upperBarV: 0.703,
  lowerBailUMin: 0.371,
  lowerBailUMax: 0.631,
  lowerBailV: 0.790,
  leftEarHoleU: 0.294,
  rightEarHoleU: 0.708,
  earHoleV: 0.746,
  earHoleRadius: 0.092,
  leftBracketStemU: 0.315,
  rightBracketStemU: 0.681,
  bracketBottomV: 0.869,
} as const;

export type CameraPresetId = 'top' | 'iso' | 'side' | 'springs' | 'comb';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  {
    id: 'top',
    label: 'Top-Down',
    // Narrow telephoto overhead view matching the exact orthographic reference plate
    position: [0.06, 33.8, 0.14],
    target: [0.06, 0.42, 0.12],
    fov: 18,
  },
  {
    id: 'iso',
    label: 'Isometric',
    position: [7.4, 8.6, 9.2],
    target: [0.0, 0.45, 0.25],
    fov: 32,
  },
  {
    id: 'side',
    label: 'Side Profile',
    position: [13.2, 2.35, 1.4],
    target: [0.0, 0.48, 0.1],
    fov: 28,
  },
  {
    id: 'springs',
    label: 'Spring Bail',
    position: [0.0, 4.4, 7.3],
    target: [0.0, 0.42, 2.45],
    fov: 30,
  },
  {
    id: 'comb',
    label: 'Comb Hooks',
    position: [-5.8, 4.2, -6.9],
    target: [0.0, 0.45, -1.95],
    fov: 30,
  },
];

export type FinishId = 'gunmetal' | 'steel' | 'obsidian' | 'brass';

export interface FinishPreset {
  id: FinishId;
  label: string;
  swatch: string;
}

export const FINISH_PRESETS: readonly FinishPreset[] = [
  { id: 'gunmetal', label: 'Gunmetal Titanium', swatch: '#4f535b' },
  { id: 'steel', label: 'Machined Steel', swatch: '#9aa0a9' },
  { id: 'obsidian', label: 'Anodized Obsidian', swatch: '#23262c' },
  { id: 'brass', label: 'Brushed Brass', swatch: '#a8874b' },
];

export const PART_CATALOG: Record<string, PartMetadata> = {
  comb: {
    id: 'comb',
    name: '17-Tooth Comb Keybar Spine',
    subsystem: 'Upper Fulcrum Array',
    dimensionsMm: '148.2 × 136.8 × 11.4 mm',
    material: 'Hardened 17-4PH Gunmetal Steel',
    actionHint: 'Press Q–M keys or click any plunger disc to pivot bars',
  },
  actuator: {
    id: 'actuator',
    name: 'Split-Ring Gimbal Key Actuator',
    subsystem: '26-Key Matrix (10·9·7)',
    dimensionsMm: 'Ø 18.2 mm arc · Ø 8.5 mm plunger',
    material: 'CNC-Turned Titanium & Brushed Steel',
    actionHint: 'Click to depress plunger and actuate linked comb bar',
  },
  spring: {
    id: 'spring',
    name: 'Dual Helical Tension & Torsion Assembly',
    subsystem: 'Spacebar Return Carriage',
    dimensionsMm: '12 coils · Ø 3.8 mm · 0.68 mm wire',
    material: 'Music-Wire Tempered Spring Steel',
    actionHint: 'Press Space to deflect bail bar and elongate twin springs',
  },
  carriage: {
    id: 'carriage',
    name: 'Lower Bail Bar & Ear-Flange Brackets',
    subsystem: 'Chassis Suspension Frame',
    dimensionsMm: '108.4 × 38.6 × 9.2 mm',
    material: 'Stamped & Chamfered Tool Steel',
    actionHint: 'Press Space to actuate lower suspension bail',
  },
  stadium: {
    id: 'stadium',
    name: 'Stadium Loop Return Lever & T-Clamp',
    subsystem: 'Right Carriage Return',
    dimensionsMm: '54.6 × 21.6 × 5.8 mm',
    material: 'Formed Satin-Finished Gunmetal Rod',
    actionHint: 'Press Enter or click loop to actuate return carriage',
  },
  shiftLeft: {
    id: 'shiftLeft',
    name: 'Left Shift Lock Housing & I-Beam Foot',
    subsystem: 'Left Auxiliary Latch',
    dimensionsMm: '42.4 × 66.2 × 12.0 mm',
    material: 'Bead-Blasted Billet Housing & Ground Pins',
    actionHint: 'Press Shift or click block to depress latch assembly',
  },
  hinge: {
    id: 'hinge',
    name: 'Multi-Knuckle Transverse Pivot Shaft',
    subsystem: 'Mid-Plane Articulation',
    dimensionsMm: 'Ø 4.8 mm barrel · H7/g6 pin fit',
    material: 'Ground Chrome-Moly Pivot Pin',
    actionHint: 'Inspect internal clearances with Exploded View',
  },
  keycap: {
    id: 'keycap',
    name: 'Chrome-Bezel Porcelain Typewriter Keycap',
    subsystem: 'Tier 6 Tactile Keycap Matrix (32 Keys)',
    dimensionsMm: 'Ø 15.8 mm bezel · 1.4 mm chrome rim',
    material: 'Turned Chrome Bezel & Concave Porcelain Enamel',
    actionHint: 'Click any keycap (including 123, ⌫, ☺) or type on your keyboard',
  },
};
