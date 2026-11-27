import { memo, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { type KeycapLayoutMode, type KeycapViewMode } from '../mechanism/blueprint';
import {
  SCROLL_CHAPTERS,
  computeChapterPresence,
} from '../mechanism/scrollChoreography';

export interface ScrollStoryOverlayHandle {
  syncScrollProgress: (rawProgress: number) => void;
}

interface ScrollStoryOverlayProps {
  activeChapter: number;
  visibleChapter: number;
  inStoryTrack: boolean;
  keycapMode: KeycapViewMode;
  keycapLayout: KeycapLayoutMode;
  overlayRef: MutableRefObject<ScrollStoryOverlayHandle | null>;
  onSelectKeycapMode: (mode: KeycapViewMode) => void;
  onToggleKeycapLayout: () => void;
  onJumpToChapter: (chapterId: string) => void;
  onOpenWorkbench: () => void;
}

const HERO_KEYCAP_MODES: Array<{ id: KeycapViewMode; label: string }> = [
  { id: 'assembled', label: 'Full Keys' },
  { id: 'cutaway', label: 'Split X-Ray' },
  { id: 'mechanism', label: 'Inside View' },
];

const VERNIER_TICKS = Array.from({ length: 17 }, (_, i) => i);
const KINETIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING_SWITCH = { type: 'spring' as const, stiffness: 440, damping: 32 };

/**
 * Gives each of the 5 chapters its own physical motion signature mirroring the 3D part shown:
 * 0: Vertical curtain lift | 1: Horizontal keybar glide | 2: Concentric optical lock
 * 3: Twin-spring elastic bounce | 4: 6-tier vertical strata elevation
 */
function getChapterLineMotion(chapterIdx: number, lineIdx: number, isRight: boolean) {
  switch (chapterIdx) {
    case 1:
      return {
        initial: { x: isRight ? 42 : -42, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        transition: { duration: 0.48, delay: 0.06 + lineIdx * 0.06, ease: KINETIC_EASE },
      };
    case 2:
      return {
        initial: { y: '92%', scale: 0.96, opacity: 0 },
        animate: { y: '0%', scale: 1, opacity: 1 },
        transition: { duration: 0.52, delay: 0.06 + lineIdx * 0.055, ease: KINETIC_EASE },
      };
    case 3:
      return {
        initial: { y: 26, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: {
          type: 'spring' as const,
          stiffness: 270,
          damping: 19,
          delay: 0.05 + lineIdx * 0.065,
        },
      };
    case 4:
      return {
        initial: { y: 34 + lineIdx * 10, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.56, delay: 0.05 + lineIdx * 0.08, ease: KINETIC_EASE },
      };
    default:
      return {
        initial: { y: '108%', opacity: 0.2 },
        animate: { y: '0%', opacity: 1 },
        transition: { duration: 0.56, delay: 0.07 + lineIdx * 0.065, ease: KINETIC_EASE },
      };
  }
}

export const ScrollStoryOverlay = memo(function ScrollStoryOverlay({
  activeChapter,
  visibleChapter,
  inStoryTrack,
  keycapMode,
  keycapLayout,
  overlayRef,
  onSelectKeycapMode,
  onToggleKeycapLayout,
  onJumpToChapter,
  onOpenWorkbench,
}: ScrollStoryOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const prefersReducedMotionRef = useRef(Boolean(prefersReducedMotion));
  prefersReducedMotionRef.current = Boolean(prefersReducedMotion);

  const latestProgressRef = useRef(0);
  const vernierFillRef = useRef<HTMLDivElement | null>(null);
  const stageCardWrapperRef = useRef<HTMLDivElement | null>(null);
  const heroHintRef = useRef<HTMLDivElement | null>(null);

  const currentChapter = visibleChapter >= 0 ? SCROLL_CHAPTERS[visibleChapter] : null;
  const isHero = visibleChapter === 0;
  const isRight = currentChapter?.align === 'right';
  const railChapter = SCROLL_CHAPTERS[activeChapter] ?? SCROLL_CHAPTERS[0];

  const applyDirectScrollStyles = (rawProgress: number) => {
    latestProgressRef.current = rawProgress;
    const reduced = prefersReducedMotionRef.current;

    if (vernierFillRef.current) {
      vernierFillRef.current.style.transform = `scaleY(${Math.max(0.06, rawProgress).toFixed(4)})`;
    }

    const { activeIndex, presence, localOffset } = computeChapterPresence(rawProgress);
    const chapter = activeIndex >= 0 ? SCROLL_CHAPTERS[activeIndex] : null;
    const alignRight = chapter?.align === 'right';

    if (stageCardWrapperRef.current) {
      const marginDriftX = reduced ? 0 : (1 - presence) * (alignRight ? 28 : -28);
      const verticalParallaxY = reduced ? 0 : -localOffset * 14;
      stageCardWrapperRef.current.style.opacity = chapter ? presence.toFixed(4) : '0';
      stageCardWrapperRef.current.style.transform = `translate3d(${marginDriftX.toFixed(2)}px, ${verticalParallaxY.toFixed(2)}px, 0)`;
      stageCardWrapperRef.current.style.pointerEvents =
        chapter && presence > 0.35 ? 'auto' : 'none';
    }

    if (heroHintRef.current) {
      const heroHintOpacity = Math.max(0, 1 - rawProgress / 0.085);
      heroHintRef.current.style.opacity = heroHintOpacity.toFixed(4);
      heroHintRef.current.style.transform = `translate3d(0, ${((1 - heroHintOpacity) * 10).toFixed(2)}px, 0)`;
    }
  };

  useLayoutEffect(() => {
    overlayRef.current = {
      syncScrollProgress: applyDirectScrollStyles,
    };
    applyDirectScrollStyles(latestProgressRef.current);
    return () => {
      overlayRef.current = null;
    };
  }, [overlayRef, visibleChapter, prefersReducedMotion]);

  return (
    <section
      id="top"
      aria-label="Scroll-driven keyboard story"
      className="relative z-10 h-[500vh] pointer-events-none"
    >
      {/* Exact scroll-stop anchors mapped to rawProgress = 0.00, 0.25, 0.50, 0.75, 1.00 */}
      {SCROLL_CHAPTERS.map((chapter) => (
        <div
          key={chapter.id}
          id={chapter.id}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 h-px w-px"
          style={{ top: `${chapter.stop * 400}vh` }}
        />
      ))}

      {/* Right-edge 17-Tick Vernier Mechanical Scale Rail with Odometer Counter */}
      <aside
        aria-label="Story chapters"
        className={`fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-3 transition-opacity duration-200 xl:flex ${
          inStoryTrack ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#2e3545]">
          <div className="relative h-4 w-5 overflow-hidden text-right">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={railChapter.index}
                initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { y: -12, opacity: 0 }}
                transition={{ duration: 0.26, ease: KINETIC_EASE }}
                className="block text-[#b51d29]"
              >
                {railChapter.index}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="text-[#596275]">/ 05</span>
        </div>

        {/* 17-tick precision Vernier gauge echoing the 17 steel keybars */}
        <div className="relative flex h-36 items-center justify-end pr-0.5">
          <div className="flex h-full flex-col justify-between items-end">
            {VERNIER_TICKS.map((tick) => {
              const major = tick % 4 === 0;
              return (
                <span
                  key={tick}
                  aria-hidden="true"
                  className={
                    major
                      ? 'h-[1.5px] w-3 bg-[#0d1017]/40'
                      : 'h-[1px] w-1.5 bg-[#0d1017]/20'
                  }
                />
              );
            })}
          </div>
          <div className="relative ml-1.5 h-full w-[2px] bg-slate-900/18">
            <div
              ref={vernierFillRef}
              data-testid="vernier-fill"
              className="absolute inset-x-0 top-0 bg-[#b51d29]"
              style={{
                height: '100%',
                transformOrigin: 'top',
                transform: 'scaleY(0.06)',
                willChange: 'transform',
              }}
            />
          </div>
        </div>

        <nav aria-label="Jump to story chapter" className="flex flex-col items-end gap-1.5">
          {SCROLL_CHAPTERS.map((ch, idx) => {
            const isCurrent = idx === activeChapter;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onJumpToChapter(ch.id)}
                className={`group flex items-center gap-2 text-[11px] transition-colors duration-150 cursor-pointer ${
                  isCurrent
                    ? 'font-semibold text-[#b51d29]'
                    : 'text-[#4e5769] hover:text-[#0d1017]'
                }`}
                aria-label={`Jump to chapter ${ch.index}: ${ch.shortLabel}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={`text-[10.5px] font-medium transition-opacity duration-200 ${
                    isCurrent ? 'opacity-100 text-[#1b202b]' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {ch.shortLabel}
                </span>
                <span className="font-mono">{ch.index}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Sticky Full-Viewport Motion Graphics Stage — Text always lives in the empty space opposite the 3D keyboard */}
      <div className="sticky top-0 flex h-screen w-full flex-col justify-between overflow-hidden px-6 pb-8 pt-22 md:px-10">
        <div className="mx-auto my-auto flex w-full max-w-[1320px] items-center">
          <div
            ref={stageCardWrapperRef}
            className={`w-full transition-none ${
              isRight ? 'ml-auto xl:mr-20 max-w-[368px]' : 'mr-auto max-w-[396px]'
            }`}
            style={{
              opacity: currentChapter ? 1 : 0,
              transform: 'translate3d(0px, 0px, 0)',
              willChange: 'transform, opacity',
            }}
          >
            <AnimatePresence mode="wait">
              {currentChapter && (
                <motion.article
                  key={currentChapter.id}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          x: isRight ? 18 : -18,
                          transition: { duration: 0.2, ease: 'easeIn' },
                        }
                  }
                  transition={{ duration: 0.24, ease: KINETIC_EASE }}
                  className="relative py-2 max-xl:rounded-sm max-xl:bg-[#d7dbe4]/82 max-xl:px-4 max-xl:py-3 max-xl:backdrop-blur-md"
                >
                  {/* Open-bracket machined drafting reticles (top-start & bottom-end registration ticks) */}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute -top-1.5 h-3.5 w-3.5 border-t-2 border-[#b51d29] ${
                      isRight ? 'right-0 border-r-2' : 'left-0 border-l-2'
                    }`}
                  />
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute -bottom-1.5 h-3.5 w-3.5 border-b-2 border-[#0d1017]/35 ${
                      isRight ? 'left-0 border-l-2' : 'right-0 border-r-2'
                    }`}
                  />

                  {/* Stepped notched keybar accent line that draws across from the reading edge */}
                  <motion.div
                    aria-hidden="true"
                    initial={prefersReducedMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.48, ease: KINETIC_EASE }}
                    style={{ originX: isRight ? 1 : 0 }}
                    className="mb-3.5 flex items-center gap-1"
                  >
                    <span className="h-[2px] w-14 bg-[#b51d29]" />
                    <span className="h-[2px] w-3 bg-[#0d1017]/40" />
                    <span className="h-[1px] flex-1 bg-slate-900/18" />
                  </motion.div>

                  {/* Chapter kicker + short mode label */}
                  <motion.div
                    initial={prefersReducedMotion ? false : { y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.36, delay: 0.04, ease: KINETIC_EASE }}
                    className="flex items-center justify-between gap-3 text-[12px] font-medium text-[#374050]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#b51d29]">
                        {currentChapter.index}
                      </span>
                      <span aria-hidden="true">/</span>
                      <span className="text-[#161b26]">{currentChapter.kicker}</span>
                    </div>
                    {!isHero && (
                      <span className="font-mono text-[11px] font-medium text-[#4f586b]">
                        {currentChapter.explode > 0 ? '6 layers open' : currentChapter.shortLabel}
                      </span>
                    )}
                  </motion.div>

                  {/* Masked line-by-line headline with per-chapter physical motion signature */}
                  {isHero ? (
                    <h1
                      className="font-display mt-3.5 font-semibold tracking-[-0.03em] text-[#0d1017]"
                      style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)', lineHeight: 1.04 }}
                    >
                      {currentChapter.titleLines.map((line, i) => {
                        const lineAnim = getChapterLineMotion(visibleChapter, i, isRight);
                        return (
                          <span key={line} className="block overflow-hidden pb-[0.06em]">
                            <motion.span
                              className="block"
                              initial={prefersReducedMotion ? false : lineAnim.initial}
                              animate={lineAnim.animate}
                              transition={lineAnim.transition}
                            >
                              {line}
                            </motion.span>
                          </span>
                        );
                      })}
                    </h1>
                  ) : (
                    <h2
                      className="font-display mt-3.5 font-semibold tracking-[-0.025em] text-[#0d1017]"
                      style={{ fontSize: 'clamp(1.75rem, 2.5vw, 2.25rem)', lineHeight: 1.09 }}
                    >
                      {currentChapter.titleLines.map((line, i) => {
                        const lineAnim = getChapterLineMotion(visibleChapter, i, isRight);
                        return (
                          <span key={line} className="block overflow-hidden pb-[0.05em]">
                            <motion.span
                              className="block"
                              initial={prefersReducedMotion ? false : lineAnim.initial}
                              animate={lineAnim.animate}
                              transition={lineAnim.transition}
                            >
                              {line}
                            </motion.span>
                          </span>
                        );
                      })}
                    </h2>
                  )}

                  {/* Friendly story copy */}
                  <motion.p
                    initial={prefersReducedMotion ? false : { y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.42, delay: 0.17, ease: KINETIC_EASE }}
                    className="mt-4 text-[14.5px] leading-[1.65] text-[#262e3d]"
                  >
                    {currentChapter.body}
                  </motion.p>

                  {/* Hero-only tactile CNC switch bank & chamfered CTA */}
                  {isHero && (
                    <motion.div
                      initial={prefersReducedMotion ? false : { y: 14, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.44, delay: 0.23, ease: KINETIC_EASE }}
                    >
                      <div className="mt-5">
                        <div className="font-mono text-[11px] font-medium text-[#434c5e]">
                          Switch 3D layer view
                        </div>
                        <div
                          role="group"
                          aria-label="Hero 3D keycap view mode"
                          className="chamfer-btn mt-1.5 inline-flex flex-wrap items-center gap-1 bg-[#e5e9f2] p-1.5 ring-1 ring-inset ring-slate-900/14"
                        >
                          {HERO_KEYCAP_MODES.map((km) => {
                            const isActive = keycapMode === km.id;
                            return (
                              <button
                                key={km.id}
                                type="button"
                                onClick={() => onSelectKeycapMode(km.id)}
                                aria-pressed={isActive}
                                className={`relative px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                                  isActive
                                    ? 'text-[#f3f5f9]'
                                    : 'text-[#2c3342] hover:text-[#0d1017]'
                                }`}
                              >
                                {isActive && (
                                  <motion.span
                                    layoutId="hero-layer-actuator"
                                    transition={
                                      prefersReducedMotion ? { duration: 0 } : SPRING_SWITCH
                                    }
                                    aria-hidden="true"
                                    className="chamfer-btn absolute inset-0 bg-[#14171f]"
                                  />
                                )}
                                <span className="relative z-10">{km.label}</span>
                              </button>
                            );
                          })}
                          <span className="mx-0.5 h-4 w-px bg-slate-900/18" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={onToggleKeycapLayout}
                            aria-pressed={keycapLayout === 'symbols'}
                            aria-label="Toggle QWERTY and 123 symbol keycap layer"
                            className={`px-2.5 py-1.5 font-mono text-[12px] font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                              keycapLayout === 'symbols'
                                ? 'bg-[#b51d29] text-white'
                                : 'bg-[#d4d8e2] text-[#0d1017] hover:bg-[#14171f] hover:text-white'
                            }`}
                          >
                            {keycapLayout === 'qwerty' ? '123' : 'ABC'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-5">
                        <motion.button
                          type="button"
                          onClick={onOpenWorkbench}
                          whileTap={prefersReducedMotion ? undefined : { y: 1.5, scale: 0.985 }}
                          className="chamfer-btn inline-flex items-center gap-2 bg-[#b51d29] px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors duration-150 hover:bg-[#14171f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>Try 3D View</span>
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </motion.button>

                        <button
                          type="button"
                          onClick={() => onJumpToChapter('chapter-comb')}
                          className="group inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#0d1017] transition-colors duration-150 hover:text-[#b51d29] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>Scroll the story</span>
                          <ArrowDown
                            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-y-0.5"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Staggered 3-column metrics strip */}
                  <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-900/16 pt-4">
                    {currentChapter.metrics.map((m, idx) => (
                      <motion.div
                        key={m.label}
                        initial={prefersReducedMotion ? false : { y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          duration: 0.4,
                          delay: (isHero ? 0.3 : 0.22) + idx * 0.055,
                          ease: KINETIC_EASE,
                        }}
                      >
                        <dt className="text-[11px] font-medium text-[#434c5e]">{m.label}</dt>
                        <dd className="font-mono mt-0.5 text-[13px] font-semibold text-[#0d1017]">
                          {m.value}
                        </dd>
                      </motion.div>
                    ))}
                  </dl>
                </motion.article>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Quiet bottom scroll cue — visible only at the top of Chapter 01, clears away immediately on scroll */}
        <div
          ref={heroHintRef}
          className="mx-auto flex w-full max-w-[1320px] items-center justify-between border-t border-slate-900/14 pt-3.5 text-[12px] text-[#3a4252]"
          style={{
            opacity: 1,
            transform: 'translate3d(0, 0px, 0)',
            willChange: 'transform, opacity',
          }}
        >
          <span>Scroll down to follow the keys, moving bars, twin springs, and all six layers</span>
          <span className="font-mono hidden font-medium text-[#222834] sm:inline">
            Typewriter · Open-Source Android IME &amp; 3D Studio
          </span>
        </div>
      </div>
    </section>
  );
});
