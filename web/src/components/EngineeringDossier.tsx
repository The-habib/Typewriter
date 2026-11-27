import { memo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Cpu, Keyboard, Smartphone, Volume2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type CameraPresetId, type FinishId } from '../mechanism/blueprint';

interface EngineeringDossierProps {
  finish: FinishId;
  onSelectFinish: (finish: FinishId) => void;
  onInspectSubsystem: (preset: CameraPresetId) => void;
}

interface SubsystemSpec {
  id: 'bars' | 'keys' | 'frame' | 'springs';
  index: string;
  shortName: string;
  name: string;
  subtitle: string;
  summary: string;
  dialAngle: number;
  specs: Array<{ label: string; value: string }>;
  preset: CameraPresetId;
}

const KINETIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING_DIAL = { type: 'spring' as const, stiffness: 260, damping: 24 };
const BASE = import.meta.env.BASE_URL;

const SUBSYSTEMS: readonly SubsystemSpec[] = [
  {
    id: 'bars',
    index: '01',
    shortName: 'Moving Bars',
    name: 'The 17 Moving Bars',
    subtitle: 'Parallel steel levers tucked inside rear slots',
    summary:
      'Every bar runs straight from the back comb to the key rows in front. Tap a key on Android or in 3D and its bar swings smoothly inside its recessed track with sympathetic tremor on adjacent levers.',
    dialAngle: 0,
    specs: [
      { label: 'Bars', value: '17 steel levers' },
      { label: 'Rear slots', value: '17 milled' },
      { label: 'Plunge / Return', value: '44 / 118 ms' },
    ],
    preset: 'comb',
  },
  {
    id: 'keys',
    index: '02',
    shortName: 'Round Keys',
    name: 'Round Keys & Guides',
    subtitle: 'Porcelain dishes framed in chrome rings',
    summary:
      'Twenty-six round typewriter keys sit in three stepped rows with Voronoi gap-tap forgiveness. Switch between Classic, Crystal X-Ray, and Blueprint views right from the keyboard menu or companion app.',
    dialAngle: 90,
    specs: [
      { label: 'Round caps', value: '26 keys' },
      { label: 'Input layers', value: 'ABC / 123 / #+=' },
      { label: 'Live views', value: 'Classic / Crystal / BP' },
    ],
    preset: 'iso',
  },
  {
    id: 'frame',
    index: '03',
    shortName: 'Pill Keys',
    name: 'Pill Modifiers & Gestures',
    subtitle: 'Shift, 123, Emoji, Space, Return & Crimson Backspace',
    summary:
      'Wide pill modifiers support chorded Shift or 123 drags, long-press accents, swipe-left on Backspace to delete whole words, and an integrated Emoji + 15-item Clipboard drawer.',
    dialAngle: 180,
    specs: [
      { label: 'Pill & mod keys', value: '6 modifiers' },
      { label: 'Highlight', value: 'Crimson ⌫' },
      { label: 'Swipe gesture', value: 'Word delete' },
    ],
    preset: 'side',
  },
  {
    id: 'springs',
    index: '04',
    shortName: 'Coil Springs',
    name: 'Twin Coil Springs & Trackpad',
    subtitle: 'Two 12-turn springs + Spacebar cursor scrubbing',
    summary:
      'Press the spacebar and both 12-turn springs stretch in sync with the bottom torsion bar. Hold and slide across the Spacebar in the Android IME to scrub your cursor cleanly character by character.',
    dialAngle: 270,
    specs: [
      { label: 'Springs', value: '2 × 12 turns' },
      { label: 'Trackpad', value: 'Slide cursor' },
      { label: 'Slow-Mo mode', value: '0.25× speed' },
    ],
    preset: 'springs',
  },
];

const FINISH_OPTIONS: ReadonlyArray<{
  id: FinishId;
  name: string;
  process: string;
  tag: string;
  tokenClass: string;
  dishBg: string;
  dishInk: string;
  glyph: string;
}> = [
  {
    id: 'gunmetal',
    name: 'Dark Steel',
    process: 'Brushed gunmetal body with soft satin light',
    tag: 'Default',
    tokenClass: 'metal-token-gunmetal',
    dishBg: '#e4e7ef',
    dishInk: '#14171f',
    glyph: 'G',
  },
  {
    id: 'steel',
    name: 'Raw Silver',
    process: 'Clean machined stainless with crisp edges',
    tag: 'Bright',
    tokenClass: 'metal-token-steel',
    dishBg: '#eff2f7',
    dishInk: '#14171f',
    glyph: 'S',
  },
  {
    id: 'obsidian',
    name: 'Matte Black',
    process: 'Deep charcoal coat for bold contrast',
    tag: 'Stealth',
    tokenClass: 'metal-token-obsidian',
    dishBg: '#dcdfe8',
    dishInk: '#0d1017',
    glyph: 'B',
  },
  {
    id: 'brass',
    name: 'Warm Brass',
    process: 'Classic golden metal with soft turned sheen',
    tag: 'Vintage',
    tokenClass: 'metal-token-brass',
    dishBg: '#f0ece1',
    dishInk: '#1e1912',
    glyph: 'W',
  },
];

const SPEC_ROWS: ReadonlyArray<{
  index: string;
  parameter: string;
  value: string;
  highlight: string;
  notes: string;
  indentClass: string;
}> = [
  {
    index: '01',
    parameter: 'Android Platform',
    value: 'Flutter + Kotlin IME',
    highlight: 'Native Service',
    notes: 'Full Android InputMethodService paired with a live Companion Settings App',
    indentClass: 'lg:ml-0 lg:mr-14',
  },
  {
    index: '02',
    parameter: 'Key Architecture',
    value: '32 Keys · 17 Bars',
    highlight: 'ABC / 123 / #+=',
    notes: '26 circular porcelain caps, 6 wide pills, and 17 CNC rear lever slots',
    indentClass: 'lg:ml-7 lg:mr-7',
  },
  {
    index: '03',
    parameter: 'Audio & Haptics',
    value: '7 WAVs · 3 Haptics',
    highlight: 'SoundPool',
    notes: 'Sampled mechanical ribbon strikes with pitch jitter + Off / Crisp / Heavy haptics',
    indentClass: 'lg:ml-14 lg:mr-0',
  },
  {
    index: '04',
    parameter: 'Smart Typing',
    value: '4,770-Word Corpus',
    highlight: '100% Offline',
    notes: '3-slot predictions, autocorrect undo, Spacebar trackpad, Emoji & Clipboard',
    indentClass: 'lg:ml-7 lg:mr-7',
  },
  {
    index: '05',
    parameter: 'Kinematics Engine',
    value: '44 / 46 / 118 ms',
    highlight: '0.25× Slow-Mo',
    notes: 'Real-time spring-damper physics across Classic, Crystal, and Blueprint modes',
    indentClass: 'lg:ml-0 lg:mr-14',
  },
  {
    index: '06',
    parameter: 'Open-Source Repo',
    value: 'MIT License',
    highlight: 'app/ + web/',
    notes: 'Android IME codebase and this Three.js 3D showcase maintained together on GitHub',
    indentClass: 'lg:ml-7 lg:mr-7',
  },
];

const ANDROID_CAPABILITIES = [
  {
    icon: Smartphone,
    title: 'System-Wide Android IME',
    detail: 'Works in every Android app via TypewriterInputMethodService, plus a guided 2-step Companion setup.',
  },
  {
    icon: Volume2,
    title: 'Low-Latency WAV Audio & Haptics',
    detail: 'Native SoundPool plays 7 sampled mechanical strikes with randomized pitch plus Crisp & Heavy vibration.',
  },
  {
    icon: Keyboard,
    title: '4,770-Word Smart Predictions',
    detail: 'Offline English corpus with 3-slot suggestions, typo autocorrect on Space, and instant Backspace undo.',
  },
  {
    icon: Cpu,
    title: 'Zero-Telemetry Privacy',
    detail: 'Every keystroke, learned word, and clipboard snippet stays strictly on-device with no network calls.',
  },
] as const;

const ANDROID_SCREENSHOTS = [
  {
    src: `${BASE}images/screenshots/companion-and-ime.png`,
    title: 'Companion App & Live Keyboard',
    caption: 'Tune mechanical audio volume, haptic weight, and test the live IME directly inside the companion app.',
  },
  {
    src: `${BASE}images/screenshots/ime-predictions.png`,
    title: '3-Slot Predictive Ribbon',
    caption: 'Real-time prefix matching and autocorrect suggestions anchored cleanly above the 17 milled slots.',
  },
  {
    src: `${BASE}images/screenshots/ime-dark-host.png`,
    title: 'System-Wide Dark Host Integration',
    caption: 'Porcelain enamel caps, chrome bezels, and crimson Backspace adapt cleanly inside any Android text field.',
  },
] as const;

/** Live vector mechanical diagram inside the center of the Interactive CAD Dial */
function CenterMechanismSchematic({
  subsystemId,
  reducedMotion,
}: {
  subsystemId: SubsystemSpec['id'];
  reducedMotion: boolean;
}) {
  if (subsystemId === 'bars') {
    return (
      <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => {
          const x = 22 + i * 12.6;
          return (
            <motion.rect
              key={i}
              x={x}
              y={24}
              width={5}
              height={72}
              rx={1.5}
              fill={i === 3 ? '#b51d29' : '#0d1017'}
              initial={reducedMotion ? false : { y: 36, opacity: 0.4 }}
              animate={
                reducedMotion
                  ? { y: 24, opacity: 1 }
                  : { y: [24, i % 2 === 0 ? 18 : 30, 24], opacity: 1 }
              }
              transition={{
                duration: 1.6,
                delay: i * 0.08,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          );
        })}
        <rect x="16" y="20" width="88" height="6" fill="#3a4354" rx="1" />
      </svg>
    );
  }

  if (subsystemId === 'keys') {
    return (
      <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
        <circle cx="60" cy="60" r="42" fill="none" stroke="#0d1017" strokeWidth="2" strokeDasharray="52 14" />
        <motion.circle
          cx="60"
          cy="60"
          r="30"
          fill="#e7eaf2"
          stroke="#0d1017"
          strokeWidth="3.5"
          animate={reducedMotion ? undefined : { scale: [1, 0.93, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '60px 60px' }}
        />
        <circle cx="60" cy="60" r="22" fill="none" stroke="#b51d29" strokeWidth="1.5" />
        <text
          x="60"
          y="66"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill="#0d1017"
          fontFamily="JetBrains Mono, monospace"
        >
          A
        </text>
      </svg>
    );
  }

  if (subsystemId === 'frame') {
    return (
      <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
        <rect x="14" y="28" width="92" height="24" rx="12" fill="#e7eaf2" stroke="#0d1017" strokeWidth="3" />
        <motion.rect
          x="36"
          y="64"
          width="70"
          height="26"
          rx="13"
          fill="#b51d29"
          stroke="#0d1017"
          strokeWidth="2.5"
          animate={reducedMotion ? undefined : { y: [64, 68, 64] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <path d="M 65 77 L 78 77 M 71 72 L 65 77 L 71 82" stroke="#ffffff" strokeWidth="2.2" fill="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden="true">
      <line x1="18" y1="60" x2="28" y2="60" stroke="#0d1017" strokeWidth="3" />
      <motion.path
        d="M 28 60 L 34 42 L 42 78 L 50 42 L 58 78 L 66 42 L 74 78 L 82 42 L 88 60"
        fill="none"
        stroke="#b51d29"
        strokeWidth="3"
        strokeLinejoin="round"
        animate={reducedMotion ? undefined : { scaleX: [1, 1.12, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '28px 60px' }}
      />
      <line x1="88" y1="60" x2="104" y2="60" stroke="#0d1017" strokeWidth="3" />
      <circle cx="20" cy="60" r="4" fill="#0d1017" />
      <circle cx="102" cy="60" r="4" fill="#0d1017" />
    </svg>
  );
}

export const EngineeringDossier = memo(function EngineeringDossier({
  finish,
  onSelectFinish,
  onInspectSubsystem,
}: EngineeringDossierProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activePart = SUBSYSTEMS[selectedIdx];

  return (
    <div className="relative z-20 bg-[#cfd4de]">
      {/* Sculpted 17-Notch Comb-Tooth Horizon Divider bridging the 3D viewport into the solid blueprint deck */}
      <div className="pointer-events-none relative -mt-8 h-8 w-full overflow-hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 40"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d="M 0 40 L 0 18 L 110 18 L 128 4 L 380 4 L 396 16 L 1044 16 L 1060 4 L 1312 4 L 1330 18 L 1440 18 L 1440 40 Z"
            fill="#cfd4de"
          />
          <path
            d="M 0 18 L 110 18 L 128 4 L 380 4 L 396 16 L 1044 16 L 1060 4 L 1312 4 L 1330 18 L 1440 18"
            fill="none"
            stroke="rgba(13, 16, 23, 0.2)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
          {/* 17 precision micro-notches carved across the center recessed span */}
          {Array.from({ length: 17 }, (_, i) => {
            const x = 440 + i * 35;
            return (
              <rect
                key={i}
                x={x}
                y="16"
                width="14"
                height="5"
                fill={i === 8 ? '#b51d29' : 'rgba(13, 16, 23, 0.16)'}
              />
            );
          })}
        </svg>
      </div>

      {/* Section 06 — Handcrafted Interactive Concentric CAD Dial + Chamfered Dark Specimen Plate */}
      <section
        id="anatomy"
        aria-labelledby="anatomy-heading"
        className="drafting-surface scroll-mt-20 mx-auto max-w-[1320px] px-6 py-20 md:px-10 lg:py-26"
      >
        <motion.div
          initial={prefersReducedMotion ? false : { y: 18, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5, ease: KINETIC_EASE }}
          className="grid grid-cols-1 gap-8 border-b border-slate-900/18 pb-10 lg:grid-cols-12 lg:items-end"
        >
          <div className="lg:col-span-7">
            <p className="text-[12.5px] font-medium text-[#374050]">
              <span className="font-mono font-semibold text-[#b51d29]">06</span>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span>Inside the Mechanism</span>
            </p>
            <h2
              id="anatomy-heading"
              className="font-display mt-3 text-[32px] font-semibold leading-[1.08] tracking-[-0.025em] text-[#0d1017] sm:text-[42px] [text-wrap:balance]"
            >
              Turn the dial to explore each moving part.
            </h2>
          </div>
          <p className="text-[15px] leading-[1.65] text-[#28303e] lg:col-span-5">
            Every key in Typewriter mirrors a physical mechanism—both inside the Android keyboard
            renderer and in this interactive 3D CAD assembly. Pick a subsystem to inspect it live.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left 5 cols: Handcrafted Concentric Mechanical Dial Selector */}
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.94, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.56, ease: KINETIC_EASE }}
            className="flex flex-col items-center lg:col-span-5"
          >
            <div className="relative flex h-[310px] w-[310px] items-center justify-center sm:h-[340px] sm:w-[340px]">
              {/* Engraved outer mechanical degree ring */}
              <svg
                aria-hidden="true"
                viewBox="0 0 340 340"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                <circle
                  cx="170"
                  cy="170"
                  r="156"
                  fill="#e3e7f0"
                  stroke="rgba(13, 16, 23, 0.2)"
                  strokeWidth="1.5"
                />
                <circle
                  cx="170"
                  cy="170"
                  r="118"
                  fill="none"
                  stroke="rgba(13, 16, 23, 0.14)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                {/* Crosshair quadrant dividers */}
                <line x1="170" y1="14" x2="170" y2="54" stroke="rgba(13,16,23,0.22)" strokeWidth="1" />
                <line x1="170" y1="286" x2="170" y2="326" stroke="rgba(13,16,23,0.22)" strokeWidth="1" />
                <line x1="14" y1="170" x2="54" y2="170" stroke="rgba(13,16,23,0.22)" strokeWidth="1" />
                <line x1="286" y1="170" x2="326" y2="170" stroke="rgba(13,16,23,0.22)" strokeWidth="1" />
              </svg>

              {/* Rotating Crimson Arc Needle synced via Spring Physics */}
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 340 340"
                animate={{ rotate: activePart.dialAngle }}
                transition={prefersReducedMotion ? { duration: 0 } : SPRING_DIAL}
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                <path
                  d="M 122 22 A 156 156 0 0 1 218 22"
                  fill="none"
                  stroke="#b51d29"
                  strokeWidth="4.5"
                  strokeLinecap="square"
                />
                <polygon points="170,4 164,15 176,15" fill="#b51d29" />
              </motion.svg>

              {/* Center Recessed Aperture Lens with Live Animated Vector Schematic */}
              <div className="relative z-10 flex h-[154px] w-[154px] flex-col items-center justify-center rounded-full border-2 border-[#0d1017]/20 bg-[#edf0f6] shadow-[inset_0_4px_12px_rgba(13,16,23,0.12)]">
                <motion.div
                  key={activePart.id}
                  initial={prefersReducedMotion ? false : { scale: 0.86, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ duration: 0.28, ease: KINETIC_EASE }}
                  className="flex items-center justify-center"
                >
                  <CenterMechanismSchematic
                    subsystemId={activePart.id}
                    reducedMotion={Boolean(prefersReducedMotion)}
                  />
                </motion.div>
              </div>

              {/* 4 Cardinal Interactive Dial Buttons (North 01, East 02, South 03, West 04) */}
              {[
                { idx: 0, pos: 'top-3 left-1/2 -translate-x-1/2' },
                { idx: 1, pos: 'right-2 top-1/2 -translate-y-1/2' },
                { idx: 2, pos: 'bottom-3 left-1/2 -translate-x-1/2' },
                { idx: 3, pos: 'left-2 top-1/2 -translate-y-1/2' },
              ].map(({ idx, pos }) => {
                const sub = SUBSYSTEMS[idx];
                const isSelected = selectedIdx === idx;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls={`specimen-${sub.id}`}
                    onClick={() => setSelectedIdx(idx)}
                    className={`chamfer-btn absolute z-20 flex flex-col items-center justify-center px-3 py-1.5 text-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] cursor-pointer ${pos} ${
                      isSelected
                        ? 'bg-[#14171f] text-[#f3f5f9]'
                        : 'bg-[#cfd4de] text-[#0d1017] hover:bg-[#b51d29] hover:text-white'
                    }`}
                  >
                    <span
                      className={`font-mono text-[10px] font-semibold ${
                        isSelected ? 'text-[#ff7f8a]' : 'text-[#b51d29]'
                      }`}
                    >
                      {sub.index}
                    </span>
                    <span className="text-[11px] font-semibold whitespace-nowrap">
                      {sub.shortName}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Secondary accessible horizontal index bar directly synced with the dial */}
            <div
              role="tablist"
              aria-label="Keyboard mechanism parts"
              className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-1.5"
            >
              {SUBSYSTEMS.map((sub, idx) => {
                const active = selectedIdx === idx;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedIdx(idx)}
                    className={`px-2 py-1 font-mono text-[11px] font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                      active
                        ? 'border-b-2 border-[#b51d29] text-[#0d1017]'
                        : 'border-b-2 border-transparent text-[#4b5568] hover:text-[#0d1017]'
                    }`}
                  >
                    {sub.index}·{sub.shortName}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Right 7 cols: Dramatic Dark Anodized Chamfered Octagonal Specimen Plate */}
          <div className="lg:col-span-7">
            <div
              id={`specimen-${activePart.id}`}
              role="tabpanel"
              className="chamfer-plate relative min-h-[370px] bg-[#161a23] p-8 text-[#eef1f7] shadow-[0_24px_48px_rgba(13,16,23,0.22)] sm:p-10"
            >
              {/* Machined top crimson keybar accent strip */}
              <span
                aria-hidden="true"
                className="absolute left-8 top-0 h-[3px] w-24 bg-[#b51d29]"
              />

              <motion.div
                key={activePart.id}
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: KINETIC_EASE }}
                className="flex h-full flex-col justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/12 pb-5">
                    <div className="flex items-center gap-2.5 text-[12.5px]">
                      <span className="font-mono font-semibold text-[#ff7f8a]">
                        Part {activePart.index} of 04
                      </span>
                      <span className="text-slate-500" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-300">{activePart.subtitle}</span>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => onInspectSubsystem(activePart.preset)}
                      whileTap={prefersReducedMotion ? undefined : { y: 1.5 }}
                      className="chamfer-btn inline-flex items-center gap-1.5 bg-[#b51d29] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-[#f0f3f8] hover:text-[#0d1017] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7f8a] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>See in 3D</span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </motion.button>
                  </div>

                  <h3 className="font-display mt-6 text-[28px] font-semibold leading-[1.12] tracking-[-0.02em] text-white sm:text-[34px]">
                    {activePart.name}
                  </h3>

                  <p className="mt-4 max-w-[56ch] text-[15px] leading-[1.7] text-slate-300">
                    {activePart.summary}
                  </p>
                </div>

                {/* Stepped bottom metrics rack inside the dark specimen plate */}
                <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-white/12 pt-6">
                  {activePart.specs.map((spec, idx) => (
                    <motion.div
                      key={spec.label}
                      initial={prefersReducedMotion ? false : { y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.06 + idx * 0.04, ease: KINETIC_EASE }}
                    >
                      <dt className="text-[11px] font-medium text-slate-400">{spec.label}</dt>
                      <dd className="font-mono mt-1 text-[14.5px] font-semibold text-white">
                        {spec.value}
                      </dd>
                    </motion.div>
                  ))}
                </dl>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Angled Diagonal Chamfer Horizon bridging Section 06 into Section 07 */}
      <div className="pointer-events-none relative h-10 w-full overflow-hidden bg-[#cfd4de]">
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 44"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d="M 0 44 L 0 8 L 620 8 L 664 34 L 1440 34 L 1440 44 Z"
            fill="#dfe3ec"
          />
          <path
            d="M 0 8 L 620 8 L 664 34 L 1440 34"
            fill="none"
            stroke="rgba(13, 16, 23, 0.16)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Section 07 — Android App Showcase, Metal Finishes & Stepped Specifications */}
      <section
        id="specifications"
        aria-labelledby="specs-heading"
        className="scroll-mt-20 bg-[#dfe3ec]"
      >
        <div className="mx-auto max-w-[1320px] px-6 py-20 md:px-10 lg:py-26">
          {/* Top Band: 4 Handcrafted Physical Brushed-Metal Keycap Finish Tokens */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-6">
              <p className="text-[12.5px] font-medium text-[#374050]">
                <span className="font-mono font-semibold text-[#b51d29]">07</span>
                <span className="mx-2" aria-hidden="true">
                  /
                </span>
                <span>Android IME &amp; Finishes</span>
              </p>
              <h2
                id="specs-heading"
                className="font-display mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#0d1017] sm:text-[38px] [text-wrap:balance]"
              >
                Built as a real Android keyboard.
              </h2>
            </div>
            <p className="text-[14.5px] leading-[1.65] text-[#28303e] lg:col-span-6">
              Typewriter isn’t only a 3D demo—it runs natively as your everyday Android system
              keyboard (<code className="font-mono text-[13px] font-medium text-[#0d1017]">InputMethodService</code>) with a Companion App. Preview metal finishes in 3D
              below or inspect the live Android screenshots.
            </p>
          </div>

          {/* Interactive 4-Finish Selector */}
          <div
            role="radiogroup"
            aria-label="Keyboard metal finish"
            className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {FINISH_OPTIONS.map((opt, idx) => {
              const selected = finish === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelectFinish(opt.id)}
                  initial={prefersReducedMotion ? false : { y: 14, opacity: 0.85 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.36, delay: idx * 0.04, ease: KINETIC_EASE }}
                  whileTap={prefersReducedMotion ? undefined : { y: 2 }}
                  className={`chamfer-card group relative flex flex-col items-start justify-between p-6 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] cursor-pointer ${
                    selected
                      ? 'bg-[#161a23] text-white'
                      : 'bg-[#eef1f7] text-[#0d1017] hover:bg-[#e5e9f3]'
                  }`}
                >
                  {/* Animated Crimson Selection Indicator Bar */}
                  {selected && (
                    <motion.span
                      layoutId="finish-active-bar"
                      transition={prefersReducedMotion ? { duration: 0 } : SPRING_DIAL}
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-[3px] bg-[#b51d29]"
                    />
                  )}

                  {/* Sculpted Physical Round Keycap Medallion */}
                  <div className="flex w-full items-center justify-between">
                    <div
                      aria-hidden="true"
                      className={`relative flex h-14 w-14 items-center justify-center rounded-full p-[5px] shadow-[0_6px_14px_rgba(13,16,23,0.28)] ${opt.tokenClass}`}
                    >
                      <span
                        className="flex h-full w-full items-center justify-center rounded-full font-mono text-[15px] font-bold shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)]"
                        style={{ backgroundColor: opt.dishBg, color: opt.dishInk }}
                      >
                        {opt.glyph}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        selected ? 'text-[#ff7f8a]' : 'text-[#4f586b]'
                      }`}
                    >
                      {selected ? 'Active' : opt.tag}
                    </span>
                  </div>

                  <div className="mt-5">
                    <div className="font-display text-[18px] font-semibold">{opt.name}</div>
                    <p
                      className={`mt-1 text-[12.5px] leading-[1.5] ${
                        selected ? 'text-slate-300' : 'text-[#434c5e]'
                      }`}
                    >
                      {opt.process}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Android App Capabilities & Real Device Screenshots */}
          <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5">
              {ANDROID_CAPABILITIES.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="chamfer-card flex flex-col justify-between border border-slate-900/12 bg-[#eef1f7] p-5"
                  >
                    <div>
                      <div className="inline-flex h-9 w-9 items-center justify-center bg-[#14171f] text-[#ff7f8a]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <h3 className="font-display mt-3.5 text-[16px] font-semibold text-[#0d1017]">
                        {cap.title}
                      </h3>
                      <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#3a4354]">
                        {cap.detail}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="chamfer-card border border-slate-900/14 bg-[#161a23] p-5 text-slate-200 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#ff7f8a]">
                    Full Keyboard Feature Set
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Flutter 3 · Kotlin · Android IME
                  </span>
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-2 text-[12.5px] text-slate-300 sm:grid-cols-2">
                  {[
                    'Spacebar cursor trackpad & double-space period',
                    'Swipe-left on Backspace to delete whole words',
                    'Chorded Shift & 123 drag + long-press accents',
                    'Categorized Emoji drawer & 15-item Clipboard',
                    'Integrated Android Voice Recognition input',
                    'Classic, Crystal X-Ray & Blueprint views',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff7f8a]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:col-span-7">
              {ANDROID_SCREENSHOTS.map((shot) => (
                <figure
                  key={shot.title}
                  className="chamfer-card flex flex-col overflow-hidden border border-slate-900/14 bg-[#eef1f7] p-3"
                >
                  <div className="overflow-hidden rounded-lg border border-slate-900/12 bg-[#14171f]">
                    <img
                      src={shot.src}
                      alt={shot.title}
                      loading="lazy"
                      className="aspect-[9/19.5] w-full object-cover object-top"
                    />
                  </div>
                  <figcaption className="mt-3 px-1 pb-1">
                    <div className="font-display text-[13.5px] font-semibold text-[#0d1017]">
                      {shot.title}
                    </div>
                    <p className="mt-1 text-[11.5px] leading-[1.45] text-[#434c5e]">
                      {shot.caption}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          {/* Bottom Band: Stepped Architectural Caliper Spec Strips (Zero standard HTML table) */}
          <div className="mt-16">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-900/20 pb-3">
              <h3 className="font-display text-[18px] font-semibold text-[#0d1017]">
                Typewriter Technical Specifications
              </h3>
              <span className="font-mono text-[12px] font-medium text-[#3b4455]">
                v1.0.0 · Android IME + 3D Studio
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {SPEC_ROWS.map((row, idx) => (
                <motion.div
                  key={row.parameter}
                  initial={prefersReducedMotion ? false : { x: -24, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.42, delay: idx * 0.05, ease: KINETIC_EASE }}
                  className={`flex flex-col justify-between gap-3 border border-slate-900/14 bg-[#eef1f7] pl-5 sm:flex-row sm:items-center ${row.indentClass}`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-3.5 pr-4">
                    <span className="font-mono text-[11.5px] font-semibold text-[#b51d29]">
                      {row.index}
                    </span>
                    <span className="w-36 text-[14.5px] font-semibold text-[#0d1017]">
                      {row.parameter}
                    </span>
                    <span className="text-[13px] text-[#3a4354]">{row.notes}</span>
                  </div>

                  {/* Right-anchored 45° chamfered caliper value cap */}
                  <div className="chamfer-spec-tab flex shrink-0 items-center justify-between gap-4 bg-[#161a23] py-3.5 pl-7 pr-5 text-white sm:min-w-[260px]">
                    <span className="font-mono text-[13.5px] font-semibold whitespace-nowrap">
                      {row.value}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#ff7f8a] whitespace-nowrap">
                      {row.highlight}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});
