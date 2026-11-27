import { memo, useState } from 'react';
import { ArrowUp, ArrowUpRight, Check, Copy, Download, Github, Terminal } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface InquiryFooterProps {
  onJumpTop: () => void;
  onOpenWorkbench: () => void;
}

interface ReleasePack {
  id: 'android' | 'monorepo' | 'web3d';
  label: string;
  formats: string;
  size: string;
  summary: string;
  directory: string;
  commands: readonly string[];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  highlights: readonly string[];
}

const REPO_URL = 'https://github.com/The-habib/Typewriter';
const RELEASES_URL = `${REPO_URL}/releases`;
const ISSUES_URL = `${REPO_URL}/issues`;
const LOGO_URL = `${import.meta.env.BASE_URL}images/typewriter_logo.png`;

const RELEASE_PACKS: readonly ReleasePack[] = [
  {
    id: 'android',
    label: 'Android Keyboard & Companion App',
    formats: 'Flutter · Kotlin IME · APK',
    size: 'app/ · v1.0.0',
    summary:
      'Installable Android InputMethodService + Companion settings app with 7 sampled WAV strikes, 4,770-word prediction, and 3 mechanism views.',
    directory: 'app/',
    commands: [
      'git clone https://github.com/The-habib/Typewriter.git',
      'cd Typewriter/app && flutter pub get && flutter build apk --release',
    ],
    primaryLabel: 'Download APK Releases',
    primaryHref: RELEASES_URL,
    secondaryLabel: 'Browse app/ on GitHub',
    secondaryHref: `${REPO_URL}/tree/main/app`,
    highlights: [
      'Native Android TypewriterInputMethodService + Voice & Clipboard bridge',
      'Companion App for 2-step setup, audio/haptics tuning & live test pad',
      'Automated Flutter analyze, widget tests & APK CI builds on every push',
    ],
  },
  {
    id: 'monorepo',
    label: 'Full Open-Source Monorepo',
    formats: 'app/ + web/ + docs/',
    size: 'MIT License',
    summary:
      'Both the Android keyboard application and this interactive 3D landing page live together in one unified GitHub repository.',
    directory: './',
    commands: [
      'git clone https://github.com/The-habib/Typewriter.git',
      'cd Typewriter && ls app web docs',
    ],
    primaryLabel: 'Star & Clone on GitHub',
    primaryHref: REPO_URL,
    secondaryLabel: 'Read Contributing Guide',
    secondaryHref: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
    highlights: [
      'Single MIT-licensed repository housing Flutter/Kotlin app + React/Three.js site',
      'GitHub Actions CI for Flutter tests, Web TypeScript/3D checks & Pages deploy',
      'Issue templates, PR checklist, Dependabot & security policy included',
    ],
  },
  {
    id: 'web3d',
    label: '3D Mechanism & Shader Showcase',
    formats: 'Three.js · GLSL · React 19',
    size: 'web/ · Vite',
    summary:
      'The scroll-driven 3D CAD stage, anisotropic chrome & porcelain enamel GLSL shaders, dynamic SDF shadows, and 2nd-order spring kinematics.',
    directory: 'web/',
    commands: [
      'git clone https://github.com/The-habib/Typewriter.git',
      'cd Typewriter/web && npm install && npm run dev',
    ],
    primaryLabel: 'Browse web/ on GitHub',
    primaryHref: `${REPO_URL}/tree/main/web`,
    secondaryLabel: 'Report a Bug / Suggest Feature',
    secondaryHref: ISSUES_URL,
    highlights: [
      'Custom GLSL chrome bezel, concave porcelain & 32-key SDF shadow shaders',
      'Real-time 2nd-order symplectic spring-damper solver + hybrid WAV audio',
      'Zero-dependency WebGL workbench with 5 camera presets & 6-layer explode',
    ],
  },
];

const KINETIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING_TAB = { type: 'spring' as const, stiffness: 400, damping: 32 };

export const InquiryFooter = memo(function InquiryFooter({
  onJumpTop,
  onOpenWorkbench,
}: InquiryFooterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<ReleasePack['id']>('android');
  const [copied, setCopied] = useState(false);

  const activePack = RELEASE_PACKS.find((p) => p.id === selectedId) ?? RELEASE_PACKS[0];
  const commandText = activePack.commands.join('\n');

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(commandText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative z-20 flex min-h-[calc(100vh-56px)] flex-col justify-between bg-[#d2d7e0]">
      {/* Angled Chamfer Horizon entering Section 09 from the 3D Workbench */}
      <div className="pointer-events-none relative -mt-8 h-8 w-full overflow-hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 36"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <path
            d="M 0 36 L 0 22 L 260 22 L 296 4 L 1144 4 L 1180 22 L 1440 22 L 1440 36 Z"
            fill="#d2d7e0"
          />
          <path
            d="M 0 22 L 260 22 L 296 4 L 1144 4 L 1180 22 L 1440 22"
            fill="none"
            stroke="rgba(13, 16, 23, 0.18)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Section 09 — Open-Source Repository & Release Dispatch */}
      <section
        id="inquiry"
        aria-labelledby="inquiry-heading"
        className="drafting-surface scroll-mt-20 mx-auto my-auto w-full max-w-[1320px] px-6 py-20 md:px-10 lg:py-24"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
          {/* Left 5 cols: Interactive 3-Track Open-Source Selector Stack */}
          <motion.div
            initial={prefersReducedMotion ? false : { y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.48, ease: KINETIC_EASE }}
            className="lg:col-span-5"
          >
            <p className="text-[12.5px] font-medium text-[#374050]">
              <span className="font-mono font-semibold text-[#b51d29]">09</span>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span>Open Source &amp; Downloads</span>
            </p>
            <h2
              id="inquiry-heading"
              className="font-display mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#0d1017] sm:text-[38px] [text-wrap:balance]"
            >
              Get Typewriter or build it from source.
            </h2>
            <p className="mt-4 text-[14.5px] leading-[1.65] text-[#28303e]">
              Both the Android keyboard application and this 3D showcase live together in one open
              MIT-licensed GitHub repository. Select a track to inspect commands and download links.
            </p>

            {/* Interactive 3-Tab Mechanical Pack Selector */}
            <div
              role="radiogroup"
              aria-label="Open-source repository tracks"
              className="mt-7 space-y-2.5"
            >
              {RELEASE_PACKS.map((pack, idx) => {
                const selected = selectedId === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setSelectedId(pack.id);
                      setCopied(false);
                    }}
                    className={`chamfer-card relative block w-full p-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] cursor-pointer ${
                      selected
                        ? 'bg-[#161a23] text-white'
                        : 'bg-[#e6eaf2] text-[#0d1017] hover:bg-[#edf0f7]'
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="pack-active-bar"
                        transition={prefersReducedMotion ? { duration: 0 } : SPRING_TAB}
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-[3px] bg-[#b51d29]"
                      />
                    )}
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-[15.5px] font-semibold">
                        <span
                          className={`font-mono mr-2 text-[11.5px] ${
                            selected ? 'text-[#ff7f8a]' : 'text-[#b51d29]'
                          }`}
                        >
                          0{idx + 1}
                        </span>
                        {pack.label}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-medium whitespace-nowrap ${
                          selected ? 'text-slate-300' : 'text-[#434c5e]'
                        }`}
                      >
                        {pack.size}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-[12.5px] leading-[1.5] ${
                        selected ? 'text-slate-300' : 'text-[#3a4354]'
                      }`}
                    >
                      {pack.summary}
                    </p>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Right 7 cols: Chamfered Machined Dispatch Plate with Real GitHub & Clone Actions */}
          <motion.div
            initial={prefersReducedMotion ? false : { y: 22, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.48, delay: 0.08, ease: KINETIC_EASE }}
            className="lg:col-span-7"
          >
            <div className="chamfer-plate relative bg-[#e9edf5] p-7 shadow-[0_20px_42px_rgba(13,16,23,0.12)] sm:p-9">
              {/* Engraved crimson dispatch notch on top edge */}
              <span
                aria-hidden="true"
                className="absolute left-8 top-0 h-[3px] w-20 bg-[#b51d29]"
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activePack.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: KINETIC_EASE }}
                >
                  {/* Live summary ribbon of the chosen bundle */}
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-900/14 pb-4">
                    <div>
                      <div className="font-mono text-[11px] font-semibold text-[#b51d29]">
                        Repository Path · {activePack.directory}
                      </div>
                      <div className="font-display text-[19px] font-semibold text-[#0d1017]">
                        {activePack.label}
                      </div>
                    </div>
                    <span className="font-mono text-[12px] font-medium text-[#374050]">
                      {activePack.formats}
                    </span>
                  </div>

                  {/* Included Highlights */}
                  <ul className="space-y-2.5 text-[13.5px] leading-[1.55] text-[#28303e]">
                    {activePack.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#b51d29]"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Copyable Terminal Block */}
                  <div className="mt-6 border border-slate-900/15 bg-[#14171f] p-4 text-[#e8ecf4]">
                    <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                        <Terminal className="h-3.5 w-3.5 text-[#ff7f8a]" aria-hidden="true" />
                        <span>Quick Start</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCommand}
                        className="inline-flex items-center gap-1 rounded-sm border border-white/15 bg-[#1f2430] px-2.5 py-1 font-mono text-[11px] text-slate-200 transition-colors hover:border-white/35 hover:text-white cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" aria-hidden="true" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="overflow-x-auto font-mono text-[12px] leading-[1.6] text-slate-200">
                      <code>{commandText}</code>
                    </pre>
                  </div>

                  {/* Direct Action Buttons */}
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                    <span className="font-mono text-[11.5px] font-medium text-[#3f4859]">
                      MIT License · Free &amp; Open Source
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={activePack.secondaryHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chamfer-btn inline-flex items-center gap-1.5 bg-[#d5dbe6] px-4 py-2.5 text-[13px] font-medium text-[#0d1017] transition-colors duration-150 hover:bg-[#c6cddb] whitespace-nowrap"
                      >
                        <Github className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{activePack.secondaryLabel}</span>
                      </a>
                      <a
                        href={activePack.primaryHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chamfer-btn inline-flex items-center gap-2 bg-[#14171f] px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors duration-150 hover:bg-[#b51d29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] whitespace-nowrap"
                      >
                        {activePack.id === 'android' ? (
                          <Download className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{activePack.primaryLabel}</span>
                      </a>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Uniquely Sculpted Architectural Chassis Baseplate Footer with 17-Notch Crest & Real Keycap Return Button */}
      <footer className="relative bg-[#14171f] text-[#e8ecf4]">
        {/* Sculpted Double-Chamfered 17-Notch Comb Crest crowning the dark baseplate */}
        <div className="pointer-events-none relative -mt-10 h-10 w-full overflow-hidden">
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 44"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <path
              d="M 0 44 L 0 22 L 160 22 L 192 4 L 1248 4 L 1280 22 L 1440 22 L 1440 44 Z"
              fill="#14171f"
            />
            <path
              d="M 0 22 L 160 22 L 192 4 L 1248 4 L 1280 22 L 1440 22"
              fill="none"
              stroke="rgba(255, 255, 255, 0.14)"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
            {/* 17 precision machined comb notches along the footer crown */}
            {Array.from({ length: 17 }, (_, i) => {
              const x = 350 + i * 44;
              return (
                <rect
                  key={i}
                  x={x}
                  y="4"
                  width="18"
                  height="6"
                  fill={i === 8 ? '#b51d29' : '#2a3040'}
                />
              );
            })}
          </svg>
        </div>

        <div className="mx-auto max-w-[1320px] px-6 pb-12 pt-8 md:px-10">
          <div className="grid grid-cols-1 items-end gap-8 border-b border-white/12 pb-8 md:grid-cols-12">
            {/* Left Signature Block with Official Logo */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3.5">
                <img
                  src={LOGO_URL}
                  alt="Typewriter logo"
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/20 shadow-md"
                />
                <div className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-white sm:text-[38px]">
                  Typewriter
                </div>
              </div>
              <p className="mt-3 text-[13.5px] leading-[1.6] text-slate-300">
                Open-source Android mechanical keyboard &amp; interactive 3D showcase · 32 keys, 17
                steel bars, real sampled WAV strikes.
              </p>
            </div>

            {/* Center Handcrafted Navigation Strip */}
            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 text-[13.5px] font-medium text-slate-300 md:col-span-5 md:justify-center">
              <a
                href="#chapter-comb"
                className="transition-colors duration-150 hover:text-white whitespace-nowrap"
              >
                Story
              </a>
              <a
                href="#anatomy"
                className="transition-colors duration-150 hover:text-white whitespace-nowrap"
              >
                Parts
              </a>
              <a
                href="#specifications"
                className="transition-colors duration-150 hover:text-white whitespace-nowrap"
              >
                Android App
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors duration-150 hover:text-white whitespace-nowrap"
              >
                GitHub
              </a>
              <button
                type="button"
                onClick={onOpenWorkbench}
                className="font-semibold text-[#ff7f8a] transition-colors duration-150 hover:text-white cursor-pointer whitespace-nowrap"
              >
                Try 3D View
              </button>
            </div>

            {/* Right Tactile Physical Typewriter-Key "Back to Top" Button */}
            <div className="flex items-center md:col-span-2 md:justify-end">
              <motion.button
                type="button"
                onClick={onJumpTop}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                whileTap={prefersReducedMotion ? undefined : { y: 3, scale: 0.96 }}
                aria-label="Back to top"
                className="metal-token-steel group flex h-14 w-14 items-center justify-center rounded-full p-[5px] shadow-[0_8px_20px_rgba(0,0,0,0.45)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b51d29] cursor-pointer"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#eef1f7] text-[#0d1017] shadow-[inset_0_2px_4px_rgba(0,0,0,0.22)] transition-colors duration-150 group-hover:bg-[#b51d29] group-hover:text-white">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </span>
              </motion.button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-[12px] text-slate-400">
            <span>MIT License · Built by Habib · Open Source on GitHub</span>
            <span className="font-mono">32 Keys · 17 Steel Bars · 7 WAV Strikes</span>
          </div>
        </div>
      </footer>
    </div>
  );
});
