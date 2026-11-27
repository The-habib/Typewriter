import { memo, useState, type FormEvent } from 'react';
import { ArrowUp, Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface InquiryFooterProps {
  onJumpTop: () => void;
  onOpenWorkbench: () => void;
}

interface ReleasePack {
  id: string;
  label: string;
  formats: string;
  size: string;
  summary: string;
}

const RELEASE_PACKS: readonly ReleasePack[] = [
  {
    id: '3D Print Pack (STL + STEP)',
    label: '3D Print Pack',
    formats: 'STL · STEP · Print Guide',
    size: '42 MB · 240+ parts',
    summary: 'Ready-to-slice keycaps, comb rails, and guide rings with print clearances.',
  },
  {
    id: 'Full CAD Source Files',
    label: 'Full CAD Source',
    formats: 'STEP AP242 · Blender · DXF',
    size: '118 MB · Native Solids',
    summary: 'Complete editable 3D assembly to remix dimensions, springs, or key shapes.',
  },
  {
    id: 'Web 3D & Shader Source',
    label: 'Web 3D & Shaders',
    formats: 'Three.js · GLSL · TypeScript',
    size: '6 MB · MIT Repo',
    summary: 'The real-time kinematic engine, chrome keycap shaders, and interactive UI.',
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KINETIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING_TAB = { type: 'spring' as const, stiffness: 400, damping: 32 };

export const InquiryFooter = memo(function InquiryFooter({ onJumpTop, onOpenWorkbench }: InquiryFooterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [packageType, setPackageType] = useState<string>(RELEASE_PACKS[0].id);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  const activePack = RELEASE_PACKS.find((p) => p.id === packageType) ?? RELEASE_PACKS[0];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { name?: string; email?: string } = {};
    if (name.trim().length < 2) {
      nextErrors.name = 'Please enter your name or handle.';
    }
    if (!EMAIL_RE.test(email.trim())) {
      nextErrors.email = 'Please enter a valid email address.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitted(false);
      return;
    }
    setErrors({});
    setSubmitted(true);
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

      {/* Section 09 — Open-Source File Crate Selector & Chamfered Dispatch Envelope */}
      <section
        id="inquiry"
        aria-labelledby="inquiry-heading"
        className="drafting-surface scroll-mt-20 mx-auto my-auto w-full max-w-[1320px] px-6 py-20 md:px-10 lg:py-24"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
          {/* Left 5 cols: Interactive 3-Pack Mechanical Selector Stack */}
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
              <span>Open-Source Files</span>
            </p>
            <h2
              id="inquiry-heading"
              className="font-display mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#0d1017] sm:text-[38px] [text-wrap:balance]"
            >
              Download the files and build your own.
            </h2>
            <p className="mt-4 text-[14.5px] leading-[1.65] text-[#28303e]">
              Pick the release bundle you want below—every 3D print file, CAD model, and shader is
              free under the MIT Open Hardware license.
            </p>

            {/* Interactive 3-Tab Mechanical Pack Selector (wired directly to the form) */}
            <div
              role="radiogroup"
              aria-label="Open-source release bundles"
              className="mt-7 space-y-2.5"
            >
              {RELEASE_PACKS.map((pack, idx) => {
                const selected = packageType === pack.id;
                return (
                  <button
                    key={pack.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setPackageType(pack.id);
                      if (submitted) setSubmitted(false);
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
                        className={`font-mono text-[11px] font-medium ${
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

          {/* Right 7 cols: Chamfered Machined Dispatch Plate */}
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
                {submitted ? (
                  <motion.div
                    key="submitted"
                    initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: KINETIC_EASE }}
                    role="status"
                    aria-live="polite"
                    className="py-4"
                  >
                    <div className="chamfer-btn inline-flex h-11 w-11 items-center justify-center bg-[#14171f] text-white">
                      <Check className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="font-display mt-5 text-[24px] font-semibold text-[#0d1017]">
                      Release pack ready for {name.trim()}
                    </h3>
                    <p className="mt-2.5 text-[14.5px] leading-[1.65] text-[#28303e]">
                      Your download link for the{' '}
                      <span className="font-semibold text-[#0d1017]">{packageType}</span> has been
                      queued for{' '}
                      <span className="font-mono font-medium text-[#0d1017]">{email.trim()}</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitted(false);
                        setName('');
                        setEmail('');
                        setNotes('');
                      }}
                      className="chamfer-btn mt-7 bg-[#14171f] px-5 py-2.5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#b51d29] cursor-pointer"
                    >
                      Pick another pack
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={prefersReducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    noValidate
                  >
                    {/* Live summary ribbon of the chosen bundle */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-900/14 pb-4">
                      <div>
                        <div className="font-mono text-[11px] font-semibold text-[#b51d29]">
                          Selected Bundle
                        </div>
                        <div className="font-display text-[17px] font-semibold text-[#0d1017]">
                          {activePack.label}
                        </div>
                      </div>
                      <span className="font-mono text-[12px] font-medium text-[#374050]">
                        {activePack.formats}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="inquiry-name"
                          className="block text-[12.5px] font-semibold text-[#0d1017]"
                        >
                          Your Name
                        </label>
                        <input
                          id="inquiry-name"
                          name="name"
                          type="text"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                          }}
                          placeholder="Alex Rivera"
                          aria-invalid={Boolean(errors.name)}
                          className="mt-1.5 w-full border-b-2 border-slate-900/20 bg-[#f4f6fa] px-3.5 py-2.5 text-[14px] text-[#0d1017] placeholder:text-[#667085] transition-colors focus:border-[#b51d29] focus:outline-none"
                        />
                        {errors.name && (
                          <p role="alert" className="mt-1.5 text-[12px] font-medium text-[#b51d29]">
                            {errors.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="inquiry-email"
                          className="block text-[12.5px] font-semibold text-[#0d1017]"
                        >
                          Email Address
                        </label>
                        <input
                          id="inquiry-email"
                          name="email"
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                          }}
                          placeholder="alex@example.com"
                          aria-invalid={Boolean(errors.email)}
                          className="mt-1.5 w-full border-b-2 border-slate-900/20 bg-[#f4f6fa] px-3.5 py-2.5 text-[14px] text-[#0d1017] placeholder:text-[#667085] transition-colors focus:border-[#b51d29] focus:outline-none"
                        />
                        {errors.email && (
                          <p role="alert" className="mt-1.5 text-[12px] font-medium text-[#b51d29]">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5">
                      <label
                        htmlFor="inquiry-notes"
                        className="block text-[12.5px] font-semibold text-[#0d1017]"
                      >
                        What are you building? (Optional)
                      </label>
                      <textarea
                        id="inquiry-notes"
                        name="notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Tell us if you're 3D printing, remixing keycaps, or learning shaders."
                        className="mt-1.5 w-full border-b-2 border-slate-900/20 bg-[#f4f6fa] px-3.5 py-2.5 text-[14px] text-[#0d1017] placeholder:text-[#667085] transition-colors focus:border-[#b51d29] focus:outline-none"
                      />
                    </div>

                    <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                      <span className="font-mono text-[11.5px] font-medium text-[#3f4859]">
                        MIT Open Hardware · Free forever
                      </span>
                      <motion.button
                        type="submit"
                        whileTap={prefersReducedMotion ? undefined : { y: 1.5, scale: 0.985 }}
                        className="chamfer-btn bg-[#14171f] px-6 py-2.5 text-[13.5px] font-medium text-white transition-colors duration-150 hover:bg-[#b51d29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b51d29] cursor-pointer whitespace-nowrap"
                      >
                        Get Download Link
                      </motion.button>
                    </div>
                  </motion.form>
                )}
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
            {/* Left Signature Block */}
            <div className="md:col-span-5">
              <div className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-white sm:text-[38px]">
                OpenKey 32
              </div>
              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-slate-300">
                Open-source 3D mechanical keyboard project · 32 keys, 17 moving bars, free MIT
                hardware files.
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
                Specs
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
            <span>MIT Open Hardware · Free to print, remix, and share</span>
            <span className="font-mono">32 Keys · 17 Steel Bars · 2 Coil Springs</span>
          </div>
        </div>
      </footer>
    </div>
  );
});
