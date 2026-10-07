import { Clock, Users, ChevronRight, CheckCircle2, Loader2, LockKeyhole, CalendarClock } from 'lucide-react';
import type { Budget } from '../types';
import { ProgressBar } from './ui';

interface BudgetCardProps {
  budget: Budget;
  onClick: () => void;
}

/* ── Status badge ──────────────────────────────────────────── */

function StatusBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; style: React.CSSProperties; dot: string }> = {
    pending:  { label: 'Pending',   style: { background: 'rgba(107,101,128,0.10)', color: 'var(--muted)'        }, dot: 'var(--subtle)' },
    open:     { label: 'Scheduled', style: { background: 'var(--accent-subtle)',   color: 'var(--accent-hover)'  }, dot: 'var(--accent-hover)' },
    active:   { label: 'Active',    style: { background: 'var(--success-subtle)',  color: 'var(--success)'       }, dot: 'var(--success)' },
    closed:   { label: 'Closed',    style: { background: 'rgba(107,101,128,0.10)', color: 'var(--subtle)'        }, dot: 'var(--subtle)' },
  };
  const { label, style, dot } = config[state] ?? config.pending;
  const Icon =
    state === 'active'  ? CheckCircle2 :
    state === 'open'    ? CalendarClock :
    state === 'closed'  ? LockKeyhole :
    Loader2;

  return (
    <span className="badge" style={style}>
      <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: dot }} aria-hidden />
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/* ── BudgetCard ────────────────────────────────────────────── */

export function BudgetCard({ budget, onClick }: BudgetCardProps) {
  const earned = parseFloat(budget.total_earned || '0');
  const total  = parseFloat(budget.total_amount || '0');
  const withdrawn = parseFloat((budget as unknown as { withdrawn?: string }).withdrawn || '0');
  const pct = total > 0 ? Math.min(100, (earned / total) * 100) : 0;

  const effectiveState = budget.state && budget.state !== 'pending'
    ? budget.state
    : budget.state || 'open';

  const endDate   = new Date(budget.end_time * 1000);
  const startDate = new Date(budget.start_time * 1000);

  const timeDesc =
    effectiveState === 'open'   ? `Starts ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` :
    effectiveState === 'active' ? `Ends ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` :
    `Ended ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const progressColor =
    effectiveState === 'active' ? 'var(--success)' :
    effectiveState === 'closed' ? 'var(--subtle)' :
    'var(--accent-hover)';

  return (
    <button
      onClick={onClick}
      aria-label={`Open ${budget.name || 'budget'} details`}
      className="group w-full text-left card p-0 overflow-hidden transition-all duration-150 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:shadow-sm"
      style={{ '--tw-shadow': 'var(--shadow-md)' } as React.CSSProperties}
    >
      {/* Top accent stripe for active budgets */}
      {effectiveState === 'active' && (
        <div className="h-0.5 w-full" style={{ background: 'var(--success)' }} aria-hidden />
      )}

      <div className="p-6">
        {/* Row 1: Status + time */}
        <div className="flex items-center gap-2 mb-3">
          <StatusBadge state={effectiveState} />
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--subtle)' }}>
            <Clock className="size-3" aria-hidden />
            {timeDesc}
          </span>
        </div>

        {/* Row 2: Name + chevron */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <h3
            className="display font-bold text-xl leading-snug truncate"
            style={{ color: 'var(--ink)' }}
          >
            {budget.name || 'Unnamed Budget'}
          </h3>
          <ChevronRight
            className="size-5 mt-0.5 flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
            style={{ color: 'var(--muted)' }}
            aria-hidden
          />
        </div>

        {budget.description && (
          <p className="text-sm truncate mb-4" style={{ color: 'var(--muted)' }}>
            {budget.description}
          </p>
        )}

        {/* Row 3: Key metrics */}
        <div className="flex items-end justify-between mb-5 mt-3">
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Locked</div>
            <div className="display font-bold text-2xl tabular-nums" style={{ color: 'var(--ink)' }}>
              {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm font-semibold ml-1" style={{ color: 'var(--muted)' }}>USDC</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Earned</div>
            <div
              className="font-bold text-lg tabular-nums"
              style={{ color: pct > 0 ? 'var(--success)' : 'var(--subtle)' }}
            >
              {earned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm font-normal ml-1">USDC</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar
          pct={pct}
          color={progressColor}
          label="Earned of locked"
          sublabel={`${pct.toFixed(1)}%`}
        />

        {/* Row 4: Footer meta */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--subtle)' }}>
            {budget.recipients && (
              <span className="flex items-center gap-1">
                <Users className="size-3" aria-hidden />
                {budget.recipients.length} recipient{budget.recipients.length !== 1 ? 's' : ''}
              </span>
            )}
            {withdrawn > 0 && (
              <span className="tabular-nums">
                {withdrawn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC withdrawn
              </span>
            )}
          </div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-hover)' }}
          >
            View details →
          </span>
        </div>
      </div>
    </button>
  );
}
