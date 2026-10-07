/**
 * FlowGate Logo System
 *
 * Concept: Two vertical pillars with three tapering horizontal bars between them.
 * The pillars are the "gate"; the bars are flow being measured and released
 * incrementally — wider at top (full budget), narrower below (earned portion).
 * Reads as: a gate, a flow meter, a payment channel, a budget controller.
 *
 * No blockchain cubes, hexagons, or crypto clichés.
 * Works at 16px (favicon) through full display sizes.
 */

import { clsx } from 'clsx';

/* ── Shared gate mark ──────────────────────────────────────────────── */

interface MarkProps {
  /** Overall size in px (square). Default 32. */
  size?: number;
  /** Override fill colors */
  bg?: string;
  pillar?: string;
  flow?: string;
  className?: string;
}

/** The standalone gate icon — two pillars + three flow bars. */
export function LogoMark({
  size = 32,
  bg = 'var(--logo-bg)',
  pillar = 'var(--logo-pillar)',
  flow = 'var(--logo-flow)',
  className,
}: MarkProps) {
  const r = size * 0.25;        // corner radius of container
  const pw = size * 0.165;      // pillar width
  const ph = size * 0.65;       // pillar height
  const py = size * 0.175;      // pillar y
  const lx = size * 0.155;      // left pillar x
  const rx = size * (1 - 0.155 - 0.165); // right pillar x
  const pr = pw / 2;            // pillar corner radius

  // Flow bars — horizontally centered, tapering widths
  const bh = size * 0.1;        // bar height
  const br = bh / 2;            // bar radius
  const bw1 = size * 0.29;      // top bar width (widest)
  const bw2 = size * 0.205;     // mid bar width
  const bw3 = size * 0.125;     // bottom bar width (narrowest)
  const bx1 = (size - bw1) / 2;
  const bx2 = (size - bw2) / 2;
  const bx3 = (size - bw3) / 2;
  const by1 = size * 0.235;     // top bar y
  const by2 = size * 0.455;     // mid bar y
  const by3 = size * 0.67;      // bottom bar y

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Container */}
      <rect width={size} height={size} rx={r} fill={bg} />
      {/* Left pillar */}
      <rect x={lx} y={py} width={pw} height={ph} rx={pr} fill={pillar} />
      {/* Right pillar */}
      <rect x={rx} y={py} width={pw} height={ph} rx={pr} fill={pillar} />
      {/* Flow bar — top (widest) */}
      <rect x={bx1} y={by1} width={bw1} height={bh} rx={br} fill={flow} />
      {/* Flow bar — mid */}
      <rect x={bx2} y={by2} width={bw2} height={bh} rx={br} fill={flow} />
      {/* Flow bar — bottom (narrowest) */}
      <rect x={bx3} y={by3} width={bw3} height={bh} rx={br} fill={flow} opacity={0.85} />
    </svg>
  );
}

/* ── Wordmark ──────────────────────────────────────────────────────── */

interface WordmarkProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** "FlowGate" wordmark using the project's Space Grotesk display font. */
export function LogoWordmark({ color = 'var(--logo-word)', size = 'md', className }: WordmarkProps) {
  const sizeMap = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' };
  return (
    <span
      className={clsx('display font-bold tracking-tight', sizeMap[size], className)}
      style={{ color, letterSpacing: '-0.03em' }}
    >
      FlowGate
    </span>
  );
}

/* ── Primary logo (mark + wordmark) ───────────────────────────────── */

interface LogoProps {
  /** Mark size in px. Default 32. */
  markSize?: number;
  /** Wordmark size variant. Default 'md'. */
  wordmarkSize?: 'sm' | 'md' | 'lg';
  /** Color mode. */
  mode?: 'default' | 'light' | 'mono-dark' | 'mono-light';
  className?: string;
  /** Gap between mark and wordmark. */
  gap?: string;
}

const MODE_TOKENS = {
  // default: reads from CSS variables — adapts to light/dark theme automatically
  default: {
    bg: 'var(--logo-bg)',
    pillar: 'var(--logo-pillar)',
    flow: 'var(--logo-flow)',
    wordColor: 'var(--logo-word)',
  },
  // light: explicit light override (always light regardless of theme)
  light: {
    bg: '#ffffff',
    pillar: '#122d45',
    flow: '#1061a6',
    wordColor: '#ffffff',
  },
  'mono-dark': {
    bg: '#122d45',
    pillar: '#ffffff',
    flow: '#ffffff',
    wordColor: '#122d45',
  },
  'mono-light': {
    bg: '#ffffff',
    pillar: '#122d45',
    flow: '#122d45',
    wordColor: '#ffffff',
  },
};

/** Full primary logo: mark + wordmark, horizontally composed. */
export function Logo({
  markSize = 32,
  wordmarkSize = 'md',
  mode = 'default',
  className,
  gap = '0.5rem',
}: LogoProps) {
  const t = MODE_TOKENS[mode];
  return (
    <span className={clsx('inline-flex items-center', className)} style={{ gap }}>
      <LogoMark size={markSize} bg={t.bg} pillar={t.pillar} flow={t.flow} />
      <LogoWordmark color={t.wordColor} size={wordmarkSize} />
    </span>
  );
}

/* ── Favicon-optimised mark (inline SVG string for index.html) ─────── */

/** Returns a data-URI SVG favicon string — use in <link rel="icon"> */
export function faviconDataUri(size = 32): string {
  // Simplified variant at tiny sizes: just pillars + one bar (readable at 16px)
  if (size <= 16) {
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="%23122d45"/><rect x="2" y="3" width="3" height="10" rx="1.5" fill="white"/><rect x="11" y="3" width="3" height="10" rx="1.5" fill="white"/><rect x="6" y="4.5" width="4" height="2" rx="1" fill="%231061a6"/><rect x="6.5" y="8" width="3" height="2" rx="1" fill="%231061a6"/></svg>`
    )}`;
  }
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="%23122d45"/><rect x="5" y="6" width="5" height="20" rx="2.5" fill="white"/><rect x="22" y="6" width="5" height="20" rx="2.5" fill="white"/><rect x="12" y="8" width="8" height="2.5" rx="1.25" fill="%231061a6" opacity=".9"/><rect x="13" y="14" width="6" height="2.5" rx="1.25" fill="%231061a6"/><rect x="14" y="20" width="4" height="2.5" rx="1.25" fill="%231061a6" opacity=".85"/></svg>`
  )}`;
}
