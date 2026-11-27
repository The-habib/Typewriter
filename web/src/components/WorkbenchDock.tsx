import { memo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Gauge,
  Layers,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CAMERA_PRESETS,
  type CameraPresetId,
  type FinishId,
  type KeycapLayoutMode,
  type KeycapViewMode,
  type PartMetadata,
} from '../mechanism/blueprint';
import { type AnimationMode } from '../mechanism/kinematics';

interface WorkbenchDockProps {
  activeCamera: CameraPresetId | null;
  explode: number;
  finish: FinishId;
  keycapMode: KeycapViewMode;
  keycapLayout: KeycapLayoutMode;
  animationMode: AnimationMode;
  speed: number;
  autoOrbit: boolean;
  audioEnabled: boolean;
  compareOverlay: boolean;
  dockExpanded: boolean;
  selectedPart: (PartMetadata & { instanceLabel?: string }) | null;
  onSelectCamera: (id: CameraPresetId) => void;
  onExplodeChange: (val: number) => void;
  onSelectFinish: (finish: FinishId) => void;
  onSelectKeycapMode: (mode: KeycapViewMode) => void;
  onToggleKeycapLayout: () => void;
  onSelectAnimationMode: (mode: AnimationMode) => void;
  onCycleSpeed: () => void;
  onToggleAutoOrbit: () => void;
  onToggleAudio: () => void;
  onTriggerAction: (action: 'space' | 'return' | 'shift' | 'backspace') => void;
  onToggleCompare: () => void;
  onToggleDock: () => void;
}

const FINISH_SWATCHES: Array<{ id: FinishId; label: string; swatch: string }> = [
  { id: 'gunmetal', label: 'Dark Steel', swatch: '#414145' },
  { id: 'steel', label: 'Raw Silver', swatch: '#b6bcc6' },
  { id: 'obsidian', label: 'Matte Black', swatch: '#262930' },
  { id: 'brass', label: 'Warm Brass', swatch: '#b89658' },
];

const KEYCAP_MODES: Array<{ id: KeycapViewMode; label: string }> = [
  { id: 'assembled', label: 'Full Keys' },
  { id: 'cutaway', label: 'Split X-Ray' },
  { id: 'mechanism', label: 'Inside View' },
];

const ANIMATION_MODES: Array<{ id: AnimationMode; label: string }> = [
  { id: 'typing', label: 'Live Typing' },
  { id: 'wave', label: 'Wave' },
  { id: 'springs', label: 'Springs' },
  { id: 'idle', label: 'Pause' },
];

const CONSOLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const WorkbenchDock = memo(function WorkbenchDock({
  activeCamera,
  explode,
  finish,
  keycapMode,
  keycapLayout,
  animationMode,
  speed,
  autoOrbit,
  audioEnabled,
  compareOverlay,
  dockExpanded,
  selectedPart,
  onSelectCamera,
  onExplodeChange,
  onSelectFinish,
  onSelectKeycapMode,
  onToggleKeycapLayout,
  onSelectAnimationMode,
  onCycleSpeed,
  onToggleAutoOrbit,
  onToggleAudio,
  onTriggerAction,
  onToggleCompare,
  onToggleDock,
}: WorkbenchDockProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none flex h-full w-full flex-col justify-between px-4 pb-5 pt-22 sm:px-8">
      {/* Top-corner machined registration caption + selected part readout */}
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-start justify-between gap-4">
        <div className="pointer-events-auto relative pl-3.5 pt-1">
          {/* Precision L-bracket corner registration tick */}
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 h-3.5 w-3.5 border-l-2 border-t-2 border-[#b51d29]"
          />
          <div className="flex items-center gap-2 text-[12px] text-[#3a4252]">
            <span className="font-mono font-semibold text-[#b51d29]">08</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#0d1017]">Play in 3D</span>
          </div>
          <p className="mt-0.5 text-[12px] font-medium text-[#374050]">
            Drag to spin · Scroll to zoom · Click any key (try 123 or ⌫) · Or type on your keyboard
          </p>
        </div>

        <AnimatePresence mode="wait">
          {selectedPart && (
            <motion.div
              key={selectedPart.instanceLabel ?? selectedPart.name}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
              transition={{ duration: 0.22, ease: CONSOLE_EASE }}
              aria-live="polite"
              className="pointer-events-auto relative pr-3.5 pt-1 text-right"
            >
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 h-3.5 w-3.5 border-r-2 border-t-2 border-[#0d1017]/55"
              />
              <div className="text-[13px] font-semibold text-[#0d1017]">
                {selectedPart.instanceLabel ?? selectedPart.name}
              </div>
              <div className="font-mono mt-0.5 text-[11px] font-medium text-[#374050]">
                {selectedPart.material} · {selectedPart.dimensionsMm}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Sculpted Chamfered Graphite Instrument Console with Trapezoidal Hood Latch */}
      <div className="pointer-events-auto mx-auto flex w-full max-w-[1180px] flex-col items-center">
        <button
          type="button"
          onClick={onToggleDock}
          aria-expanded={dockExpanded}
          aria-label={dockExpanded ? 'Hide workbench controls' : 'Show workbench controls'}
          className="chamfer-latch inline-flex items-center gap-1.5 bg-[#161922] px-6 py-1.5 text-[11.5px] font-medium text-slate-200 transition-colors duration-150 hover:bg-[#b51d29] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] cursor-pointer whitespace-nowrap"
        >
          {dockExpanded ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hide Controls</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Show Controls</span>
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {dockExpanded && (
            <motion.div
              key="workbench-console"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
              transition={{ duration: 0.28, ease: CONSOLE_EASE }}
              role="toolbar"
              aria-label="3D Mechanism workbench controls"
              className="chamfer-console relative flex w-full flex-col gap-2.5 border-t border-[#3b4356] bg-[#161922] px-5 py-3.5 text-slate-200 shadow-[0_18px_44px_rgba(10,14,22,0.38)]"
            >
              {/* Crimson center keyway accent line along top spine */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-[2px] w-20 -translate-x-1/2 bg-[#b51d29]"
              />

              {/* Row 1: Camera Presets + Keycap View Mode + 123/ABC + Orbit + Explode Slider */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div
                    role="group"
                    aria-label="Camera angles"
                    className="flex flex-wrap items-center gap-0.5 rounded-sm bg-[#0d1017] p-0.5"
                  >
                    {CAMERA_PRESETS.map((preset) => {
                      const isActive = activeCamera === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onSelectCamera(preset.id)}
                          aria-pressed={isActive}
                          className={`rounded-sm px-2.5 py-1.5 text-[11.5px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                            isActive
                              ? 'bg-[#e6eaf2] text-[#0d1017]'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    role="group"
                    aria-label="Keycap visualization mode"
                    className="flex flex-wrap items-center gap-0.5 rounded-sm bg-[#0d1017] p-0.5"
                  >
                    {KEYCAP_MODES.map((km) => {
                      const isActive = keycapMode === km.id;
                      return (
                        <button
                          key={km.id}
                          type="button"
                          onClick={() => onSelectKeycapMode(km.id)}
                          aria-pressed={isActive}
                          className={`rounded-sm px-2.5 py-1.5 text-[11.5px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                            isActive
                              ? 'bg-[#2a3040] text-white'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {km.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={onToggleKeycapLayout}
                    aria-pressed={keycapLayout === 'symbols'}
                    className={`rounded-sm border px-2.5 py-1.5 font-mono text-[11.5px] font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      keycapLayout === 'symbols'
                        ? 'border-[#b51d29] bg-[#b51d29] text-white'
                        : 'border-white/15 bg-[#1f2430] text-slate-100 hover:border-white/35'
                    }`}
                  >
                    {keycapLayout === 'qwerty' ? '123' : 'ABC'}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleAutoOrbit}
                    aria-pressed={autoOrbit}
                    className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      autoOrbit
                        ? 'border-[#e6eaf2] bg-[#e6eaf2] text-[#0d1017]'
                        : 'border-white/15 bg-[#1f2430] text-slate-200 hover:border-white/35 hover:text-white'
                    }`}
                  >
                    <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Orbit</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="workbench-explode-slider"
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-300 whitespace-nowrap"
                  >
                    <Layers className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>Explode</span>
                  </label>
                  <input
                    id="workbench-explode-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(explode * 100)}
                    onChange={(e) => onExplodeChange(Number(e.target.value) / 100)}
                    className="cad-slider w-20 sm:w-24"
                    aria-label="Exploded assembly elevation"
                  />
                  <span className="font-mono w-8 text-right text-[11.5px] text-slate-300">
                    {Math.round(explode * 100)}%
                  </span>
                </div>
              </div>

              {/* Row 2: Live Animation Modes + Speed + Manual Triggers + Finishes + Audio + Reference */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div
                    role="group"
                    aria-label="Real-time animation mode"
                    className="flex flex-wrap items-center gap-0.5 rounded-sm bg-[#0d1017] p-0.5"
                  >
                    {ANIMATION_MODES.map((m) => {
                      const isActive = animationMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelectAnimationMode(m.id)}
                          aria-pressed={isActive}
                          className={`rounded-sm px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                            isActive
                              ? 'bg-[#b51d29] text-white'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={onCycleSpeed}
                    aria-label={`Cycle animation speed, currently ${speed}x`}
                    className="inline-flex items-center gap-1 rounded-sm border border-white/15 bg-[#1f2430] px-2.5 py-1.5 font-mono text-[11.5px] font-medium text-slate-200 transition-colors duration-150 hover:border-white/35 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Gauge className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{speed}×</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTriggerAction('space')}
                    className="rounded-sm border border-white/15 bg-[#1f2430] px-2.5 py-1.5 text-[12px] font-medium text-slate-200 transition-colors duration-150 hover:border-white/35 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Space Bail
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerAction('return')}
                    className="rounded-sm border border-white/15 bg-[#1f2430] px-2.5 py-1.5 text-[12px] font-medium text-slate-200 transition-colors duration-150 hover:border-white/35 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Return ↵
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerAction('backspace')}
                    className="rounded-sm border border-[#b51d29]/60 bg-[#b51d29]/25 px-2.5 py-1.5 text-[12px] font-medium text-[#ff9aa2] transition-colors duration-150 hover:bg-[#b51d29] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    ⌫
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    role="group"
                    aria-label="Metallic finish"
                    className="flex items-center gap-1.5 pr-1"
                  >
                    {FINISH_SWATCHES.map((sw) => {
                      const active = finish === sw.id;
                      return (
                        <button
                          key={sw.id}
                          type="button"
                          onClick={() => onSelectFinish(sw.id)}
                          aria-label={`Finish: ${sw.label}`}
                          aria-pressed={active}
                          title={sw.label}
                          className={`h-5 w-5 rounded-full border transition-transform duration-150 cursor-pointer ${
                            active
                              ? 'scale-110 border-[#e6eaf2] ring-2 ring-[#b51d29]'
                              : 'border-white/30 hover:scale-105'
                          }`}
                          style={{ backgroundColor: sw.swatch }}
                        />
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={onToggleAudio}
                    aria-pressed={audioEnabled}
                    className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      audioEnabled
                        ? 'border-[#e6eaf2] bg-[#e6eaf2] text-[#0d1017]'
                        : 'border-white/15 bg-[#1f2430] text-slate-200 hover:border-white/35 hover:text-white'
                    }`}
                  >
                    {audioEnabled ? (
                      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Audio</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleCompare}
                    aria-pressed={compareOverlay}
                    className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      compareOverlay
                        ? 'border-[#e6eaf2] bg-[#e6eaf2] text-[#0d1017]'
                        : 'border-white/15 bg-[#1f2430] text-slate-200 hover:border-white/35 hover:text-white'
                    }`}
                  >
                    {compareOverlay ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Reference</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
