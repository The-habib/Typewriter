import { memo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface TopNavProps {
  onOpenWorkbench: () => void;
}

const NAV_LINKS = [
  { href: '#chapter-comb', label: 'Story' },
  { href: '#anatomy', label: 'Parts' },
  { href: '#specifications', label: 'Specs' },
  { href: '#inquiry', label: 'Download' },
] as const;

const SPRING_SNAP = { type: 'spring' as const, stiffness: 460, damping: 34 };

export const TopNav = memo(function TopNav({ onOpenWorkbench }: TopNavProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-4 pt-2.5 md:px-8">
      {/* Uniquely sculpted CNC-notched aluminum bridge with angled side chamfers and recessed center comb notch */}
      <div className="pointer-events-auto relative mx-auto max-w-[1320px]">
        {/* Precision SVG machined chassis contour behind the 3-zone bar */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1320 56"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_10px_24px_rgba(13,16,23,0.09)]"
        >
          <path
            d="M 18 1 L 1302 1 L 1319 18 L 1319 42 L 1305 55 L 796 55 L 784 48 L 536 48 L 524 55 L 15 55 L 1 42 L 1 18 Z"
            fill="#e4e8f0"
            stroke="rgba(13, 16, 23, 0.16)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Subtle upper precision highlight bevel */}
          <path
            d="M 22 2.5 L 1298 2.5"
            stroke="rgba(255, 255, 255, 0.72)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Strict 3-Zone Top Bar Contract inside the sculpted bridge */}
        <div className="relative flex h-[54px] items-center justify-between gap-8 px-6 md:px-9">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#0d1017] transition-colors duration-150 hover:text-[#b51d29] whitespace-nowrap shrink-0"
          >
            OpenKey 32
          </a>

          {/* Zone 2: 4 Concise Single-Line Navigation Links with animated mechanical keybar underline */}
          <nav
            aria-label="Primary navigation"
            onMouseLeave={() => setHoveredHref(null)}
            className="hidden items-center gap-7 text-[13.5px] font-medium text-[#2c3342] md:flex"
          >
            {NAV_LINKS.map((item) => {
              const isHovered = hoveredHref === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onMouseEnter={() => setHoveredHref(item.href)}
                  onFocus={() => setHoveredHref(item.href)}
                  onBlur={() => setHoveredHref(null)}
                  className="relative py-1.5 transition-colors duration-150 hover:text-[#0d1017] focus-visible:text-[#0d1017] focus-visible:outline-none whitespace-nowrap shrink-0"
                >
                  <span>{item.label}</span>
                  {isHovered && (
                    <motion.span
                      layoutId="nav-keybar-indicator"
                      transition={prefersReducedMotion ? { duration: 0 } : SPRING_SNAP}
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-0.5 h-[2px] bg-[#b51d29]"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action shaped as a CNC-chamfered mechanical key */}
          <div className="flex items-center shrink-0">
            <motion.button
              type="button"
              onClick={onOpenWorkbench}
              whileTap={prefersReducedMotion ? undefined : { y: 1.5, scale: 0.985 }}
              transition={{ duration: 0.12 }}
              className="chamfer-btn bg-[#14171f] px-5 py-2 text-[13px] font-medium text-[#f1f3f7] transition-colors duration-150 hover:bg-[#b51d29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Try 3D View
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
});
