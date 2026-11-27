import * as THREE from 'three';
import { KEY_ACTUATORS, WORLD_HEIGHT, WORLD_WIDTH, toX, toZ } from './blueprint';

/**
 * Custom GLSL shaders powering the vintage mechanical typewriter keycap craft:
 * 1. Anisotropic Machined Stainless/Chrome Bezel shader (onBeforeCompile)
 * 2. Matte-Satin Concave Porcelain & Deep Carmine Lacquer Enamel shader (onBeforeCompile)
 * 3. Analytical 32-key Real-Time Dynamic SDF Contact Shadow ShaderMaterial
 */

/**
 * Enhances a Three.js PBR material with balanced photographic stainless-chrome reflections:
 * dark machined outer skirt, crisp steel horizon contrast, fine brushed lathe micro-grain,
 * and a tight specular edge glint—never flat glowing white.
 */
export function enhanceChromeBezelMaterial(mat: THREE.MeshStandardMaterial): void {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBezelWorldPos;
        varying vec3 vBezelWorldNorm;
        varying vec3 vBezelLocalPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBezelLocalPos = position;
        vec4 bezelWp = modelMatrix * vec4(transformed, 1.0);
        vBezelWorldPos = bezelWp.xyz;
        vBezelWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBezelWorldPos;
        varying vec3 vBezelWorldNorm;
        varying vec3 vBezelLocalPos;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `
        vec3 bzN = normalize(vBezelWorldNorm);
        vec3 bzV = normalize(cameraPosition - vBezelWorldPos);
        vec3 bzR = reflect(-bzV, bzN);

        // Tight studio key & fill edge reflections (high exponent = crisp thin metal glint, zero glare)
        float keyGlint = pow(clamp(dot(bzR, normalize(vec3(-0.58, 0.68, -0.44))), 0.0, 1.0), 42.0);
        float rimGlint = pow(clamp(dot(bzR, normalize(vec3(0.52, 0.62, 0.58))), 0.0, 1.0), 54.0);

        // Strong photographic dark reflection on steep outer vertical walls & lower skirt
        float verticalWall = 1.0 - smoothstep(0.18, 0.72, abs(bzN.y));
        float lowerSkirtAO = smoothstep(-0.13, 0.09, vBezelLocalPos.y);
        float keySide = dot(bzN, normalize(vec3(-0.5, 0.72, -0.48)));

        // Subtle anisotropic brushed-metal radial banding so chrome reads as turned steel
        float angleBand = sin(atan(vBezelLocalPos.z, vBezelLocalPos.x) * 4.0 + 0.6) * 0.055;
        float latheMicro = sin(length(vBezelLocalPos.xz) * 145.0) * 0.018;

        float metalShade = (0.56 + 0.36 * lowerSkirtAO + 0.16 * keySide - 0.30 * verticalWall + angleBand + latheMicro);
        vec3 chromeBase = gl_FragColor.rgb * clamp(metalShade, 0.24, 1.04);
        vec3 specAccent = vec3(0.92, 0.94, 0.98) * (keyGlint * 0.24 + rimGlint * 0.13);

        gl_FragColor.rgb = clamp(chromeBase + specAccent, 0.0, 0.96);
        #include <dithering_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'typewriter-chrome-bezel-v3';
}

/**
 * Enhances the concave matte-satin porcelain enamel (or deep carmine-crimson lacquer)
 * dish using exact parametric perimeter UV (`uv.x` = 0 at center spine -> 1 at chrome lip),
 * a crisp dark recessed bezel seam groove, and organic ceramic micro-grain so dishes read
 * as tactile physical porcelain instead of blown-out CGI plastic.
 */
export function enhancePorcelainEnamelMaterial(
  mat: THREE.MeshStandardMaterial,
  options: { isCrimson?: boolean; dishRadius?: number } = {},
): void {
  const isCrimson = options.isCrimson ?? false;

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vEnamelRimUv;
        varying vec3 vEnamelWorldPos;
        varying vec3 vEnamelWorldNorm;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vEnamelRimUv = uv;
        vEnamelWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vEnamelWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vEnamelRimUv;
        varying vec3 vEnamelWorldPos;
        varying vec3 vEnamelWorldNorm;

        float enamelHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `
        vec3 enN = normalize(vEnamelWorldNorm);
        vec3 enV = normalize(cameraPosition - vEnamelWorldPos);

        // Exact stadium & circular perimeter factor (0 at center -> 1 at chrome inner bezel seam)
        float rimT = clamp(vEnamelRimUv.x, 0.0, 1.0);

        // Two-stage recessed bezel groove: soft concave bowl falloff + sharp dark seam line
        float bowlAO = mix(1.0, ${isCrimson ? '0.64' : '0.78'}, smoothstep(0.58, 0.96, rimT));
        float seamGroove = mix(1.0, ${isCrimson ? '0.46' : '0.58'}, smoothstep(0.90, 1.0, rimT));
        float creviceShadow = bowlAO * seamGroove;

        // Subtle organic ceramic / lacquer micro-tooth (breaks up sterile digital smoothness)
        float grain = (enamelHash(floor(vEnamelWorldPos.xz * 260.0)) - 0.5) * 0.022;

        // Concave dish directional curvature shading
        float dishTilt = dot(enN, normalize(vec3(-0.42, 0.86, -0.30)));
        vec3 halfVec = normalize(normalize(vec3(-0.44, 0.84, -0.34)) + enV);
        float specSheen = pow(max(0.0, dot(enN, halfVec)), ${isCrimson ? '48.0' : '32.0'});

        ${
          isCrimson
            ? `
            // Deep saturated carmine-ruby lacquer matching frame_qwerty.png (never pale pink!)
            vec3 deepWine = vec3(0.42, 0.025, 0.05);
            vec3 richRuby = gl_FragColor.rgb * (0.86 + dishTilt * 0.12 + grain);
            vec3 shadedRuby = mix(deepWine, richRuby, clamp(creviceShadow * 1.08, 0.0, 1.0));
            vec3 lacquerGlint = vec3(0.95, 0.62, 0.66) * specSheen * 0.12;
            gl_FragColor.rgb = clamp(shadedRuby * creviceShadow + lacquerGlint, 0.0, 0.92);
            `
            : `
            // Tactile matte-satin alabaster porcelain with dark recessed rim & subtle cool-warm tilt
            float porcelainShade = (0.86 + dishTilt * 0.11 + grain) * creviceShadow;
            vec3 subtleSheen = vec3(0.96, 0.97, 0.99) * specSheen * 0.045;
            gl_FragColor.rgb = clamp(gl_FragColor.rgb * porcelainShade + subtleSheen, 0.0, 0.93);
            `
        }
        #include <dithering_fragment>`,
      );
  };
  mat.customProgramCacheKey = () =>
    `typewriter-enamel-v3-${isCrimson ? 'crimson' : 'porcelain'}`;
}

export interface KeyShadowDescriptor {
  /** World X center */
  x: number;
  /** World Z center */
  z: number;
  /** Half straight segment length along X (0 for circular keys, >0 for horizontal pill keys) */
  halfSpanX: number;
  /** Cap radius in world units */
  radius: number;
  /** Whether this key is on the right bank (for Split X-Ray shadow attenuation) */
  isRightBank: boolean;
}

/**
 * Exact 32-key descriptor table matching the video's complete mechanical typewriter layout:
 *   0..25 : QWERTY circular keys (Q..M)
 *   26    : Row 3 Left Shift pill (⇧ / #+=)
 *   27    : Row 3 Right Crimson Backspace pill (⌫)
 *   28    : Row 4 Bottom-Left Mode Toggle pill (123 / ABC)
 *   29    : Row 4 Bottom-Left Circular Emoji key (☺)
 *   30    : Row 4 Center Spacebar pill
 *   31    : Row 4 Bottom-Right Return pill (↵)
 */
export const KEY_SHADOW_DESCRIPTORS: readonly KeyShadowDescriptor[] = [
  ...KEY_ACTUATORS.map((act) => ({
    x: toX(act.u),
    z: toZ(act.v),
    halfSpanX: 0,
    radius: 0.485,
    isRightBank: act.u >= 0.49,
  })),
  // 26: Left Shift pill (u=0.095, v=0.598, total width 1.48, radius 0.48 -> halfSpanX = 0.26)
  { x: toX(0.095), z: toZ(0.598), halfSpanX: 0.26, radius: 0.48, isRightBank: false },
  // 27: Right Crimson Backspace pill (u=0.905, v=0.598)
  { x: toX(0.905), z: toZ(0.598), halfSpanX: 0.26, radius: 0.48, isRightBank: true },
  // 28: Bottom-Left 123 / ABC pill (u=0.095, v=0.728)
  { x: toX(0.095), z: toZ(0.728), halfSpanX: 0.26, radius: 0.48, isRightBank: false },
  // 29: Bottom-Left Circular Emoji key (u=0.214, v=0.728)
  { x: toX(0.214), z: toZ(0.728), halfSpanX: 0, radius: 0.48, isRightBank: false },
  // 30: Center Spacebar pill (u=0.499, v=0.728, total width 5.42, radius 0.48 -> halfSpanX = 2.23)
  { x: toX(0.499), z: toZ(0.728), halfSpanX: 2.23, radius: 0.48, isRightBank: true },
  // 31: Right Return pill (u=0.858, v=0.728, total width 2.74, radius 0.48 -> halfSpanX = 0.89)
  { x: toX(0.858), z: toZ(0.728), halfSpanX: 0.89, radius: 0.48, isRightBank: true },
];

export interface DynamicKeyShadowUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uKeyGeom: THREE.IUniform<THREE.Vector4[]>;
  uKeyRightBank: THREE.IUniform<number[]>;
  uKeyPress: THREE.IUniform<number[]>;
  uExplode: THREE.IUniform<number>;
  uModeMask: THREE.IUniform<number>; // 0 = hidden (mechanism), 1 = cutaway (left solid), 2 = full keycaps
}

/**
 * Custom GLSL ShaderMaterial rendering ultra-smooth, deeply grounded real-time SDF
 * drop & contact shadows for all 32 circular & pill typewriter keys in a single draw call.
 */
export function createDynamicKeyShadowMaterial(): {
  material: THREE.ShaderMaterial;
  uniforms: DynamicKeyShadowUniforms;
} {
  const keyGeom = KEY_SHADOW_DESCRIPTORS.map(
    (k) => new THREE.Vector4(k.x, k.z, k.halfSpanX, k.radius),
  );
  const keyRightBank = KEY_SHADOW_DESCRIPTORS.map((k) => (k.isRightBank ? 1.0 : 0.0));
  const keyPress = new Array<number>(32).fill(0);

  const uniforms: DynamicKeyShadowUniforms = {
    uKeyGeom: { value: keyGeom },
    uKeyRightBank: { value: keyRightBank },
    uKeyPress: { value: keyPress },
    uExplode: { value: 0 },
    uModeMask: { value: 2 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: `
      varying vec2 vWorldXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec4 uKeyGeom[32];
      uniform float uKeyRightBank[32];
      uniform float uKeyPress[32];
      uniform float uExplode;
      uniform float uModeMask;
      varying vec2 vWorldXZ;

      // Exact 2D horizontal stadium/capsule SDF centered at (0,0)
      float sdPill(vec2 p, float halfSpanX, float r) {
        p.x = abs(p.x) - halfSpanX;
        p.x = max(p.x, 0.0);
        return length(p) - r;
      }

      void main() {
        if (uModeMask < 0.5) discard;
        float explodeFade = clamp(1.0 - uExplode * 1.15, 0.0, 1.0);
        if (explodeFade <= 0.01) discard;

        float totalShadow = 0.0;

        for (int i = 0; i < 32; i++) {
          vec4 kg = uKeyGeom[i];
          vec2 delta = vWorldXZ - kg.xy;
          // Tight AABB early-reject skips ~94% of distant keys per pixel with 100% identical output
          if (abs(delta.x) > kg.z + kg.w + 0.42 || abs(delta.y) > kg.w + 0.54) continue;

          float bankMask = (uModeMask < 1.5 && uKeyRightBank[i] > 0.5) ? 0.24 : 1.0;
          float press = clamp(uKeyPress[i], 0.0, 1.15);

          // Grounded studio drop shadow + tight bezel skirt contact ambient occlusion
          vec2 dropOffset = mix(vec2(0.045, 0.165), vec2(0.012, 0.036), press);
          float penumbra = mix(0.27, 0.10, press);
          float coreStrength = mix(0.44, 0.58, press);

          float dDrop = sdPill(delta - dropOffset, kg.z, kg.w * mix(0.99, 0.95, press));
          float dContact = sdPill(delta - vec2(0.01, 0.045), kg.z, kg.w * 0.99);

          float softDrop = 1.0 - smoothstep(-0.08, penumbra, dDrop);
          float tightContact = 1.0 - smoothstep(-0.04, 0.095, dContact);
          float s = (softDrop * 0.62 + tightContact * 0.52) * coreStrength * bankMask;

          totalShadow = 1.0 - (1.0 - totalShadow) * (1.0 - clamp(s, 0.0, 0.85));
        }

        float finalAlpha = clamp(totalShadow * explodeFade, 0.0, 0.76);
        if (finalAlpha < 0.004) discard;
        // Rich deep charcoal-slate shadow grounding the typewriter onto the matte pewter deck
        gl_FragColor = vec4(0.05, 0.07, 0.11, finalAlpha);
      }
    `,
  });

  return { material, uniforms };
}

export function createDynamicShadowPlaneGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(WORLD_WIDTH * 1.14, WORLD_HEIGHT * 1.1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
