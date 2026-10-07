import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Plus, LayoutDashboard, Wallet, TrendingUp, Activity, Zap } from 'lucide-react';
import { ConnectKitButton } from 'connectkit';
import type { Budget } from '../types';
import { BudgetCard } from './BudgetCard';
import { StatCard, EmptyState, InlineAlert, Btn, SectionHeader } from './ui';

interface DashboardProps {
  onNavigate: (view: string, budgetId?: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { address } = useAccount();
  const [budgets, setBudgets]   = useState<Budget[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const loadBudgets = useCallback((addr: string) => {
    setLoading(true);
    setError('');
    fetch(`/api/budgets?owner=${addr}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then((data: { budgets?: Budget[] }) => {
        setBudgets(data.budgets ?? []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError('Could not load budgets. ' + String(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (address) { loadBudgets(address); } else { setLoading(false); }
  }, [address, loadBudgets]);

  /* ── Not connected ──────────────────────────────────────── */
  if (!address) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 flex flex-col items-center text-center gap-6">
          <div
            className="size-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-subtle)' }}
          >
            <Wallet className="size-8" style={{ color: 'var(--accent-hover)' }} />
          </div>
          <div>
            <h2 className="display font-bold text-2xl mb-2" style={{ color: 'var(--ink)' }}>
              Connect your wallet
            </h2>
            <p className="text-sm max-w-xs mx-auto text-pretty" style={{ color: 'var(--muted)' }}>
              Connect to manage your budget gates, view locked USDC, and track usage-triggered releases.
            </p>
          </div>
          <ConnectKitButton label="Connect Wallet" />
        </div>
      </div>
    );
  }

  /* ── Stats ──────────────────────────────────────────────── */
  const active       = budgets.filter(b => b.state === 'active').length;
  const totalLocked  = budgets.reduce((s, b) => s + parseFloat(b.total_amount  || '0'), 0);
  const totalEarned  = budgets.reduce((s, b) => s + parseFloat(b.total_earned  || '0'), 0);
  const utilizationPct = totalLocked > 0 ? Math.round((totalEarned / totalLocked) * 100) : 0;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="max-w-5xl mx-auto">
      <SectionHeader
        title="My Budget Gates"
        subtitle="Manage USDC budget gates and track usage-triggered releases."
        action={
          <Btn variant="primary" size="sm" onClick={() => onNavigate('create')}>
            <Plus className="size-4" aria-hidden />
            New Budget
          </Btn>
        }
      />

      {/* Stats row */}
      {budgets.length > 0 && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Budgets"
            value={budgets.length}
            icon={LayoutDashboard}
          />
          <StatCard
            label="Active"
            value={active}
            icon={Activity}
            valueColor={active > 0 ? 'var(--success)' : 'var(--ink)'}
          />
          <StatCard
            label="USDC Locked"
            value={<>{fmt(totalLocked)}<span className="text-base font-semibold ml-1" style={{ color: 'var(--muted)' }}>USDC</span></>}
            icon={Zap}
          />
          <StatCard
            label="Utilization"
            value={`${utilizationPct}%`}
            icon={TrendingUp}
            sub={`${fmt(totalEarned)} USDC earned`}
            valueColor={utilizationPct > 0 ? 'var(--success)' : 'var(--ink)'}
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-6 h-40 animate-pulse" style={{ background: 'var(--surface-muted)' }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <InlineAlert kind="error">{error}</InlineAlert>}

      {/* Empty state */}
      {!loading && !error && budgets.length === 0 && (
        <EmptyState
          icon={Zap}
          title="No budget gates yet"
          description="Create your first budget gate to start distributing USDC by verified usage proof."
          action={
            <Btn variant="primary" onClick={() => onNavigate('create')}>
              <Plus className="size-4" aria-hidden />
              Create Budget Gate
            </Btn>
          }
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
