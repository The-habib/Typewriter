import * as THREE from 'three';
import {
  COIL_SPRINGS,
  COMB_BARS,
  HINGE_CLUSTERS,
  KEY_ACTUATORS,
  LOWER_CARRIAGE,
  STADIUM_HANDLE,
  SYMBOL_LABELS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type FinishId,
  type KeycapLayoutMode,
} from './blueprint';
import { enhanceChromeBezelMaterial, enhancePorcelainEnamelMaterial } from './typewriterShaders';

export interface MechanismMaterialSet {
  machinedPrimary: THREE.MeshStandardMaterial;
  plungerTurned: THREE.MeshStandardMaterial;
  polishedPin: THREE.MeshStandardMaterial;
  mirrorChrome: THREE.MeshStandardMaterial;
  bearingBronze: THREE.MeshStandardMaterial;
  recessedDark: THREE.MeshStandardMaterial;
  housingMatte: THREE.MeshStandardMaterial;
  springWire: THREE.MeshStandardMaterial;
  keycapChromeBezel: THREE.MeshStandardMaterial;
  keycapPorcelain: THREE.MeshStandardMaterial;
  keycapCrimson: THREE.MeshStandardMaterial;
  keycapGhost: THREE.MeshStandardMaterial;
  keycapLegend: THREE.MeshBasicMaterial;
  qwertyLegendTex: THREE.CanvasTexture;
  symbolsLegendTex: THREE.CanvasTexture;
  currentFinish: FinishId;
  currentLayout: KeycapLayoutMode;
  dispose: () => void;
}

interface FinishPalette {
  primaryColor: number;
  plungerColor: number;
  pinColor: number;
  chromeColor: number;
  bronzeColor: number;
  recessColor: number;
  housingColor: number;
  springColor: number;
  bezelColor: number;
  porcelainColor: number;
  crimsonColor: number;
  legendInkCss: string;
  legendCrimsonInkCss: string;
  metalnessShift: number;
  roughnessShift: number;
}

const FINISH_PALETTES: Record<FinishId, FinishPalette> = {
  gunmetal: {
    primaryColor: 0x353942,
    plungerColor: 0x3c4049,
    pinColor: 0x626772,
    chromeColor: 0xa6aebc,
    bronzeColor: 0x9b743e,
    recessColor: 0x0d0f14,
    housingColor: 0x2b2e36,
    springColor: 0x606570,
    bezelColor: 0x969fa9,
    porcelainColor: 0xdce0e8,
    crimsonColor: 0xa81020,
    legendInkCss: '#14171e',
    legendCrimsonInkCss: '#120406',
    metalnessShift: 0.0,
    roughnessShift: 0.0,
  },
  steel: {
    primaryColor: 0x9aa2ae,
    plungerColor: 0xa6aeb9,
    pinColor: 0xc2c9d4,
    chromeColor: 0xd5dce6,
    bronzeColor: 0xa67e46,
    recessColor: 0x393f4a,
    housingColor: 0x828a96,
    springColor: 0xb6bec9,
    bezelColor: 0xaab2be,
    porcelainColor: 0xe2e6ee,
    crimsonColor: 0xb01424,
    legendInkCss: '#14171e',
    legendCrimsonInkCss: '#120406',
    metalnessShift: 0.02,
    roughnessShift: -0.03,
  },
  obsidian: {
    primaryColor: 0x1e2027,
    plungerColor: 0x24272f,
    pinColor: 0x454a54,
    chromeColor: 0x8e96a4,
    bronzeColor: 0x8f6b3a,
    recessColor: 0x090a0d,
    housingColor: 0x171920,
    springColor: 0x434852,
    bezelColor: 0x6f7784,
    porcelainColor: 0xd0d5df,
    crimsonColor: 0x960e1d,
    legendInkCss: '#101318',
    legendCrimsonInkCss: '#120406',
    metalnessShift: -0.02,
    roughnessShift: 0.04,
  },
  brass: {
    primaryColor: 0xa68346,
    plungerColor: 0xb28f52,
    pinColor: 0xcba96b,
    chromeColor: 0xd6c49a,
    bronzeColor: 0x74542a,
    recessColor: 0x3b2c14,
    housingColor: 0x876938,
    springColor: 0xc09b58,
    bezelColor: 0xb59b62,
    porcelainColor: 0xe6decb,
    crimsonColor: 0xa01620,
    legendInkCss: '#1d1710',
    legendCrimsonInkCss: '#160707',
    metalnessShift: 0.01,
    roughnessShift: -0.01,
  },
};

/**
 * Converts a grayscale heightfield Float32Array into a tangent-space RGB Normal DataTexture
 * and a matching linear Roughness DataTexture for authentic CNC micro-relief.
 */
function buildNormalAndRoughnessTextures(
  height: Float32Array,
  size: number,
  normalStrength: number,
  roughBase: number,
  roughVar: number,
  maxAnisotropy: number,
  repeat: number,
): { normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture } {
  const normalData = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);

  const sample = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return height[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * normalStrength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * normalStrength;
      const dZ = 1.0;
      const invLen = 1 / Math.hypot(dX, dY, dZ);

      const idx = (y * size + x) * 4;
      normalData[idx] = Math.round((-dX * invLen * 0.5 + 0.5) * 255);
      normalData[idx + 1] = Math.round((-dY * invLen * 0.5 + 0.5) * 255);
      normalData[idx + 2] = Math.round((dZ * invLen * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;

      const hVal = height[y * size + x];
      const roughByte = Math.round(
        THREE.MathUtils.clamp(roughBase + (0.5 - hVal) * roughVar, 0.08, 0.96) * 255,
      );
      roughData[idx] = roughByte;
      roughData[idx + 1] = roughByte;
      roughData[idx + 2] = roughByte;
      roughData[idx + 3] = 255;
    }
  }

  const configure = (tex: THREE.DataTexture) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = Math.min(8, maxAnisotropy);
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    normalMap: configure(new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat)),
    roughnessMap: configure(new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat)),
  };
}

/** 1. Silky linear CNC brushed-steel grain normal & roughness maps (zero high-freq pixel speckle) */
function createLinearBrushedMaps(maxAnisotropy: number, highRes: boolean) {
  const size = highRes ? 512 : 256;
  const h = new Float32Array(size * size);
  let seed = 4127;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const rawCol = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    rawCol[x] = (rand() - 0.5) * 0.28 + Math.sin(x * 0.35) * 0.1;
  }
  const colBias = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const xm = (x - 1 + size) % size;
    const xp = (x + 1) % size;
    colBias[x] = (rawCol[xm] + rawCol[x] * 2 + rawCol[xp]) * 0.25;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave = 0.86 + 0.14 * Math.sin(y * 0.05 + x * 0.12);
      h[y * size + x] = THREE.MathUtils.clamp(0.5 + colBias[x] * wave, 0, 1);
    }
  }

  return buildNormalAndRoughnessTextures(h, size, 0.28, 0.44, 0.08, maxAnisotropy, 2);
}

/** 2. Silky concentric lathe-turned micro-rings normal & roughness maps for circular plunger discs */
function createRadialLatheMaps(maxAnisotropy: number, highRes: boolean) {
  const size = highRes ? 512 : 256;
  const h = new Float32Array(size * size);

  const cx = size * 0.5;
  const cy = size * 0.5;
  const freqScale = highRes ? 0.35 : 0.65;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - cx, y - cy) * freqScale;
      const rings =
        Math.sin(r * 0.95) * 0.22 +
        Math.sin(r * 2.1 + 0.6) * 0.09 +
        Math.sin(r * 0.35) * 0.08;
      h[y * size + x] = THREE.MathUtils.clamp(0.5 + rings, 0, 1);
    }
  }

  return buildNormalAndRoughnessTextures(h, size, 0.32, 0.38, 0.08, maxAnisotropy, 1);
}

/** 3. Smooth satin bead-blasted anodized grain normal & roughness maps for shift housings & brackets */
function createBeadBlastedMaps(maxAnisotropy: number, highRes: boolean) {
  const size = highRes ? 512 : 256;
  const h = new Float32Array(size * size);
  let seed = 9973;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < size * size; i++) {
    h[i] = 0.5 + (rand() - 0.5) * 0.32;
  }

  let src = h;
  let dst = new Float32Array(size * size);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const ym = (y - 1 + size) % size;
        const yp = (y + 1) % size;
        dst[y * size + x] =
          (src[y * size + x] * 4 +
            src[y * size + xm] +
            src[y * size + xp] +
            src[ym * size + x] +
            src[yp * size + x]) /
          8;
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }

  return buildNormalAndRoughnessTextures(src, size, 0.24, 0.64, 0.08, maxAnisotropy, 2);
}

export function createMechanismMaterials(
  finish: FinishId,
  maxAnisotropy: number,
  usePhysical = true,
  initialLayout: KeycapLayoutMode = 'qwerty',
): MechanismMaterialSet {
  const linear = createLinearBrushedMaps(maxAnisotropy, usePhysical);
  const radial = createRadialLatheMaps(maxAnisotropy, usePhysical);
  const blasted = createBeadBlastedMaps(maxAnisotropy, usePhysical);
  const p = FINISH_PALETTES[finish];

  const makeMat = (
    params: THREE.MeshStandardMaterialParameters & {
      clearcoat?: number;
      clearcoatRoughness?: number;
      specularIntensity?: number;
      anisotropy?: number;
      anisotropyRotation?: number;
    },
  ): THREE.MeshStandardMaterial => {
    if (usePhysical) {
      return new THREE.MeshPhysicalMaterial(params);
    }
    const {
      clearcoat: _c,
      clearcoatRoughness: _cr,
      specularIntensity: _si,
      anisotropy: _an,
      anisotropyRotation: _ar,
      ...std
    } = params;
    return new THREE.MeshStandardMaterial(std);
  };

  const machinedPrimary = makeMat({
    color: p.primaryColor,
    metalness: THREE.MathUtils.clamp(0.9 + p.metalnessShift, 0.72, 0.96),
    roughness: THREE.MathUtils.clamp(0.42 + p.roughnessShift, 0.24, 0.62),
    normalMap: linear.normalMap,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughnessMap: linear.roughnessMap,
    clearcoat: 0.1,
    clearcoatRoughness: 0.36,
    anisotropy: 0.45,
    specularIntensity: 0.85,
    envMapIntensity: 0.96,
  });

  const plungerTurned = makeMat({
    color: p.plungerColor,
    metalness: THREE.MathUtils.clamp(0.91 + p.metalnessShift, 0.74, 0.96),
    roughness: THREE.MathUtils.clamp(0.39 + p.roughnessShift, 0.22, 0.58),
    normalMap: radial.normalMap,
    normalScale: new THREE.Vector2(0.16, 0.16),
    roughnessMap: radial.roughnessMap,
    clearcoat: 0.14,
    clearcoatRoughness: 0.3,
    anisotropy: 0.55,
    envMapIntensity: 1.0,
  });

  const polishedPin = makeMat({
    color: p.pinColor,
    metalness: THREE.MathUtils.clamp(0.94 + p.metalnessShift, 0.82, 0.98),
    roughness: THREE.MathUtils.clamp(0.24 + p.roughnessShift, 0.14, 0.34),
    clearcoat: 0.2,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.08,
  });

  const mirrorChrome = makeMat({
    color: p.chromeColor,
    metalness: 0.95,
    roughness: 0.2,
    clearcoat: 0.24,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.12,
  });

  const bearingBronze = makeMat({
    color: p.bronzeColor,
    metalness: 0.9,
    roughness: 0.33,
    normalMap: radial.normalMap,
    normalScale: new THREE.Vector2(0.12, 0.12),
    clearcoat: 0.12,
    clearcoatRoughness: 0.32,
    envMapIntensity: 1.04,
  });

  const recessedDark = new THREE.MeshStandardMaterial({
    color: p.recessColor,
    metalness: THREE.MathUtils.clamp(0.55 + p.metalnessShift, 0.4, 0.75),
    roughness: THREE.MathUtils.clamp(0.68 + p.roughnessShift, 0.52, 0.84),
    normalMap: blasted.normalMap,
    normalScale: new THREE.Vector2(0.11, 0.11),
    envMapIntensity: 0.48,
  });

  const housingMatte = makeMat({
    color: p.housingColor,
    metalness: THREE.MathUtils.clamp(0.84 + p.metalnessShift, 0.68, 0.92),
    roughness: THREE.MathUtils.clamp(0.52 + p.roughnessShift, 0.38, 0.68),
    normalMap: blasted.normalMap,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughnessMap: blasted.roughnessMap,
    clearcoat: 0.06,
    clearcoatRoughness: 0.46,
    envMapIntensity: 0.88,
  });

  const springWire = makeMat({
    color: p.springColor,
    metalness: THREE.MathUtils.clamp(0.95 + p.metalnessShift, 0.8, 0.98),
    roughness: THREE.MathUtils.clamp(0.22 + p.roughnessShift, 0.14, 0.32),
    clearcoat: 0.18,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.12,
  });

  // 4. Vintage Typewriter Keycap Materials with Custom Studio GLSL Shaders:
  //    - Machined stainless-chrome outer bezel ring (rich dark-edge reflections, zero white glare)
  //    - Matte-satin concave cool-alabaster porcelain dish with ceramic micro-tooth
  //    - Deep carmine-ruby lacquer enamel dish (Row 3 Right Backspace)
  const keycapChromeBezel = makeMat({
    color: p.bezelColor,
    metalness: 0.94,
    roughness: 0.22,
    clearcoat: 0.28,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.08,
  });
  enhanceChromeBezelMaterial(keycapChromeBezel);

  const keycapPorcelain = makeMat({
    color: p.porcelainColor,
    metalness: 0.02,
    roughness: 0.4,
    clearcoat: 0.18,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.56,
  });
  enhancePorcelainEnamelMaterial(keycapPorcelain, { isCrimson: false, dishRadius: 0.415 });

  const keycapCrimson = makeMat({
    color: p.crimsonColor,
    metalness: 0.03,
    roughness: 0.3,
    clearcoat: 0.44,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.66,
  });
  enhancePorcelainEnamelMaterial(keycapCrimson, { isCrimson: true, dishRadius: 0.415 });

  // Translucent smoked glass keycap shell for Split X-Ray Cutaway mode
  const keycapGhost = new THREE.MeshStandardMaterial({
    color: 0x161f2e,
    metalness: 0.14,
    roughness: 0.26,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    envMapIntensity: 0.85,
  });

  // Dual 6x6 high-resolution CanvasTexture legend atlases (QWERTY + 123/Symbols)
  const atlasSize = 1536;
  const qwertyCanvas = document.createElement('canvas');
  qwertyCanvas.width = atlasSize;
  qwertyCanvas.height = atlasSize;
  paintKeycapLegendAtlas(qwertyCanvas, p, 'qwerty');

  const symbolsCanvas = document.createElement('canvas');
  symbolsCanvas.width = atlasSize;
  symbolsCanvas.height = atlasSize;
  paintKeycapLegendAtlas(symbolsCanvas, p, 'symbols');

  const makeLegendTex = (canvas: HTMLCanvasElement) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, maxAnisotropy);
    tex.needsUpdate = true;
    return tex;
  };

  const qwertyLegendTex = makeLegendTex(qwertyCanvas);
  const symbolsLegendTex = makeLegendTex(symbolsCanvas);

  const keycapLegend = new THREE.MeshBasicMaterial({
    map: initialLayout === 'symbols' ? symbolsLegendTex : qwertyLegendTex,
    transparent: true,
    alphaTest: 0.03,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  return {
    machinedPrimary,
    plungerTurned,
    polishedPin,
    mirrorChrome,
    bearingBronze,
    recessedDark,
    housingMatte,
    springWire,
    keycapChromeBezel,
    keycapPorcelain,
    keycapCrimson,
    keycapGhost,
    keycapLegend,
    qwertyLegendTex,
    symbolsLegendTex,
    currentFinish: finish,
    currentLayout: initialLayout,
    dispose: () => {
      linear.normalMap.dispose();
      linear.roughnessMap.dispose();
      radial.normalMap.dispose();
      radial.roughnessMap.dispose();
      blasted.normalMap.dispose();
      blasted.roughnessMap.dispose();
      qwertyLegendTex.dispose();
      symbolsLegendTex.dispose();
      machinedPrimary.dispose();
      plungerTurned.dispose();
      polishedPin.dispose();
      mirrorChrome.dispose();
      bearingBronze.dispose();
      recessedDark.dispose();
      housingMatte.dispose();
      springWire.dispose();
      keycapChromeBezel.dispose();
      keycapPorcelain.dispose();
      keycapCrimson.dispose();
      keycapGhost.dispose();
      keycapLegend.dispose();
    },
  };
}

/**
 * Paints a crisp 6x6 vintage typewriter legend atlas matching the reference video 1:1:
 * - Cells 0..25 : 26 Circular keys in classic Arvo / Courier Prime typewriter slab-serif
 *                 (QWERTY: Q..M | Symbols: 1..0, - / : ; ( ) $ @ ” , . , & ? ! ‘ ’)
 * - Cell 26     : Row 3 Left Shift (outlined upward arrow ⇧ in QWERTY; #+= in Symbols)
 * - Cell 27     : Row 3 Right Crimson Backspace (crisp dark outlined backspace tag + ×)
 * - Cell 28     : Row 4 Bottom-Left Mode Toggle (123 in QWERTY; ABC in Symbols)
 * - Cell 29     : Row 4 Bottom-Left Circular Emoji (clean outlined smiley face ☺)
 * - Cell 30     : Row 4 Bottom-Right Return (crisp rounded 90° bent-arrow ↵)
 */
function paintKeycapLegendAtlas(
  canvas: HTMLCanvasElement,
  palette: FinishPalette,
  layout: KeycapLayoutMode,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  const gridCols = 6;
  const cell = size / gridCols;

  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const serifFont = '"Arvo", "Courier Prime", Georgia, serif';

  // Cells 0..25: 26 Circular Alpha / Symbol Keys
  for (let i = 0; i < KEY_ACTUATORS.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const cx = (col + 0.5) * cell;
    const cy = (row + 0.5) * cell;
    const glyph = layout === 'symbols' ? SYMBOL_LABELS[i] : KEY_ACTUATORS[i].keyLabel;

    ctx.fillStyle = palette.legendInkCss;
    const fontScale =
      glyph === '@' ? 0.52 : glyph === '”' || glyph === '‘' || glyph === '’' ? 0.62 : 0.56;
    ctx.font = `400 ${Math.round(cell * fontScale)}px ${serifFont}`;
    const yNudge =
      glyph === '.' || glyph === ','
        ? -cell * 0.04
        : glyph === '”' || glyph === '‘' || glyph === '’'
          ? cell * 0.06
          : cell * 0.02;
    ctx.fillText(glyph, cx, cy + yNudge);
  }

  // Cell 26: Left Shift Pill (aspect patchW / patchD = 1.10 / 0.7488 = 1.47 -> scale X by 1/1.47)
  {
    const col = 26 % gridCols;
    const row = Math.floor(26 / gridCols);
    const cx = (col + 0.5) * cell;
    const cy = (row + 0.5) * cell;

    ctx.save();
    ctx.translate(cx, cy);
    // Pill legend plane is 1.225:1 for 1.48 x 0.96 pill -> counter-scale X for exact 1:1 glyph proportion
    ctx.scale(1 / 1.225, 1);

    if (layout === 'qwerty') {
      // Crisp hollow outlined upward Shift arrow matching frame_qwerty.png
      ctx.strokeStyle = palette.legendInkCss;
      ctx.lineWidth = cell * 0.056;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const s = cell * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.05);
      ctx.lineTo(s * 1.08, s * 0.05);
      ctx.lineTo(s * 0.48, s * 0.05);
      ctx.lineTo(s * 0.48, s * 0.95);
      ctx.lineTo(-s * 0.48, s * 0.95);
      ctx.lineTo(-s * 0.48, s * 0.05);
      ctx.lineTo(-s * 1.08, s * 0.05);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.fillStyle = palette.legendInkCss;
      ctx.font = `400 ${Math.round(cell * 0.48)}px ${serifFont}`;
      ctx.fillText('#+=', 0, cell * 0.02);
    }
    ctx.restore();
  }

  // Cell 27: Right Crimson Backspace Pill (crisp dark outlined backspace tag + ×)
  {
    const col = 27 % gridCols;
    const row = Math.floor(27 / gridCols);
    const cx = (col + 0.5) * cell;
    const cy = (row + 0.5) * cell;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 / 1.225, 1);

    ctx.strokeStyle = palette.legendCrimsonInkCss;
    ctx.lineWidth = cell * 0.054;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const w = cell * 0.36;
    const h = cell * 0.24;
    ctx.beginPath();
    ctx.moveTo(-w * 1.15, 0);
    ctx.lineTo(-w * 0.42, -h);
    ctx.lineTo(w * 0.95, -h);
    ctx.quadraticCurveTo(w * 1.12, -h, w * 1.12, -h + cell * 0.06);
    ctx.lineTo(w * 1.12, h - cell * 0.06);
    ctx.quadraticCurveTo(w * 1.12, h, w * 0.95, h);
    ctx.lineTo(-w * 0.42, h);
    ctx.closePath();
    ctx.stroke();

    // Crisp centered × inside the backspace tag
    const xOff = w * 0.28;
    const xr = cell * 0.1;
    ctx.beginPath();
    ctx.moveTo(xOff - xr, -xr);
    ctx.lineTo(xOff + xr, xr);
    ctx.moveTo(xOff + xr, -xr);
    ctx.lineTo(xOff - xr, xr);
    ctx.stroke();

    ctx.restore();
  }

  // Cell 28: Bottom-Left Mode Toggle Pill (`123` / `ABC`)
  {
    const col = 28 % gridCols;
    const row = Math.floor(28 / gridCols);
    const cx = (col + 0.5) * cell;
    const cy = (row + 0.5) * cell;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 / 1.225, 1);

    ctx.fillStyle = palette.legendInkCss;
    ctx.font = `400 ${Math.round(cell * 0.44)}px ${serifFont}`;
    ctx.fillText(layout === 'qwerty' ? '123' : 'ABC', 0, cell * 0.025);
    ctx.restore();
  }

  // Cell 29: Bottom-Left Circular Emoji Key (clean vector smiley matching frame_qwerty.png)
  {
    const col = 29 % gridCols;
    const row = Math.floor(29 / gridCols);
    const cx = (col + 0.5) * cell;
    const cy = (row + 0.5) * cell;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = palette.legendInkCss;
    ctx.fillStyle = palette.legendInkCss;
    ctx.lineWidth = cell * 0.048;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const r = cell * 0.28;
    // Outer circle
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Two solid eyes
    const eyeR = cell * 0.036;
    ctx.beginPath();
    ctx.arc(-r * 0.36, -r * 0.2, eyeR, 0, Math.PI * 2);
    ctx.arc(r * 0.36, -r * 0.2, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Classic open happy D-shaped smile matching the reference video emoji button
    ctx.lineWidth = cell * 0.04;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.14);
    ctx.lineTo(r * 0.5, r * 0.14);
    ctx.arc(0, r * 0.14, r * 0.5, 0, Math.PI, false);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Cell 30: Bottom-Right Wide Return Pill (`↵` bent arrow, patch aspect ~1.47 -> counter-scale X)
  {
    const col = 30 % gridCols;
    const row = Math.floor(30 / gridCols);
    const cx = (col + 0.5) * cell;
    const cy = (row + 0.5) * cell;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 / 1.48, 1);

    ctx.strokeStyle = palette.legendInkCss;
    ctx.lineWidth = cell * 0.056;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const xLeft = -cell * 0.3;
    const xRight = cell * 0.3;
    const yTop = -cell * 0.22;
    const yBot = cell * 0.12;
    const cornerR = cell * 0.11;

    // Rounded hook top-right down to horizontal left shaft
    ctx.beginPath();
    ctx.moveTo(xRight - cornerR * 1.1, yTop);
    ctx.lineTo(xRight - cornerR, yTop);
    ctx.quadraticCurveTo(xRight, yTop, xRight, yTop + cornerR);
    ctx.lineTo(xRight, yBot - cornerR);
    ctx.quadraticCurveTo(xRight, yBot, xRight - cornerR, yBot);
    ctx.lineTo(xLeft, yBot);
    ctx.stroke();

    // Clean V arrowhead pointing left
    const ah = cell * 0.16;
    ctx.beginPath();
    ctx.moveTo(xLeft + ah, yBot - ah);
    ctx.lineTo(xLeft, yBot);
    ctx.lineTo(xLeft + ah, yBot + ah);
    ctx.stroke();

    ctx.restore();
  }
}

export function repaintKeycapLegends(mats: MechanismMaterialSet): void {
  const p = FINISH_PALETTES[mats.currentFinish];
  if (mats.qwertyLegendTex.image instanceof HTMLCanvasElement) {
    paintKeycapLegendAtlas(mats.qwertyLegendTex.image, p, 'qwerty');
    mats.qwertyLegendTex.needsUpdate = true;
  }
  if (mats.symbolsLegendTex.image instanceof HTMLCanvasElement) {
    paintKeycapLegendAtlas(mats.symbolsLegendTex.image, p, 'symbols');
    mats.symbolsLegendTex.needsUpdate = true;
  }
}

export function setKeycapLayout(mats: MechanismMaterialSet, layout: KeycapLayoutMode): void {
  mats.currentLayout = layout;
  mats.keycapLegend.map =
    layout === 'symbols' ? mats.symbolsLegendTex : mats.qwertyLegendTex;
  mats.keycapLegend.needsUpdate = true;
}

export function applyFinishToMaterials(mats: MechanismMaterialSet, finish: FinishId): void {
  mats.currentFinish = finish;
  const p = FINISH_PALETTES[finish];
  mats.machinedPrimary.color.setHex(p.primaryColor);
  mats.machinedPrimary.metalness = THREE.MathUtils.clamp(0.92 + p.metalnessShift, 0.72, 0.98);
  mats.machinedPrimary.roughness = THREE.MathUtils.clamp(0.38 + p.roughnessShift, 0.2, 0.58);

  mats.plungerTurned.color.setHex(p.plungerColor);
  mats.plungerTurned.metalness = THREE.MathUtils.clamp(0.93 + p.metalnessShift, 0.74, 0.98);
  mats.plungerTurned.roughness = THREE.MathUtils.clamp(0.35 + p.roughnessShift, 0.18, 0.54);

  mats.polishedPin.color.setHex(p.pinColor);
  mats.polishedPin.metalness = THREE.MathUtils.clamp(0.95 + p.metalnessShift, 0.82, 0.99);
  mats.polishedPin.roughness = THREE.MathUtils.clamp(0.18 + p.roughnessShift, 0.1, 0.28);

  mats.mirrorChrome.color.setHex(p.chromeColor);
  mats.bearingBronze.color.setHex(p.bronzeColor);

  mats.recessedDark.color.setHex(p.recessColor);
  mats.recessedDark.metalness = THREE.MathUtils.clamp(0.65 + p.metalnessShift, 0.45, 0.82);
  mats.recessedDark.roughness = THREE.MathUtils.clamp(0.58 + p.roughnessShift, 0.44, 0.74);

  mats.housingMatte.color.setHex(p.housingColor);
  mats.housingMatte.metalness = THREE.MathUtils.clamp(0.86 + p.metalnessShift, 0.68, 0.94);
  mats.housingMatte.roughness = THREE.MathUtils.clamp(0.48 + p.roughnessShift, 0.34, 0.64);

  mats.springWire.color.setHex(p.springColor);
  mats.springWire.metalness = THREE.MathUtils.clamp(0.96 + p.metalnessShift, 0.8, 0.99);
  mats.springWire.roughness = THREE.MathUtils.clamp(0.15 + p.roughnessShift, 0.09, 0.26);

  mats.keycapChromeBezel.color.setHex(p.bezelColor);
  mats.keycapPorcelain.color.setHex(p.porcelainColor);
  mats.keycapCrimson.color.setHex(p.crimsonColor);

  repaintKeycapLegends(mats);
}

/**
 * Generates a high-precision multi-layer soft studio ambient occlusion & directional shadow
 * catcher texture aligned directly beneath every component of the mechanism.
 */
export function createStudioShadowTexture(): THREE.CanvasTexture {
  const w = 640;
  const h = Math.round(640 / (WORLD_WIDTH / WORLD_HEIGHT));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  const passes = [
    { dx: 9, dy: 14, blur: 15, alpha: 0.18 },
    { dx: 4.5, dy: 7, blur: 6.5, alpha: 0.23 },
    { dx: 1.2, dy: 2.2, blur: 2.2, alpha: 0.25 },
  ];

  for (const pass of passes) {
    ctx.save();
    ctx.filter = `blur(${pass.blur}px)`;
    ctx.fillStyle = `rgba(14, 18, 28, ${pass.alpha})`;
    ctx.strokeStyle = `rgba(14, 18, 28, ${pass.alpha})`;
    ctx.lineCap = 'round';
    ctx.translate(pass.dx, pass.dy);

    ctx.lineWidth = 7.5;
    for (const bar of COMB_BARS) {
      ctx.beginPath();
      ctx.moveTo(bar.u * w, bar.vStart * h);
      ctx.lineTo(bar.u * w, bar.vEnd * h);
      ctx.stroke();
    }

    for (const act of KEY_ACTUATORS) {
      const cx = act.u * w;
      const cy = act.v * h;
      const rDisc = 0.019 * w;
      ctx.beginPath();
      ctx.arc(cx, cy, rDisc, 0, Math.PI * 2);
      ctx.fill();

      const rArc = (act.arcRadius / WORLD_HEIGHT) * h;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(cx, cy, rArc, -Math.PI / 2 - act.arcHalfAngle, -Math.PI / 2 + act.arcHalfAngle);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, rArc, Math.PI / 2 - act.arcHalfAngle, Math.PI / 2 + act.arcHalfAngle);
      ctx.stroke();

      ctx.lineWidth = 5.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, act.stemEndV * h);
      ctx.stroke();
    }

    ctx.lineWidth = 10.5;
    for (const hinge of HINGE_CLUSTERS) {
      ctx.beginPath();
      ctx.moveTo(hinge.uStart * w, hinge.v * h);
      ctx.lineTo(hinge.uEnd * w, hinge.v * h);
      ctx.stroke();
    }

    ctx.lineWidth = 9.2;
    for (const sp of COIL_SPRINGS) {
      ctx.beginPath();
      ctx.moveTo(sp.u * w, sp.vTop * h);
      ctx.lineTo(sp.u * w, sp.vBottom * h);
      ctx.stroke();
    }

    ctx.lineWidth = 6.8;
    ctx.beginPath();
    ctx.moveTo(LOWER_CARRIAGE.upperBarUMin * w, LOWER_CARRIAGE.upperBarV * h);
    ctx.lineTo(LOWER_CARRIAGE.upperBarUMax * w, LOWER_CARRIAGE.upperBarV * h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(LOWER_CARRIAGE.lowerBailUMin * w, LOWER_CARRIAGE.lowerBailV * h);
    ctx.lineTo(LOWER_CARRIAGE.lowerBailUMax * w, LOWER_CARRIAGE.lowerBailV * h);
    ctx.stroke();

    ctx.fillRect(0.072 * w, 0.55 * h, 0.044 * w, 0.068 * h);
    ctx.fillRect(0.07 * w, 0.682 * h, 0.044 * w, 0.095 * h);
    ctx.fillRect(0.884 * w, 0.55 * h, 0.046 * w, 0.068 * h);

    ctx.lineWidth = 6.8;
    ctx.beginPath();
    ctx.moveTo(0.062 * w, 0.456 * h);
    ctx.lineTo(0.062 * w, 0.735 * h);
    ctx.stroke();
    ctx.fillRect(0.198 * w, 0.682 * h, 0.032 * w, 0.092 * h);

    const sLeft = STADIUM_HANDLE.uMin * w;
    const sRight = STADIUM_HANDLE.uMax * w;
    const sTop = STADIUM_HANDLE.vMin * h;
    const sBot = STADIUM_HANDLE.vMax * h;
    const sRad = (sBot - sTop) * 0.5;
    ctx.lineWidth = 6.8;
    ctx.beginPath();
    ctx.moveTo(sLeft + sRad, sTop);
    ctx.lineTo(sRight - sRad, sTop);
    ctx.arc(sRight - sRad, sTop + sRad, sRad, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(sLeft + sRad, sBot);
    ctx.arc(sLeft + sRad, sTop + sRad, sRad, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.stroke();
    ctx.fillRect(0.822 * w, 0.71 * h, 0.085 * w, 0.068 * h);

    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
