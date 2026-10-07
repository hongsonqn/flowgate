/**
 * Shared UI primitives for FlowGate.
 * All components consume design tokens from index.css — no hardcoded colours.
 */
import type { ReactNode } from 'react';
import { Loader2, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

/* ── Btn ────────────────────────────────────────────────────────── */

type BtnVariant = 'primary' | 'secondary' | 'success' | 'ghost' | 'danger-outline';
type BtnSize    = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<BtnSize, string> = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
};

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Btn({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...rest
}: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'btn',
        `btn-${variant}`,
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* ── StatCard ───────────────────────────────────────────────────── */

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: React.FC<{ className?: string; style?: React.CSSProperties }>;
  valueColor?: string;
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, icon: Icon, valueColor, accent, className = '' }: StatCardProps) {
  return (
    <div
      className={`card p-5 flex flex-col gap-1 ${className}`}
      style={accent ? { outline: '1px solid var(--accent-subtle)', outlineOffset: '-1px' } : {}}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 flex-shrink-0" style={{ color: 'var(--muted)' }} />}
        <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</span>
      </div>
      <div
        className="display font-bold text-2xl tabular-nums leading-none mt-0.5"
        style={{ color: valueColor ?? 'var(--ink)' }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{sub}</div>
      )}
    </div>
  );
}

/* ── TxStatus — micro-flow banner ───────────────────────────────── */

type TxPhase =
  | 'wallet-prompt'     // waiting for user to confirm in wallet
  | 'confirming'        // tx submitted, waiting for block
  | 'success'
  | 'error';

const TX_COPY: Record<TxPhase, { label: string; icon: ReactNode; style: React.CSSProperties }> = {
  'wallet-prompt': {
    label: 'Confirm in your wallet',
    icon: <Loader2 className="size-4 animate-spin flex-shrink-0" aria-hidden />,
    style: { background: 'var(--accent-subtle)', color: 'var(--accent)', borderColor: 'rgba(18,45,69,0.18)' },
  },
  confirming: {
    label: 'Waiting for confirmation…',
    icon: <Loader2 className="size-4 animate-spin flex-shrink-0" aria-hidden />,
    style: { background: 'var(--warning-subtle)', color: 'var(--warning)', borderColor: 'rgba(146,82,10,0.18)' },
  },
  success: {
    label: 'Transaction confirmed',
    icon: <CheckCircle2 className="size-4 flex-shrink-0" aria-hidden />,
    style: { background: 'var(--success-subtle)', color: 'var(--success)', borderColor: 'var(--success-border)' },
  },
  error: {
    label: 'Transaction failed',
    icon: <AlertCircle className="size-4 flex-shrink-0" aria-hidden />,
    style: { background: 'var(--danger-subtle)', color: 'var(--danger)', borderColor: 'var(--danger-border)' },
  },
};

interface TxStatusProps {
  phase: TxPhase;
  message?: string;
  className?: string;
}

export function TxStatus({ phase, message, className = '' }: TxStatusProps) {
  const { label, icon, style } = TX_COPY[phase];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${className}`}
      style={style}
    >
      {icon}
      <span>{message ?? label}</span>
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────── */

interface EmptyStateProps {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="card py-16 px-8 flex flex-col items-center text-center gap-4">
      <div
        className="size-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--surface-muted)' }}
      >
        <Icon className="size-7" style={{ color: 'var(--muted)' }} />
      </div>
      <div>
        <p className="font-semibold text-base mb-1" style={{ color: 'var(--ink)' }}>{title}</p>
        {description && (
          <p className="text-sm max-w-xs mx-auto text-pretty" style={{ color: 'var(--muted)' }}>{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ── InlineAlert ────────────────────────────────────────────────── */

type AlertKind = 'error' | 'warning' | 'info';

const ALERT_STYLES: Record<AlertKind, React.CSSProperties> = {
  error:   { background: 'var(--danger-subtle)',  color: 'var(--danger)',  borderColor: 'var(--danger-border)' },
  warning: { background: 'var(--warning-subtle)', color: 'var(--warning)', borderColor: 'rgba(146,82,10,0.20)' },
  info:    { background: 'var(--accent-subtle)',  color: 'var(--accent)',  borderColor: 'rgba(18,45,69,0.15)' },
};

interface InlineAlertProps {
  kind?: AlertKind;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function InlineAlert({ kind = 'error', children, action, className = '' }: InlineAlertProps) {
  const Icon = kind === 'warning' ? AlertTriangle : AlertCircle;
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${className}`}
      style={ALERT_STYLES[kind]}
    >
      <Icon className="size-4 flex-shrink-0 mt-px" aria-hidden />
      <span className="flex-1">{children}</span>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* ── SectionHeader ──────────────────────────────────────────────── */

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="display font-bold text-2xl leading-tight" style={{ color: 'var(--ink)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 mt-1">{action}</div>}
    </div>
  );
}

/* ── ProgressBar ────────────────────────────────────────────────── */

interface ProgressBarProps {
  pct: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export function ProgressBar({ pct, color = 'var(--success)', label, sublabel }: ProgressBarProps) {
  return (
    <div>
      {(label || sublabel) && (
        <div className="flex justify-between items-baseline mb-1.5">
          {label   && <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>}
          {sublabel && <span className="text-xs tabular-nums font-medium" style={{ color: 'var(--ink-2)' }}>{sublabel}</span>}
        </div>
      )}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}
