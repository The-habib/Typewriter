import { useCallback, useEffect, useRef, useState } from 'react';
import { EngineeringDossier } from './components/EngineeringDossier';
import { InquiryFooter } from './components/InquiryFooter';
import { ScrollStoryOverlay, type ScrollStoryOverlayHandle } from './components/ScrollStoryOverlay';
import { TopNav } from './components/TopNav';
import { WorkbenchDock } from './components/WorkbenchDock';
import {
  PART_CATALOG,
  type CameraPresetId,
  type FinishId,
  type KeycapLayoutMode,
  type KeycapViewMode,
  type PartMetadata,
} from './mechanism/blueprint';
import { type AnimationMode } from './mechanism/kinematics';
import {
  computeChapterPresence,
  sampleScrollChoreography,
} from './mechanism/scrollChoreography';
import {
  MechanismViewport,
  type MechanismViewportHandle,
  type ViewportStageMode,
} from './scene/MechanismViewport';

const REF_IMAGE_PATH = '/assets/aistudio/Gemini_Generated_Image_lad87lad87lad87l_9dae1b58.png';
const SPEED_STEPS = [0.5, 1, 1.5, 2] as const;

export default function App() {
  const controllerRef = useRef<MechanismViewportHandle | null>(null);
  const storyOverlayRef = useRef<ScrollStoryOverlayHandle | null>(null);
  const storyTrackRef = useRef<HTMLDivElement | null>(null);
  const workbenchRef = useRef<HTMLElement | null>(null);

  const [stageMode, setStageMode] = useState<ViewportStageMode>('scroll');
  const [inStoryTrack, setInStoryTrack] = useState(true);
  const [activeChapter, setActiveChapter] = useState(0);
  const [visibleChapter, setVisibleChapter] = useState(0);

  const [activeCamera, setActiveCamera] = useState<CameraPresetId | null>('top');
  const [explode, setExplode] = useState(0);
  const [finish, setFinish] = useState<FinishId>('gunmetal');
  const [keycapMode, setKeycapMode] = useState<KeycapViewMode>('assembled');
  const [keycapLayout, setKeycapLayout] = useState<KeycapLayoutMode>('qwerty');
  const [animationMode, setAnimationMode] = useState<AnimationMode>('typing');
  const [speedIndex, setSpeedIndex] = useState(1);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [compareOverlay, setCompareOverlay] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(true);
  const [viewportReady, setViewportReady] = useState(false);
  const [selectedPart, setSelectedPart] = useState<
    (PartMetadata & { instanceLabel?: string }) | null
  >(null);

  const stageModeRef = useRef<ViewportStageMode>('scroll');
  const activeCameraRef = useRef<CameraPresetId | null>('top');
  const keycapModeRef = useRef<KeycapViewMode>('assembled');
  const userPinnedKeycapModeRef = useRef(false);
  activeCameraRef.current = activeCamera;
  keycapModeRef.current = keycapMode;

  const speed = SPEED_STEPS[speedIndex];

  // Smooth passive scroll listener mapping Story Track progress -> 3D spline + Workbench handoff
  useEffect(() => {
    let rafId = 0;

    const syncFromScroll = () => {
      rafId = 0;
      const storyEl = storyTrackRef.current;
      const wbEl = workbenchRef.current;
      const vh = window.innerHeight || 900;

      let storyVisible = false;
      let wbVisible = false;

      if (storyEl) {
        const rect = storyEl.getBoundingClientRect();
        const scrollable = Math.max(1, rect.height - vh);
        const rawProgress = Math.min(1, Math.max(0, -rect.top / scrollable));
        storyVisible = rect.bottom > 60 && rect.top < vh;

        controllerRef.current?.setScrollProgress(rawProgress);
        storyOverlayRef.current?.syncScrollProgress(rawProgress);
        const sample = sampleScrollChoreography(rawProgress);
        const nextVisibleChapter = computeChapterPresence(rawProgress).activeIndex;
        setVisibleChapter((prev) => (prev !== nextVisibleChapter ? nextVisibleChapter : prev));
        setActiveChapter((prev) => (prev !== sample.chapterIndex ? sample.chapterIndex : prev));
        setInStoryTrack((prev) => (prev !== storyVisible ? storyVisible : prev));

        // Unless user manually pinned a keycap mode, choreograph Split X-Ray cutaway during Chapters 02 & 03
        if (!userPinnedKeycapModeRef.current && stageModeRef.current === 'scroll') {
          const autoMode: KeycapViewMode =
            sample.chapterIndex === 1 || sample.chapterIndex === 2 ? 'cutaway' : 'assembled';
          if (keycapModeRef.current !== autoMode) {
            keycapModeRef.current = autoMode;
            setKeycapMode(autoMode);
            controllerRef.current?.setKeycapViewMode(autoMode);
          }
        }
      }

      if (wbEl) {
        const wbRect = wbEl.getBoundingClientRect();
        wbVisible = wbRect.top < vh * 0.58 && wbRect.bottom > vh * 0.25;
      }

      const nextStageMode: ViewportStageMode = wbVisible ? 'interactive' : 'scroll';
      if (stageModeRef.current !== nextStageMode) {
        stageModeRef.current = nextStageMode;
        setStageMode(nextStageMode);
        controllerRef.current?.setStageMode(
          nextStageMode,
          nextStageMode === 'interactive' ? (activeCameraRef.current ?? 'top') : undefined,
        );
        if (nextStageMode === 'scroll') {
          setCompareOverlay(false);
        }
      }

      // Pause WebGL completely while user reads opaque middle monograph sections
      controllerRef.current?.setRenderingActive(storyVisible || wbVisible);
    };

    const onScrollOrResize = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(syncFromScroll);
      }
    };

    syncFromScroll();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  const handleOpenWorkbench = useCallback((preset?: CameraPresetId) => {
    const targetPreset = preset ?? 'iso';
    setActiveCamera(targetPreset);
    setCompareOverlay(false);
    stageModeRef.current = 'interactive';
    setStageMode('interactive');
    controllerRef.current?.setRenderingActive(true);
    controllerRef.current?.setStageMode('interactive', targetPreset);
    workbenchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleOpenWorkbenchIso = useCallback(() => {
    handleOpenWorkbench('iso');
  }, [handleOpenWorkbench]);

  const handleToggleDock = useCallback(() => {
    setDockExpanded((prev) => !prev);
  }, []);

  const handleJumpToChapter = useCallback((chapterId: string) => {
    const el = document.getElementById(chapterId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleJumpTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectCamera = useCallback((id: CameraPresetId) => {
    setActiveCamera(id);
    if (id !== 'top') {
      setCompareOverlay(false);
    }
    controllerRef.current?.setCameraPreset(id);
  }, []);

  const handleExplodeChange = useCallback((val: number) => {
    setExplode(val);
    controllerRef.current?.setExplode(val);
  }, []);

  const handleSelectFinish = useCallback((next: FinishId) => {
    setFinish(next);
    controllerRef.current?.setFinish(next);
  }, []);

  const handleSelectKeycapMode = useCallback((mode: KeycapViewMode) => {
    userPinnedKeycapModeRef.current = true;
    keycapModeRef.current = mode;
    setKeycapMode(mode);
    controllerRef.current?.setKeycapViewMode(mode);
  }, []);

  const handleToggleKeycapLayout = useCallback(() => {
    setKeycapLayout((prev) => {
      const next: KeycapLayoutMode = prev === 'qwerty' ? 'symbols' : 'qwerty';
      controllerRef.current?.setKeycapLayoutMode(next);
      return next;
    });
  }, []);

  const handleSelectAnimationMode = useCallback((mode: AnimationMode) => {
    setAnimationMode(mode);
    controllerRef.current?.setAnimationMode(mode);
  }, []);

  const handleCycleSpeed = useCallback(() => {
    setSpeedIndex((prev) => {
      const nextIdx = (prev + 1) % SPEED_STEPS.length;
      controllerRef.current?.setSpeed(SPEED_STEPS[nextIdx]);
      return nextIdx;
    });
  }, []);

  const handleToggleAutoOrbit = useCallback(() => {
    setAutoOrbit((prev) => {
      const next = !prev;
      if (next && activeCamera === 'top') {
        setActiveCamera('iso');
        setCompareOverlay(false);
        controllerRef.current?.setCameraPreset('iso');
      }
      controllerRef.current?.setAutoOrbit(next);
      return next;
    });
  }, [activeCamera]);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      controllerRef.current?.setAudioEnabled(next);
      return next;
    });
  }, []);

  const handleTriggerAction = useCallback((action: 'space' | 'return' | 'shift' | 'backspace') => {
    controllerRef.current?.triggerAction(action);
    if (action === 'space') {
      setSelectedPart({ ...PART_CATALOG.spring, instanceLabel: 'Spacebar Bail & Twin Springs' });
    } else if (action === 'return') {
      setSelectedPart({ ...PART_CATALOG.stadium, instanceLabel: 'Stadium Return Lever' });
    } else if (action === 'backspace') {
      setSelectedPart({ ...PART_CATALOG.keycap, instanceLabel: 'Crimson Enamel Backspace [⌫]' });
    } else {
      setSelectedPart({ ...PART_CATALOG.shiftLeft, instanceLabel: 'Left Shift Lock Housing' });
    }
  }, []);

  const handleToggleCompare = useCallback(() => {
    setCompareOverlay((prev) => {
      const next = !prev;
      if (next) {
        setActiveCamera('top');
        setAutoOrbit(false);
        userPinnedKeycapModeRef.current = true;
        keycapModeRef.current = 'mechanism';
        setKeycapMode('mechanism');
        controllerRef.current?.setKeycapViewMode('mechanism');
        controllerRef.current?.setAutoOrbit(false);
        controllerRef.current?.setCameraPreset('top');
      }
      return next;
    });
  }, []);

  const handleCameraUserDrag = useCallback(() => {
    setActiveCamera(null);
    setCompareOverlay(false);
    setAutoOrbit(false);
    controllerRef.current?.setAutoOrbit(false);
  }, []);

  return (
    <div
      className="relative min-h-screen w-full overflow-x-clip bg-[#d7dbe4] text-[#0d1017]"
      data-viewport-ready={viewportReady ? 'true' : 'false'}
      data-stage-mode={stageMode}
      data-chapter={activeChapter + 1}
      data-camera={activeCamera ?? 'orbit'}
      data-finish={finish}
      data-keycap-mode={keycapMode}
      data-keycap-layout={keycapLayout}
      data-explode={Math.round(explode * 100)}
      data-mode={animationMode}
    >
      {/* Persistent Full-Bleed Fixed 3D Stage */}
      <MechanismViewport
        initialFinish="gunmetal"
        initialMode="typing"
        initialKeycapMode="assembled"
        initialKeycapLayout="qwerty"
        stageMode={stageMode}
        controllerRef={controllerRef}
        onSelectPart={setSelectedPart}
        onToggleKeycapLayout={handleToggleKeycapLayout}
        onCameraUserDrag={handleCameraUserDrag}
        onReadyStateChange={setViewportReady}
      />

      {/* Optional Top-Down Reference Plate Overlay inside Workbench */}
      {compareOverlay && stageMode === 'interactive' && (
        <div
          className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center"
          aria-hidden="true"
        >
          <img
            src={REF_IMAGE_PATH}
            alt="Reference mechanism plate overlay"
            referrerPolicy="no-referrer"
            className="h-full max-w-full object-contain opacity-45 mix-blend-multiply"
          />
        </div>
      )}

      {/* Strict 3-Zone Top Navigation Bar */}
      <TopNav onOpenWorkbench={handleOpenWorkbenchIso} />

      <main className="relative">
        {/* Act 1–5: Scroll-Driven 3D Choreography Track */}
        <div ref={storyTrackRef} className="relative z-10">
          <ScrollStoryOverlay
            activeChapter={activeChapter}
            visibleChapter={visibleChapter}
            inStoryTrack={inStoryTrack}
            keycapMode={keycapMode}
            keycapLayout={keycapLayout}
            overlayRef={storyOverlayRef}
            onSelectKeycapMode={handleSelectKeycapMode}
            onToggleKeycapLayout={handleToggleKeycapLayout}
            onJumpToChapter={handleJumpToChapter}
            onOpenWorkbench={handleOpenWorkbenchIso}
          />
        </div>

        {/* Act 6–7: Solid-Paper Swiss Engineering Monograph (Anatomy Grid + Metallurgy + Metrology) */}
        <EngineeringDossier
          finish={finish}
          onSelectFinish={handleSelectFinish}
          onInspectSubsystem={handleOpenWorkbench}
        />

        {/* Act 8: Full-Bleed Interactive 3D CAD Workbench Window */}
        <section
          id="workbench"
          ref={workbenchRef}
          aria-label="Interactive 3D Workbench"
          className="pointer-events-none relative z-10 h-screen min-h-[760px] w-full"
        >
          <WorkbenchDock
            activeCamera={activeCamera}
            explode={explode}
            finish={finish}
            keycapMode={keycapMode}
            keycapLayout={keycapLayout}
            animationMode={animationMode}
            speed={speed}
            autoOrbit={autoOrbit}
            audioEnabled={audioEnabled}
            compareOverlay={compareOverlay}
            dockExpanded={dockExpanded}
            selectedPart={selectedPart}
            onSelectCamera={handleSelectCamera}
            onExplodeChange={handleExplodeChange}
            onSelectFinish={handleSelectFinish}
            onSelectKeycapMode={handleSelectKeycapMode}
            onToggleKeycapLayout={handleToggleKeycapLayout}
            onSelectAnimationMode={handleSelectAnimationMode}
            onCycleSpeed={handleCycleSpeed}
            onToggleAutoOrbit={handleToggleAutoOrbit}
            onToggleAudio={handleToggleAudio}
            onTriggerAction={handleTriggerAction}
            onToggleCompare={handleToggleCompare}
            onToggleDock={handleToggleDock}
          />
        </section>

        {/* Act 9: Technical Dossier Inquiry + Quiet Editorial Footer */}
        <InquiryFooter
          onJumpTop={handleJumpTop}
          onOpenWorkbench={handleOpenWorkbenchIso}
        />
      </main>
    </div>
  );
}
