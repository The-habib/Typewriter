import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  CAMERA_PRESETS,
  PART_CATALOG,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type CameraPresetId,
  type FinishId,
  type KeycapLayoutMode,
  type KeycapViewMode,
  type PartMetadata,
} from '../mechanism/blueprint';
import {
  createInitialKinematicState,
  dampValue,
  mapKeyboardInput,
  stepKinematics,
  type AnimationMode,
} from '../mechanism/kinematics';
import {
  applyFinishToMaterials,
  createMechanismMaterials,
  createStudioShadowTexture,
  repaintKeycapLegends,
} from '../mechanism/materials';
import { MechanicalAudioEngine } from '../mechanism/mechanicalAudio';
import { MechanismAssembly, type InteractiveUserData } from '../mechanism/MechanismAssembly';
import { sampleScrollChoreography } from '../mechanism/scrollChoreography';
import { createStudioLightboxEnvironment } from '../mechanism/studioEnvironment';

export type ViewportStageMode = 'scroll' | 'interactive';

export interface MechanismViewportHandle {
  setStageMode: (mode: ViewportStageMode, presetOverride?: CameraPresetId) => void;
  setScrollProgress: (progress: number) => void;
  setRenderingActive: (active: boolean) => void;
  setCameraPreset: (id: CameraPresetId) => void;
  setExplode: (value: number) => void;
  setFinish: (finish: FinishId) => void;
  setKeycapViewMode: (mode: KeycapViewMode) => void;
  setKeycapLayoutMode: (layout: KeycapLayoutMode) => void;
  setAnimationMode: (mode: AnimationMode) => void;
  setSpeed: (speed: number) => void;
  setAutoOrbit: (enabled: boolean) => void;
  setAudioEnabled: (enabled: boolean) => void;
  triggerAction: (action: 'space' | 'return' | 'shift' | 'backspace' | 'mode' | 'emoji') => void;
}

interface MechanismViewportProps {
  initialFinish: FinishId;
  initialMode: AnimationMode;
  initialKeycapMode: KeycapViewMode;
  initialKeycapLayout: KeycapLayoutMode;
  stageMode: ViewportStageMode;
  controllerRef: React.MutableRefObject<MechanismViewportHandle | null>;
  onSelectPart: (part: PartMetadata & { instanceLabel?: string }) => void;
  onToggleKeycapLayout: () => void;
  onCameraUserDrag: () => void;
  onReadyStateChange?: (ready: boolean) => void;
}

// Pre-allocated scratch vectors outside the animation loop (zero GC)
const _ndc = new THREE.Vector2();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const MechanismViewport = memo(function MechanismViewport({
  initialFinish,
  initialMode,
  initialKeycapMode,
  initialKeycapLayout,
  stageMode,
  controllerRef,
  onSelectPart,
  onToggleKeycapLayout,
  onCameraUserDrag,
  onReadyStateChange,
}: MechanismViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectPartRef = useRef(onSelectPart);
  const onToggleKeycapLayoutRef = useRef(onToggleKeycapLayout);
  const onCameraUserDragRef = useRef(onCameraUserDrag);
  const onReadyStateChangeRef = useRef(onReadyStateChange);
  const initialFinishRef = useRef(initialFinish);
  const initialModeRef = useRef(initialMode);
  const initialKeycapModeRef = useRef(initialKeycapMode);
  const initialKeycapLayoutRef = useRef(initialKeycapLayout);

  onSelectPartRef.current = onSelectPart;
  onToggleKeycapLayoutRef.current = onToggleKeycapLayout;
  onCameraUserDragRef.current = onCameraUserDrag;
  onReadyStateChangeRef.current = onReadyStateChange;

  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const mount = containerRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = !isSoftwareGl;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.transform = 'translateZ(0)';
    renderer.domElement.setAttribute('data-testid', 'mechanism-webgl-canvas');
    mount.appendChild(renderer.domElement);

    // Matte anodized pewter-slate photographic deck matching the reference hardware plate
    const STUDIO_BG = 0xd7dbe4;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(STUDIO_BG);
    scene.fog = new THREE.Fog(STUDIO_BG, 46, 94);

    const envRT = createStudioLightboxEnvironment(renderer);
    scene.environment = envRT.texture;

    // Initialize camera at Chapter 01 Hero scroll pose
    const initialSample = sampleScrollChoreography(0);
    const camera = new THREE.PerspectiveCamera(initialSample.fov, width / height, 0.1, 150);
    camera.position.set(...initialSample.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initialSample.target);
    controls.enabled = false; // Enabled strictly in interactive Workbench mode
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.075;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.85;
    controls.minDistance = 4.0;
    controls.maxDistance = 48;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.update();

    // Balanced photographic 3-point lighting rig (controlled luminance, zero blown-out white glare)
    const hemiLight = new THREE.HemisphereLight(0xe4e8f0, 0x6c7382, 0.56);
    hemiLight.position.set(0, 22, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ec, 1.56);
    keyLight.position.set(-6.2, 17.0, -5.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 4;
    keyLight.shadow.camera.far = 34;
    keyLight.shadow.camera.left = -8.2;
    keyLight.shadow.camera.right = 8.2;
    keyLight.shadow.camera.top = 7.2;
    keyLight.shadow.camera.bottom = -7.2;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.normalBias = 0.016;
    keyLight.shadow.radius = 2.6;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdce4f0, 0.78);
    rimLight.position.set(8.2, 9.8, 8.6);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xd6dde8, 0.42);
    fillLight.position.set(-9.5, 5.8, 6.5);
    scene.add(fillLight);

    if (!isSoftwareGl) {
      // Subtle low grazing warm accent light to reveal bronze bushings, micro-springs & chamfers
      const grazeLight = new THREE.DirectionalLight(0xffe9cf, 0.44);
      grazeLight.position.set(3.5, 3.2, -10.5);
      scene.add(grazeLight);

      RectAreaLightUniformsLib.init();
      const softboxMain = new THREE.RectAreaLight(0xf6f8fc, 1.35, 14, 4.2);
      softboxMain.position.set(-1.4, 9.4, -3.0);
      softboxMain.lookAt(0, 0.5, 0);
      scene.add(softboxMain);

      const softboxFront = new THREE.RectAreaLight(0xeef2f8, 0.85, 12, 3.2);
      softboxFront.position.set(2.4, 7.2, 5.8);
      softboxFront.lookAt(0, 0.5, 0);
      scene.add(softboxFront);
    }

    // Transparent shadow-only catcher plane (grounded depth with zero white specular floor glare)
    const floorGeo = new THREE.PlaneGeometry(96, 96);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.ShadowMaterial({
      color: 0x0b101a,
      opacity: 0.24,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const shadowTex = createStudioShadowTexture();
    const shadowPlaneGeo = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: isSoftwareGl ? 0.96 : 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.position.y = 0.015;
    scene.add(shadowPlane);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const materials = createMechanismMaterials(
      initialFinishRef.current,
      maxAnisotropy,
      !isSoftwareGl,
      initialKeycapLayoutRef.current,
    );
    const assembly = new MechanismAssembly(materials, !isSoftwareGl);
    assembly.setKeycapViewMode(initialKeycapModeRef.current);
    assembly.setKeycapLayoutMode(initialKeycapLayoutRef.current);
    scene.add(assembly.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const audioEngine = new MechanicalAudioEngine();
    const kinematics = createInitialKinematicState(initialModeRef.current);

    let currentStageMode: ViewportStageMode = 'scroll';
    let scrollTargetProgress = 0;
    let scrollSmoothedProgress = 0;
    let renderingActive = true;
    let manualAnimationMode: AnimationMode = initialModeRef.current;
    let manualExplodeTarget = 0;
    let camTransitionActive = false;
    let targetFov = initialSample.fov;
    let currentTimeSec = 0;
    const activePulseTimeouts: number[] = [];

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let isUpdatingControls = false;
    let disposed = false;
    let lastTimestamp = performance.now();
    let lastShadowUpdateMs = 0;
    let shadowForceDirty = !isSoftwareGl;
    let lastExplodeForShadow = 0;

    function applyScrollPose(p: number, snap: boolean) {
      const sample = sampleScrollChoreography(p);
      // Responsive mobile centering: pull target X back to 0 on narrow screens so mechanism centers nicely
      const isNarrow = (mount?.clientWidth || window.innerWidth) < 1024;
      const targetX = isNarrow ? sample.target[0] * 0.15 : sample.target[0];
      const posX = isNarrow ? sample.position[0] * 0.65 : sample.position[0];

      // Subtle living micro-parallax breathing on GPU only
      const breatheX = isSoftwareGl ? 0 : Math.sin(currentTimeSec * 0.55) * 0.08;
      const breatheY = isSoftwareGl ? 0 : Math.cos(currentTimeSec * 0.42) * 0.05;

      _targetCamPos.set(posX + breatheX, sample.position[1] + breatheY, sample.position[2]);
      _targetLookAt.set(targetX, sample.target[1], sample.target[2]);
      targetFov = isNarrow ? sample.fov + 7 : sample.fov;

      kinematics.explodeTarget = sample.explode;
      if (kinematics.animationMode !== sample.animationMode) {
        kinematics.animationMode = sample.animationMode;
        kinematics.nextTypingEvent = kinematics.cycleTime + 0.04;
      }

      if (snap) {
        camera.position.copy(_targetCamPos);
        controls.target.copy(_targetLookAt);
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
        kinematics.explodeProgress = sample.explode;
      }
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 280);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender(resetClockIfIdle = false) {
      if (disposed || !renderingActive) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      if (resetClockIfIdle) {
        lastTimestamp = performance.now();
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        if (!renderingActive) {
          renderBusy = false;
          return;
        }
        renderDirty = false;
        const dt = Math.min(Math.max((now - lastTimestamp) / 1000, 0.001), 0.05);
        lastTimestamp = now;
        currentTimeSec += dt;

        let keepGoing = false;
        const prevFov = camera.fov;

        if (currentStageMode === 'scroll') {
          if (isSoftwareGl) {
            scrollSmoothedProgress = scrollTargetProgress;
            applyScrollPose(scrollSmoothedProgress, true);
          } else {
            scrollSmoothedProgress = dampValue(
              scrollSmoothedProgress,
              scrollTargetProgress,
              10.5,
              dt,
            );
            applyScrollPose(scrollSmoothedProgress, false);
            const alpha = 1 - Math.exp(-11.0 * dt);
            camera.position.lerp(_targetCamPos, alpha);
            controls.target.lerp(_targetLookAt, alpha);
            camera.fov = dampValue(camera.fov, targetFov, 11.0, dt);
            if (Math.abs(scrollSmoothedProgress - scrollTargetProgress) > 0.0003) {
              keepGoing = true;
            }
          }
        } else if (camTransitionActive) {
          if (isSoftwareGl) {
            camera.position.copy(_targetCamPos);
            controls.target.copy(_targetLookAt);
            camera.fov = targetFov;
            camTransitionActive = false;
          } else {
            const alpha = 1 - Math.exp(-9.0 * dt);
            camera.position.lerp(_targetCamPos, alpha);
            controls.target.lerp(_targetLookAt, alpha);
            camera.fov = dampValue(camera.fov, targetFov, 9.0, dt);
            if (
              camera.position.distanceTo(_targetCamPos) < 0.012 &&
              controls.target.distanceTo(_targetLookAt) < 0.012 &&
              Math.abs(camera.fov - targetFov) < 0.03
            ) {
              camera.position.copy(_targetCamPos);
              controls.target.copy(_targetLookAt);
              camera.fov = targetFov;
              camTransitionActive = false;
            } else {
              keepGoing = true;
            }
          }
        }

        if (Math.abs(camera.fov - prevFov) > 0.0005) {
          camera.updateProjectionMatrix();
        }

        const stepRes = stepKinematics(kinematics, dt);
        assembly.update(kinematics);

        if (audioEngine.enabled && currentStageMode === 'interactive') {
          if (stepRes.heavyStrike) audioEngine.playHeavyCarriage();
          else if (stepRes.strikeCount > 0) {
            audioEngine.playKeyStrike(((kinematics.typingCursor % 7) - 3) * 0.25);
          }
        }

        const baseShadowOpacity = isSoftwareGl ? 0.96 : 0.72;
        shadowPlaneMat.opacity = baseShadowOpacity * (1 - kinematics.explodeProgress * 0.62);

        // Smart shadow-map cadence: full 120Hz GLSL SDF contact shadows every frame,
        // while 2048px PCFSoft directional shadow map updates immediately on explode/mode
        // changes and at a crisp 60Hz cadence during steady typing (halving 120Hz GPU pass cost)
        if (!isSoftwareGl && renderer.shadowMap.enabled) {
          const explodeChanged = Math.abs(kinematics.explodeProgress - lastExplodeForShadow) > 0.0008;
          if (shadowForceDirty || explodeChanged) {
            renderer.shadowMap.needsUpdate = true;
            shadowForceDirty = false;
            lastExplodeForShadow = kinematics.explodeProgress;
            lastShadowUpdateMs = now;
          } else if (stepRes.moving && now - lastShadowUpdateMs >= 16) {
            renderer.shadowMap.needsUpdate = true;
            lastShadowUpdateMs = now;
          }
        }

        if (stepRes.moving) keepGoing = true;

        // Frame-rate-independent OrbitControls damping across 60Hz / 120Hz / 240Hz displays
        if (controls.enableDamping) {
          controls.dampingFactor = 1 - Math.exp(-4.8 * dt);
        }

        isUpdatingControls = true;
        const controlsChanged = controls.update();
        isUpdatingControls = false;
        if (
          currentStageMode === 'interactive' &&
          ((controlsChanged && controls.enableDamping) || controls.autoRotate)
        ) {
          keepGoing = true;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderingActive && (renderDirty || keepGoing)) {
            requestRender(false);
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    }

    const handleControlStart = () => {
      if (currentStageMode !== 'interactive') return;
      if (camTransitionActive) camTransitionActive = false;
      onCameraUserDragRef.current();
    };
    const handleControlChange = () => {
      if (isUpdatingControls || currentStageMode !== 'interactive') return;
      requestRender();
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('change', handleControlChange);

    const pulseAction = (
      action: 'key' | 'space' | 'return' | 'shift' | 'backspace' | 'mode' | 'emoji',
      keyIndex?: number,
    ) => {
      if (action === 'key' && keyIndex !== undefined) {
        kinematics.keyTarget[keyIndex] = 1;
        audioEngine.playKeyStrike((keyIndex - 13) * 0.08);
        const tid = window.setTimeout(() => {
          if (kinematics.animationMode === 'idle') kinematics.keyTarget[keyIndex] = 0;
          requestRender();
        }, 190);
        activePulseTimeouts.push(tid);
      } else if (action === 'space') {
        kinematics.spaceTarget = 1;
        audioEngine.playHeavyCarriage();
        const tid = window.setTimeout(() => {
          if (kinematics.animationMode === 'idle') kinematics.spaceTarget = 0;
          requestRender();
        }, 260);
        activePulseTimeouts.push(tid);
      } else if (action === 'return') {
        kinematics.returnTarget = 1;
        audioEngine.playHeavyCarriage();
        const tid = window.setTimeout(() => {
          if (kinematics.animationMode === 'idle') kinematics.returnTarget = 0;
          requestRender();
        }, 260);
        activePulseTimeouts.push(tid);
      } else if (action === 'shift') {
        kinematics.shiftTarget = 1;
        audioEngine.playHeavyCarriage();
        const tid = window.setTimeout(() => {
          if (kinematics.animationMode === 'idle') kinematics.shiftTarget = 0;
          requestRender();
        }, 260);
        activePulseTimeouts.push(tid);
      } else if (action === 'backspace') {
        kinematics.backspaceTarget = 1;
        audioEngine.playHeavyCarriage();
        const tid = window.setTimeout(() => {
          if (kinematics.animationMode === 'idle') kinematics.backspaceTarget = 0;
          requestRender();
        }, 220);
        activePulseTimeouts.push(tid);
      } else if (action === 'mode') {
        kinematics.modeKeyTarget = 1;
        audioEngine.playHeavyCarriage();
        const tid = window.setTimeout(() => {
          kinematics.modeKeyTarget = 0;
          requestRender();
        }, 210);
        activePulseTimeouts.push(tid);
      } else if (action === 'emoji') {
        kinematics.emojiTarget = 1;
        audioEngine.playKeyStrike(-0.4);
        const tid = window.setTimeout(() => {
          kinematics.emojiTarget = 0;
          requestRender();
        }, 190);
        activePulseTimeouts.push(tid);
      }
      requestRender(true);
    };

    const raycaster = new THREE.Raycaster();
    let downX = 0;
    let downY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (currentStageMode !== 'interactive') return;
      downX = e.clientX;
      downY = e.clientY;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (currentStageMode !== 'interactive') return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(_ndc, camera);
      const hits = raycaster.intersectObjects(assembly.interactables, false);
      if (hits.length > 0) {
        const ud = hits[0].object.userData as InteractiveUserData;
        if (ud?.partCategory) {
          const catalogEntry = PART_CATALOG[ud.partCategory];
          if (catalogEntry) {
            onSelectPartRef.current({ ...catalogEntry, instanceLabel: ud.label });
          }
          if (ud.actionType === 'mode') {
            pulseAction('mode');
            onToggleKeycapLayoutRef.current();
          } else if (ud.actionType) {
            pulseAction(ud.actionType, ud.keyIndex);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentStageMode !== 'interactive') return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const mapped = mapKeyboardInput(e.key);
      if (!mapped) return;
      if (mapped.type === 'space') {
        e.preventDefault();
        kinematics.spaceTarget = 1;
        audioEngine.playHeavyCarriage();
        onSelectPartRef.current({ ...PART_CATALOG.spring, instanceLabel: 'Spacebar Bail & Twin Springs' });
      } else if (mapped.type === 'return') {
        kinematics.returnTarget = 1;
        audioEngine.playHeavyCarriage();
        onSelectPartRef.current({ ...PART_CATALOG.stadium, instanceLabel: 'Stadium Return Lever' });
      } else if (mapped.type === 'shift') {
        kinematics.shiftTarget = 1;
        audioEngine.playHeavyCarriage();
        onSelectPartRef.current({ ...PART_CATALOG.shiftLeft, instanceLabel: 'Left Shift Lock Housing' });
      } else if (mapped.type === 'backspace') {
        e.preventDefault();
        kinematics.backspaceTarget = 1;
        audioEngine.playHeavyCarriage();
        onSelectPartRef.current({ ...PART_CATALOG.keycap, instanceLabel: 'Crimson Enamel Backspace [⌫]' });
      } else {
        kinematics.keyTarget[mapped.index] = 1;
        audioEngine.playKeyStrike((mapped.index - 13) * 0.08);
        const capVisible = assembly.getKeycapViewMode() !== 'mechanism';
        onSelectPartRef.current({
          ...(capVisible ? PART_CATALOG.keycap : PART_CATALOG.actuator),
          instanceLabel: capVisible
            ? `Typewriter Key [${e.key.toUpperCase()}]`
            : `Key Actuator [${e.key.toUpperCase()}]`,
        });
      }
      requestRender(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (currentStageMode !== 'interactive') return;
      const mapped = mapKeyboardInput(e.key);
      if (!mapped) return;
      if (mapped.type === 'space') kinematics.spaceTarget = 0;
      else if (mapped.type === 'return') kinematics.returnTarget = 0;
      else if (mapped.type === 'shift') kinematics.shiftTarget = 0;
      else if (mapped.type === 'backspace') kinematics.backspaceTarget = 0;
      else kinematics.keyTarget[mapped.index] = 0;
      requestRender();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      const pr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h);
      if (currentStageMode === 'scroll') {
        applyScrollPose(scrollSmoothedProgress, isSoftwareGl);
      }
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const applyPreset = (id: CameraPresetId) => {
      const preset = CAMERA_PRESETS.find((p) => p.id === id);
      if (!preset) return;
      _targetCamPos.set(...preset.position);
      _targetLookAt.set(...preset.target);
      targetFov = preset.fov;
      if (isSoftwareGl) {
        camera.position.copy(_targetCamPos);
        controls.target.copy(_targetLookAt);
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
        isUpdatingControls = true;
        controls.update();
        isUpdatingControls = false;
        camTransitionActive = false;
      } else {
        camTransitionActive = true;
      }
      requestRender(true);
    };

    controllerRef.current = {
      setStageMode: (mode: ViewportStageMode, presetOverride?: CameraPresetId) => {
        if (currentStageMode === mode && !presetOverride) return;
        currentStageMode = mode;
        controls.enabled = mode === 'interactive';
        if (mode === 'interactive') {
          kinematics.animationMode = manualAnimationMode;
          kinematics.explodeTarget = manualExplodeTarget;
          if (isSoftwareGl) {
            kinematics.explodeProgress = manualExplodeTarget;
          }
          applyPreset(presetOverride ?? 'top');
        } else {
          controls.autoRotate = false;
          camTransitionActive = false;
          applyScrollPose(scrollTargetProgress, isSoftwareGl);
          requestRender(true);
        }
      },
      setScrollProgress: (progress: number) => {
        scrollTargetProgress = THREE.MathUtils.clamp(progress, 0, 1);
        if (currentStageMode === 'scroll') {
          if (isSoftwareGl) {
            scrollSmoothedProgress = scrollTargetProgress;
            applyScrollPose(scrollSmoothedProgress, true);
          }
          requestRender(true);
        }
      },
      setRenderingActive: (active: boolean) => {
        if (renderingActive === active) return;
        renderingActive = active;
        if (active) {
          requestRender(true);
        }
      },
      setCameraPreset: (id: CameraPresetId) => {
        if (currentStageMode !== 'interactive') {
          currentStageMode = 'interactive';
          controls.enabled = true;
        }
        applyPreset(id);
      },
      setExplode: (val: number) => {
        manualExplodeTarget = THREE.MathUtils.clamp(val, 0, 1);
        kinematics.explodeTarget = manualExplodeTarget;
        if (isSoftwareGl) {
          kinematics.explodeProgress = manualExplodeTarget;
        }
        shadowForceDirty = true;
        requestRender(true);
      },
      setFinish: (finish: FinishId) => {
        applyFinishToMaterials(materials, finish);
        requestRender(true);
      },
      setKeycapViewMode: (mode: KeycapViewMode) => {
        assembly.setKeycapViewMode(mode);
        assembly.update(kinematics);
        shadowForceDirty = true;
        requestRender(true);
      },
      setKeycapLayoutMode: (layout: KeycapLayoutMode) => {
        assembly.setKeycapLayoutMode(layout);
        pulseAction('mode');
        assembly.update(kinematics);
        requestRender(true);
      },
      setAnimationMode: (mode: AnimationMode) => {
        manualAnimationMode = mode;
        kinematics.animationMode = mode;
        if (mode === 'idle') {
          kinematics.keyTarget.fill(0);
          kinematics.spaceTarget = 0;
          kinematics.returnTarget = 0;
          kinematics.shiftTarget = 0;
          kinematics.backspaceTarget = 0;
        } else {
          kinematics.nextTypingEvent = kinematics.cycleTime + 0.05;
        }
        requestRender(true);
      },
      setSpeed: (speed: number) => {
        kinematics.speed = THREE.MathUtils.clamp(speed, 0.25, 2.5);
        requestRender(true);
      },
      setAutoOrbit: (enabled: boolean) => {
        controls.autoRotate = !isSoftwareGl && currentStageMode === 'interactive' && enabled;
        requestRender(true);
      },
      setAudioEnabled: (enabled: boolean) => {
        audioEngine.setEnabled(enabled);
      },
      triggerAction: (action: 'space' | 'return' | 'shift' | 'backspace' | 'mode' | 'emoji') => {
        pulseAction(action);
      },
    };

    // Repaint the 1536x1536 slab-serif legend atlases once Google Fonts (Arvo / Courier Prime) finish loading
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (disposed) return;
        repaintKeycapLegends(materials);
        requestRender();
      });
    }

    applyScrollPose(0, true);
    assembly.update(kinematics);
    requestRender();
    onReadyStateChangeRef.current?.(true);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      for (const tid of activePulseTimeouts) clearTimeout(tid);
      controllerRef.current = null;

      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('change', handleControlChange);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      audioEngine.dispose();
      controls.dispose();
      assembly.dispose();
      materials.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      shadowPlaneGeo.dispose();
      shadowPlaneMat.dispose();
      shadowTex.dispose();
      envRT.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [controllerRef]);

  return (
    <div
      className={`fixed inset-0 z-0 h-full w-full ${
        stageMode === 'interactive' ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {webglError && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-[#d7dbe4] p-6">
          <div className="max-w-md rounded-xl border border-slate-900/16 bg-[#eceff5] p-6 text-center shadow-sm">
            <h2 className="text-base font-semibold text-[#0d1017]">WebGL Context Unavailable</h2>
            <p className="mt-2 text-sm text-[#2e3543]">
              Hardware or software 3D graphics acceleration is currently suspended. Reload to restore
              the interactive 3D mechanism.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
