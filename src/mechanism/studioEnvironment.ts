import * as THREE from 'three';

/**
 * Generates a balanced studio softbox diffuser texture with a controlled silk core and
 * smooth cosine vignette falloff so metallic reflections exhibit rich silver-to-graphite
 * photographic gradients without blowing out highlights.
 */
function createSoftboxGradientTexture(
  coreHex: [number, number, number],
  edgeHex: [number, number, number],
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.54,
  );
  grad.addColorStop(0, `rgb(${coreHex[0]}, ${coreHex[1]}, ${coreHex[2]})`);
  grad.addColorStop(
    0.55,
    `rgb(${Math.round((coreHex[0] + edgeHex[0]) * 0.48)}, ${Math.round((coreHex[1] + edgeHex[1]) * 0.48)}, ${Math.round((coreHex[2] + edgeHex[2]) * 0.48)})`,
  );
  grad.addColorStop(1, `rgb(${edgeHex[0]}, ${edgeHex[1]}, ${edgeHex[2]})`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a balanced, high-contrast 5600K Photographic Dark-Flag Studio Environment
 * via PMREMGenerator. Unlike overexposed white lightboxes that turn chrome into flat white
 * plastic, this rig pairs controlled silk diffusers with deep charcoal negative-fill flags
 * and an overhead camera-baffle card so machined chrome, steel, and porcelain show crisp,
 * realistic multi-stop tonal depth.
 */
export function createStudioLightboxEnvironment(
  renderer: THREE.WebGLRenderer,
): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x88909e);

  const disposables: Array<{ dispose: () => void }> = [];
  const softboxGrad = createSoftboxGradientTexture([238, 241, 246], [96, 102, 114]);
  const warmSoftboxGrad = createSoftboxGradientTexture([246, 240, 230], [102, 100, 98]);
  disposables.push(softboxGrad, warmSoftboxGrad);

  const addPanel = (
    w: number,
    h: number,
    pos: [number, number, number],
    lookAt: [number, number, number],
    rgb: [number, number, number],
    map?: THREE.Texture,
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace),
      map: map ?? null,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.lookAt(...lookAt);
    envScene.add(mesh);
    disposables.push(geo, mat);
  };

  // Controlled cool-pewter photographic cyclorama dome (prevents flat white washout)
  const domeGeo = new THREE.SphereGeometry(28, 24, 16);
  const domeMat = new THREE.MeshBasicMaterial({
    color: 0x8e95a3,
    side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(domeGeo, domeMat));
  disposables.push(domeGeo, domeMat);

  // 1. Overhead controlled silk diffuser (soft sculpted ceiling tone, not blown-out white)
  addPanel(20, 14, [0, 15.0, -1.0], [0, 0, 0], [1.45, 1.47, 1.52], softboxGrad);

  // 2. Overhead dark studio camera-baffle card (creates realistic dark reflection band on chrome)
  addPanel(8.5, 5.2, [0.5, 13.4, 3.6], [0, 0, 0], [0.10, 0.11, 0.14]);

  // 3. Warm top-left photographic key softbox
  addPanel(14, 7.0, [-11.8, 10.0, -8.0], [0, 0, 0], [2.45, 2.38, 2.25], warmSoftboxGrad);

  // 4. Cool top-right secondary fill softbox
  addPanel(13, 6.0, [12.2, 8.6, 6.4], [0, 0, 0], [1.75, 1.82, 1.92], softboxGrad);

  // 5. Crisp thin horizontal rim strips (draws tight specular lines on rolled chrome & chamfers)
  addPanel(22, 1.4, [0, 7.6, -13.4], [0, 0, 0], [2.65, 2.68, 2.74]);
  addPanel(20, 1.3, [0, 6.4, 13.4], [0, 0, 0], [2.05, 2.08, 2.15]);

  // 6. Narrow overhead twin specular ribbons for authentic brushed CNC grain highlights
  addPanel(2.4, 16, [-5.6, 13.8, 1.2], [0, 0, 0], [2.25, 2.22, 2.18], softboxGrad);
  addPanel(2.2, 16, [6.2, 13.6, -1.6], [0, 0, 0], [1.95, 2.0, 2.08], softboxGrad);

  // 7. Low grazing side accent strips (picks out bronze bushings & coil wire turns)
  addPanel(15, 1.4, [-13.8, 4.4, -1.0], [0, 0.2, 0], [1.55, 1.48, 1.38]);
  addPanel(15, 1.4, [13.8, 4.2, 1.5], [0, 0.2, 0], [1.38, 1.42, 1.5]);

  // 8. Broad deep-charcoal negative-fill studio flags around the horizon
  //    (Essential for realistic dark-edge metallic contrast on chrome bezels & steel rods)
  addPanel(20, 9.5, [-14.2, 1.2, 4.0], [0, 0, 0], [0.018, 0.02, 0.026]);
  addPanel(20, 9.5, [14.2, 1.2, -4.0], [0, 0, 0], [0.016, 0.018, 0.024]);
  addPanel(28, 7.2, [0, 1.0, -14.8], [0, 0, 0], [0.02, 0.022, 0.028]);
  addPanel(28, 6.8, [0, 0.8, 14.8], [0, 0, 0], [0.024, 0.026, 0.034]);

  // 9. Matte anodized slate tabletop bounce below
  addPanel(32, 32, [0, -10, 0], [0, 0, 0], [0.58, 0.6, 0.65]);

  const envRT = pmrem.fromScene(envScene, 0.025);

  for (const d of disposables) d.dispose();
  pmrem.dispose();

  return envRT;
}
