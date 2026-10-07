import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Inbox, TrendingUp, CheckCircle2, Activity, Wallet } from 'lucide-react';
import { ConnectKitButton } from 'connectkit';
import type { Budget } from '../types';
import { BudgetCard } from './BudgetCard';
import { StatCard, EmptyState, InlineAlert, SectionHeader } from './ui';

interface RecipientViewProps {
  onNavigate: (view: string, budgetId?: string) => void;
}

export function RecipientView({ onNavigate }: RecipientViewProps) {
  const { address }  = useAccount();
  const [budgets,  setBudgets]  = useState<Budget[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [nowTs]    = useState(() => Math.floor(Date.now() / 1000));

  const loadBudgets = useCallback((addr: string) => {
    setLoading(true);
    fetch(`/api/recipients/${addr}/budgets`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then((data: Budget[]) => { setBudgets(data ?? []); setLoading(false); })
      .catch((e: unknown) => { setError('Could not load earnings: ' + String(e)); setLoading(false); });
  }, []);

  useEffect(() => {
    if (address) { loadBudgets(address); } else { setLoading(false); }
  }, [address, loadBudgets]);

  /* ── Not connected ──────────────────────────────── */
  if (!address) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 flex flex-col items-center text-center gap-6">
          <div className="size-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
            <Wallet className="size-8" style={{ color: 'var(--accent-hover)' }} />
          </div>
          <div>
            <h2 className="display font-bold text-2xl mb-2" style={{ color: 'var(--ink)' }}>
              Connect to view earnings
            </h2>
            <p className="text-sm max-w-xs mx-auto text-pretty" style={{ color: 'var(--muted)' }}>
              Your wallet address is used to find budget gates where you are a recipient.
            </p>
          </div>
          <ConnectKitButton label="Connect Wallet" />
        </div>
      </div>
    );
  }

  /* ── Aggregates ─────────────────────────────────── */
  type BudgetWithRecip = Budget & { earned?: string; withdrawn?: string };
  const totalEarned   = budgets.reduce((s, b) => s + parseFloat((b as BudgetWithRecip).earned   || '0'), 0);
  const totalWithdrawn= budgets.reduce((s, b) => s + parseFloat((b as BudgetWithRecip).withdrawn || '0'), 0);
  const availableNow  = Math.max(0, totalEarned - totalWithdrawn);
  const activeCount   = budgets.filter(b => nowTs >= b.start_time && nowTs < b.end_time).length;
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-4xl mx-auto">
      <SectionHeader
        title="My Earnings"
        subtitle="Budget gates where your wallet is a recipient."
      />

      {/* Stats — Available Now is the hero, rendered first and larger */}
      {budgets.length > 0 && !loading && (
        <>
          {/* Hero stat: available to withdraw */}
          <div
            className="card p-6 mb-4 flex items-center justify-between gap-6"
            style={availableNow > 0 ? { borderColor: 'var(--success-border)', boxShadow: '0 0 0 1px var(--success-border), var(--shadow-card)' } : {}}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: availableNow > 0 ? 'var(--success)' : 'var(--muted)', letterSpacing: '0.06em' }}>
                Available to Withdraw
              </p>
              <p
                className="display font-bold tabular-nums"
                style={{ color: availableNow > 0 ? 'var(--success)' : 'var(--ink)', fontSize: '2.25rem', lineHeight: 1.1 }}
              >
                {fmt(availableNow)}
                <span className="text-xl font-semibold ml-2" style={{ color: availableNow > 0 ? 'var(--success)' : 'var(--muted)' }}>USDC</span>
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {availableNow > 0
                  ? 'Open a budget gate below to claim your earnings.'
                  : 'No unclaimed earnings at this time.'}
              </p>
            </div>
            {availableNow > 0 && (
              <div
                className="size-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--success-subtle)' }}
              >
                <TrendingUp className="size-7" style={{ color: 'var(--success)' }} aria-hidden />
              </div>
            )}
          </div>

          {/* Supporting stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Total Earned"
              value={<>{fmt(totalEarned)}<span className="text-sm font-semibold ml-1" style={{ color: 'var(--muted)' }}>USDC</span></>}
              icon={TrendingUp}
              valueColor="var(--ink)"
            />
            <StatCard
              label="Total Withdrawn"
              value={<>{fmt(totalWithdrawn)}<span className="text-sm font-semibold ml-1" style={{ color: 'var(--muted)' }}>USDC</span></>}
              icon={CheckCircle2}
              valueColor="var(--accent-hover)"
            />
            <StatCard
              label="Active Gates"
              value={activeCount}
              icon={Activity}
              valueColor={activeCount > 0 ? 'var(--success)' : 'var(--ink)'}
              className="col-span-2 md:col-span-1"
            />
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="card p-6 h-40 animate-pulse" style={{ background: 'var(--surface-muted)' }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <InlineAlert kind="error">{error}</InlineAlert>}

      {/* Empty state */}
      {!loading && !error && budgets.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No earnings yet"
          description="Your wallet hasn't been added to any budget gate. Budget owners add recipients before or during the active period."
        />
      )}

      {/* Budget list */}
      {!loading && budgets.length > 0 && (
        <div className="space-y-3">
          {budgets.map(b => (
            <BudgetCard
              key={b.budget_id_hex}
              budget={b}
              onClick={() => onNavigate('budget-detail', b.budget_id_hex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
