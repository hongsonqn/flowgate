import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { keccak256, encodePacked, parseUnits } from 'viem';
import {
  ArrowLeft, Plus, ExternalLink, RefreshCw,
  AlertCircle, Users, Clock, TrendingUp, Zap,
  LockKeyhole, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts';
import { BUDGET_GATE_ADDRESS, BUDGET_GATE_ABI } from '../contracts/BudgetGate';
import type { Budget, RecipientRecord, ActivityRecord } from '../types';
import { Btn, TxStatus, InlineAlert, ProgressBar } from './ui';

const TARGET_CHAIN_ID = 5042002;
const usdcFact        = getUsdc(TARGET_CHAIN_ID)!;
const USDC_DECIMALS   = usdcFact.decimals;

interface BudgetDetailProps {
  budgetIdHex: string;
  onBack: () => void;
}

/* ── State chip ─────────────────────────────────────── */

function StatePill({ state }: { state: string }) {
  if (state === 'active') return (
    <span className="badge" style={{ background: 'var(--success-subtle)', color: 'var(--success)' }}>
      <span className="dot-live" aria-hidden />
      Active
    </span>
  );
  if (state === 'open') return (
    <span className="badge" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-hover)' }}>
      <Clock className="size-3" aria-hidden /> Scheduled
    </span>
  );
  return (
    <span className="badge" style={{ background: 'rgba(107,101,128,0.10)', color: 'var(--subtle)' }}>
      <LockKeyhole className="size-3" aria-hidden /> Closed
    </span>
  );
}

/* ── Main component ─────────────────────────────────── */

export function BudgetDetail({ budgetIdHex, onBack }: BudgetDetailProps) {
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const [budget,   setBudget]   = useState<Budget | null>(null);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newRecipAddr,     setNewRecipAddr]     = useState('');
  const [newRecipAlloc,    setNewRecipAlloc]    = useState('');
  const [newRecipLabel,    setNewRecipLabel]    = useState('');

  const [showAttest,  setShowAttest]  = useState(false);
  const [attestRecip, setAttestRecip] = useState('');
  const [attestEarned, setAttestEarned] = useState('');
  const [attestNonce,  setAttestNonce]  = useState('1');

  const isWrongChain = chainId !== TARGET_CHAIN_ID;
  const isOwner    = address?.toLowerCase() === budget?.owner_address?.toLowerCase();
  const isAttester = address?.toLowerCase() === budget?.attester_address?.toLowerCase();

  const [now] = useState(() => Math.floor(Date.now() / 1000));

  const { writeContract: addRecipientTx, data: addRecipHash, isPending: addPending }     = useWriteContract();
  const { isLoading: addConfirming,  isSuccess: addSuccess }  = useWaitForTransactionReceipt({ hash: addRecipHash });

  const { writeContract: attestTx,    data: attestHash,  isPending: attestPending }     = useWriteContract();
  const { isLoading: attestConfirming, isSuccess: attestSuccess } = useWaitForTransactionReceipt({ hash: attestHash });

  const { writeContract: reclaimTx,   data: reclaimHash, isPending: reclaimPending }    = useWriteContract();
  const { isLoading: reclaimConfirming, isSuccess: reclaimSuccess } = useWaitForTransactionReceipt({ hash: reclaimHash });

  /* ── Data fetching ───────────────────────────────── */

  const fetchData = useCallback(async () => {
    const [bRes, aRes] = await Promise.all([
      fetch(`/api/budgets/${budgetIdHex}`),
      fetch(`/api/budgets/${budgetIdHex}/activity?limit=20`),
    ]);
    if (!bRes.ok) throw new Error('Budget not found');
    const b = (await bRes.json()) as Budget;
    const a = aRes.ok ? ((await aRes.json()) as ActivityRecord[]) : [];
    setBudget(b); setActivity(a);
  }, [budgetIdHex]);

  const load = useCallback(() => {
    setLoading(true);
    fetchData()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [fetchData]);

  const silentRefresh = useCallback(() => {
    fetchData().catch(() => {/* non-fatal */});
  }, [fetchData]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!addSuccess) return;
    toast.success('Recipient added');
    silentRefresh(); setShowAddRecipient(false); setNewRecipAddr(''); setNewRecipAlloc(''); setNewRecipLabel('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSuccess]);

  useEffect(() => {
    if (!attestSuccess) return;
    toast.success('Attestation submitted');
    silentRefresh(); setShowAttest(false); setAttestEarned('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attestSuccess]);

  useEffect(() => {
    if (!reclaimSuccess) return;
    toast.success('Unspent funds reclaimed');
    silentRefresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reclaimSuccess]);

  /* ── Handlers ───────────────────────────────────── */

  function handleAddRecipient() {
    if (!address || !budget) return;
    if (isWrongChain) { switchChain({ chainId: TARGET_CHAIN_ID }); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(newRecipAddr)) { toast.error('Invalid recipient address'); return; }
    addRecipientTx({
      address: BUDGET_GATE_ADDRESS, abi: BUDGET_GATE_ABI, functionName: 'addRecipient',
      args: [budgetIdHex as `0x${string}`, newRecipAddr as `0x${string}`, parseUnits(newRecipAlloc, USDC_DECIMALS)],
    }, {
      onSuccess: (tx) => {
        void fetch('/api/recipients', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget_id_hex: budgetIdHex, recipient_address: newRecipAddr, allocation: newRecipAlloc, label: newRecipLabel, added_tx_hash: tx }),
        });
      },
      onError: (e) => toast.error('Add recipient failed: ' + e.message),
    });
  }

  function handleAttest() {
    if (!address || !budget) return;
    if (isWrongChain) { switchChain({ chainId: TARGET_CHAIN_ID }); return; }
    const earnedRaw = parseUnits(attestEarned, USDC_DECIMALS);
    const nonce     = BigInt(attestNonce);
    const sigHash = keccak256(encodePacked(
      ['bytes32', 'address', 'uint256', 'uint256', 'address', 'uint256'],
      [budgetIdHex as `0x${string}`, attestRecip as `0x${string}`, earnedRaw, nonce, BUDGET_GATE_ADDRESS as `0x${string}`, BigInt(TARGET_CHAIN_ID)],
    ));
    void sigHash;
    attestTx({
      address: BUDGET_GATE_ADDRESS, abi: BUDGET_GATE_ABI, functionName: 'submitAttestation',
      args: [budgetIdHex as `0x${string}`, attestRecip as `0x${string}`, earnedRaw, nonce, '0x'],
    }, {
      onSuccess: (tx) => {
        void fetch('/api/attestations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ budget_id_hex: budgetIdHex, recipient_address: attestRecip, new_earned: attestEarned, attestation_nonce: Number(nonce), attester_address: address, tx_hash: tx, idempotency_key: `${budgetIdHex}-${attestRecip}-${nonce}` }),
        });
      },
      onError: (e) => toast.error('Attestation failed: ' + e.message),
    });
  }

  function handleReclaim() {
    if (!address) return;
    if (isWrongChain) { switchChain({ chainId: TARGET_CHAIN_ID }); return; }
    reclaimTx({
      address: BUDGET_GATE_ADDRESS, abi: BUDGET_GATE_ABI, functionName: 'reclaimUnspent',
      args: [budgetIdHex as `0x${string}`],
    }, {
      onError: (e) => toast.error('Reclaim failed: ' + e.message),
    });
  }

  /* ── Loading / error states ─────────────────────── */

  if (loading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="h-8 w-32 rounded-lg animate-pulse" style={{ background: 'var(--surface-muted)' }} />
      <div className="card h-48 animate-pulse" style={{ background: 'var(--surface-muted)' }} />
      <div className="card h-64 animate-pulse" style={{ background: 'var(--surface-muted)' }} />
    </div>
  );

  if (error || !budget) return (
    <div className="max-w-xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-75" style={{ color: 'var(--muted)' }}>
        <ArrowLeft className="size-4" /> Back
      </button>
      <InlineAlert kind="error">
        <AlertCircle className="size-4 flex-shrink-0" aria-hidden />
        {error || 'Budget not found'}
      </InlineAlert>
    </div>
  );

  /* ── Computed values ────────────────────────────── */

  const total     = parseFloat(budget.total_amount || '0');
  const earned    = parseFloat(budget.total_earned || '0');
  const withdrawn = parseFloat(budget.total_withdrawn || '0');
  const unearned  = total - earned;
  const pct       = total > 0 ? Math.min(100, (earned / total) * 100) : 0;
  const effectiveState = now < budget.start_time ? 'open' : now < budget.end_time ? 'active' : 'closed';

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const addTxPhase     = addPending ? 'wallet-prompt' as const : addConfirming ? 'confirming' as const : null;
  const attestTxPhase  = attestPending ? 'wallet-prompt' as const : attestConfirming ? 'confirming' as const : null;
  const reclaimTxPhase = reclaimPending ? 'wallet-prompt' as const : reclaimConfirming ? 'confirming' as const : null;

  /* ── Render ─────────────────────────────────────── */

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back + title row */}
      <div className="flex items-center gap-3 mb-7">
        <Btn variant="ghost" size="sm" onClick={onBack} aria-label="Back to dashboard">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Btn>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <h1 className="display font-bold text-xl truncate" style={{ color: 'var(--ink)' }}>
            {budget.name || 'Unnamed Budget'}
          </h1>
          <StatePill state={effectiveState} />
        </div>
        <Btn variant="ghost" size="sm" onClick={load} aria-label="Refresh">
          <RefreshCw className="size-4" aria-hidden />
        </Btn>
      </div>

      {budget.description && (
        <p className="text-sm mb-6 -mt-4" style={{ color: 'var(--muted)' }}>{budget.description}</p>
      )}

      {/* Main 2-col grid */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">

        {/* Left: primary metrics */}
        <div className="lg:col-span-2 card p-7">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Total Budget</p>
              <p className="display font-bold tabular-nums" style={{ color: 'var(--ink)', fontSize: '2.5rem', lineHeight: 1.1 }}>
                {fmt(total)}
                <span className="text-xl font-semibold ml-2" style={{ color: 'var(--muted)' }}>USDC</span>
              </p>
            </div>
            {budget.tx_hash && (
              <a
                href={buildTxExplorerUrl(TARGET_CHAIN_ID, budget.tx_hash)}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-75"
                style={{ color: 'var(--accent-hover)' }}
              >
                <ExternalLink className="size-3" aria-hidden /> View tx
              </a>
            )}
          </div>

          {/* Progress */}
          <ProgressBar
            pct={pct}
            color={effectiveState === 'active' ? 'var(--success)' : 'var(--subtle)'}
            label="Earned of total"
            sublabel={`${pct.toFixed(1)}%`}
          />

          {/* Three metric cells */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[
              { label: 'Earned',    value: fmt(earned),    color: 'var(--success)',      sub: 'by attestations' },
              { label: 'Withdrawn', value: fmt(withdrawn), color: 'var(--accent-hover)', sub: 'by recipients'   },
              { label: 'Unearned',  value: fmt(unearned),  color: 'var(--muted)',        sub: 'reclaimable'     },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="card-inner rounded-xl p-4">
                <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
                <p className="font-bold tabular-nums text-base leading-none" style={{ color }}>
                  {value}<span className="text-xs font-normal ml-0.5">USDC</span>
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: info + actions */}
        <div className="flex flex-col gap-5">
          {/* Info */}
          <div className="card p-5 flex flex-col gap-3">
            <h3 className="font-semibold text-sm pb-2 border-b" style={{ color: 'var(--ink)', borderColor: 'var(--border)' }}>
              Budget Info
            </h3>
            <InfoRow label="Period start"  value={new Date(budget.start_time * 1000).toLocaleString()} />
            <InfoRow label="Period end"    value={new Date(budget.end_time   * 1000).toLocaleString()} />
            <InfoRow label="Attester"      value={`${budget.attester_address.slice(0,8)}…${budget.attester_address.slice(-6)}`} mono />
            <InfoRow label="Contract"      value={`${BUDGET_GATE_ADDRESS.slice(0,8)}…${BUDGET_GATE_ADDRESS.slice(-6)}`} mono />
          </div>

          {/* Owner actions */}
          {isOwner && (
            <div className="card p-5 flex flex-col gap-3">
              <h3 className="font-semibold text-xs uppercase tracking-wider pb-2 border-b" style={{ color: 'var(--muted)', borderColor: 'var(--border)', letterSpacing: '0.07em' }}>
                Owner Actions
              </h3>
              <Btn
                variant="primary" size="sm" fullWidth
                disabled={effectiveState === 'closed'}
                onClick={() => setShowAddRecipient(v => !v)}
              >
                <Plus className="size-3.5" aria-hidden />
                {showAddRecipient ? 'Cancel' : 'Add Recipient'}
              </Btn>
              {effectiveState === 'closed' && (
                <Btn
                  variant="secondary" size="sm" fullWidth
                  loading={reclaimPending || reclaimConfirming}
                  onClick={handleReclaim}
                >
                  <TrendingUp className="size-3.5" aria-hidden />
                  Reclaim Unearned
                </Btn>
              )}
              {reclaimTxPhase && <TxStatus phase={reclaimTxPhase} />}
            </div>
          )}

          {/* Attester actions */}
          {isAttester && effectiveState === 'active' && (
            <div className="card p-5 flex flex-col gap-3">
              <h3 className="font-semibold text-xs uppercase tracking-wider pb-2 border-b" style={{ color: 'var(--muted)', borderColor: 'var(--border)', letterSpacing: '0.07em' }}>
                Attester Actions
              </h3>
              <Btn
                size="sm" fullWidth
                style={{ background: 'var(--accent-hover)', color: '#fff' }}
                onClick={() => setShowAttest(v => !v)}
              >
                <Zap className="size-3.5" aria-hidden />
                {showAttest ? 'Cancel' : 'Submit Attestation'}
              </Btn>
              {attestTxPhase && <TxStatus phase={attestTxPhase} />}
            </div>
          )}
        </div>
      </div>

      {/* Add recipient panel */}
      {showAddRecipient && (
        <div className="card p-6 mb-5" role="region" aria-label="Add recipient form">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>Add Recipient</h3>
            <Btn variant="ghost" size="xs" onClick={() => setShowAddRecipient(false)}>
              <ChevronUp className="size-4" aria-hidden />
            </Btn>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Wallet Address</label>
              <input
                value={newRecipAddr} onChange={e => setNewRecipAddr(e.target.value)}
                placeholder="0x…" className="input-base mono w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Allocation (USDC)</label>
              <div className="relative">
                <input
                  inputMode="decimal" value={newRecipAlloc}
                  onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setNewRecipAlloc(v); }}
                  placeholder="0.00"
                  className="input-base display w-full rounded-xl px-4 py-3 text-xl font-bold tabular-nums pr-16"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Label (optional)</label>
              <input
                value={newRecipLabel} onChange={e => setNewRecipLabel(e.target.value)}
                placeholder="e.g. Backend API team"
                className="input-base w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </div>
          </div>
          {addTxPhase && <TxStatus phase={addTxPhase} className="mb-3" />}
          <Btn
            variant="primary" size="sm"
            loading={addPending || addConfirming}
            onClick={handleAddRecipient}
          >
            Add Recipient Onchain
          </Btn>
        </div>
      )}

      {/* Attestation panel */}
      {showAttest && (
        <div className="card p-6 mb-5" role="region" aria-label="Submit attestation form">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold" style={{ color: 'var(--ink)' }}>Submit Usage Attestation</h3>
            <Btn variant="ghost" size="xs" onClick={() => setShowAttest(false)}>
              <ChevronUp className="size-4" aria-hidden />
            </Btn>
          </div>
          <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--muted)' }}>
            Submit a signed proof of what a recipient has earned (cumulative, monotonically increasing).
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Recipient</label>
              <select
                value={attestRecip} onChange={e => setAttestRecip(e.target.value)}
                className="input-base w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              >
                <option value="">Select recipient</option>
                {budget.recipients?.map(r => (
                  <option key={r.recipient_address} value={r.recipient_address}>
                    {r.label || `${r.recipient_address.slice(0,8)}…${r.recipient_address.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Cumulative Earned (USDC)</label>
              <div className="relative">
                <input
                  inputMode="decimal" value={attestEarned}
                  onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setAttestEarned(v); }}
                  placeholder="0.00"
                  className="input-base display w-full rounded-xl px-4 py-3 text-xl font-bold tabular-nums pr-16"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Nonce (strictly increasing)</label>
              <input
                inputMode="numeric" value={attestNonce} onChange={e => setAttestNonce(e.target.value)}
                className="input-base w-full rounded-xl px-4 py-3 text-sm tabular-nums"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </div>
          </div>
          <InlineAlert kind="info" className="mb-4">
            The connected wallet must be the attester ({budget.attester_address.slice(0,10)}…).
            In production, the attester backend signs the message offline.
          </InlineAlert>
          {attestTxPhase && <TxStatus phase={attestTxPhase} className="mb-3" />}
          <Btn
            size="sm"
            style={{ background: 'var(--accent-hover)', color: '#fff' }}
            loading={attestPending || attestConfirming}
            disabled={!attestRecip || !attestEarned}
            onClick={() => handleAttest()}
          >
            <Zap className="size-3.5" aria-hidden />
            Submit Attestation
          </Btn>
        </div>
      )}

      {/* Recipients table */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-5">
          <Users className="size-4" style={{ color: 'var(--muted)' }} aria-hidden />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            Recipients
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--subtle)' }}>
              ({budget.recipients?.length || 0})
            </span>
          </h3>
        </div>
        {!budget.recipients?.length ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>
            No recipients yet.{isOwner ? ' Use "Add Recipient" above.' : ''}
          </p>
        ) : (
          <div className="space-y-2">
            {budget.recipients.map(r => (
              <RecipientRow
                key={r.recipient_address}
                r={r}
                budgetIdHex={budgetIdHex}
                effectiveState={effectiveState}
              />
            ))}
          </div>
        )}
      </div>

      {/* Activity log */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="size-4" style={{ color: 'var(--muted)' }} aria-hidden />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Activity Log</h3>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>No activity yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {activity.map(a => <ActivityRow key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{label}</span>
      <span
        className={`text-xs font-medium text-right ${mono ? 'mono' : ''}`}
        style={{ color: 'var(--ink-2)', wordBreak: 'break-all' }}
      >
        {value}
      </span>
    </div>
  );
}

function RecipientRow({ r, budgetIdHex, effectiveState }: { r: RecipientRecord; budgetIdHex: string; effectiveState: string }) {
  const { address, chainId } = useAccount();
  const { switchChain }      = useSwitchChain();
  const [expanded, setExpanded] = useState(false);

  const { writeContract: withdrawTx, data: withdrawHash, isPending: withdrawPending } = useWriteContract();
  const { isLoading: withdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  const isMe      = address?.toLowerCase() === r.recipient_address.toLowerCase();
  const earned    = parseFloat(r.earned    || '0');
  const withdrawn = parseFloat(r.withdrawn || '0');
  const allocated = parseFloat(r.allocation || '0');
  const available = Math.max(0, earned - withdrawn);
  const allocPct  = allocated > 0 ? Math.min(100, (earned / allocated) * 100) : 0;
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const canWithdraw = isMe && available > 0 && (effectiveState === 'active' || effectiveState === 'closed');
  const txPhase     = withdrawPending ? 'wallet-prompt' as const : withdrawConfirming ? 'confirming' as const : withdrawSuccess ? 'success' as const : null;

  function handleWithdraw() {
    if (chainId !== 5042002) { switchChain({ chainId: 5042002 }); return; }
    withdrawTx({
      address: BUDGET_GATE_ADDRESS, abi: BUDGET_GATE_ABI, functionName: 'withdraw',
      args: [budgetIdHex as `0x${string}`],
    }, {
      onSuccess: () => {
        toast.success('Withdrawal successful!');
        void fetch(`/api/recipients/${budgetIdHex}/${r.recipient_address}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ earned: r.earned, withdrawn: (withdrawn + available).toFixed(6) }),
        });
      },
      onError: (e) => toast.error('Withdraw failed: ' + e.message),
    });
  }

  return (
    <div
      className="rounded-2xl p-4 transition-colors"
      style={{
        background: isMe ? 'rgba(16,97,166,0.04)' : 'var(--surface-muted)',
        border: `1px solid ${isMe ? 'rgba(16,97,166,0.18)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>
              {r.recipient_address.slice(0,10)}…{r.recipient_address.slice(-6)}
            </span>
            {isMe && (
              <span className="badge" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-hover)' }}>
                You
              </span>
            )}
            {r.label && <span className="text-xs" style={{ color: 'var(--muted)' }}>{r.label}</span>}
          </div>

          {/* Compact metrics */}
          <div className="flex items-center gap-3 flex-wrap text-xs mt-1">
            <span style={{ color: 'var(--muted)' }}>
              Allocated <strong style={{ color: 'var(--ink-2)' }}>{fmt(allocated)}</strong>
            </span>
            <span style={{ color: 'var(--muted)' }}>
              Earned <strong style={{ color: 'var(--success)' }}>{fmt(earned)}</strong>
            </span>
            {available > 0 && (
              <span style={{ color: 'var(--muted)' }}>
                Available <strong style={{ color: 'var(--accent-hover)' }}>{fmt(available)}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canWithdraw && (
            <Btn
              variant="success" size="sm"
              loading={withdrawPending || withdrawConfirming}
              onClick={handleWithdraw}
            >
              Withdraw {fmt(available)} USDC
            </Btn>
          )}
          <Btn variant="ghost" size="xs" onClick={() => setExpanded(v => !v)} aria-label="Toggle details">
            {expanded ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
          </Btn>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <ProgressBar pct={allocPct} color="var(--success)" />
      </div>

      {/* TX status */}
      {txPhase && <div className="mt-3"><TxStatus phase={txPhase} /></div>}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-xs" style={{ borderColor: 'var(--border)' }}>
          <div style={{ color: 'var(--muted)' }}>Withdrawn</div>
          <div className="font-semibold tabular-nums text-right" style={{ color: 'var(--ink-2)' }}>{fmt(withdrawn)} USDC</div>
          <div style={{ color: 'var(--muted)' }}>Utilization</div>
          <div className="font-semibold text-right" style={{ color: 'var(--ink-2)' }}>{allocPct.toFixed(1)}%</div>
          <div style={{ color: 'var(--muted)' }}>Full address</div>
          <div className="mono break-all text-right" style={{ color: 'var(--ink-2)' }}>{r.recipient_address}</div>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ a }: { a: ActivityRecord }) {
  const LABELS: Record<string, { label: string; color: string }> = {
    budget_created:       { label: 'Budget gate created',   color: 'var(--accent-hover)' },
    recipient_added:      { label: 'Recipient added',        color: 'var(--ink-2)'        },
    attestation_submitted:{ label: 'Attestation submitted',  color: 'var(--success)'      },
    withdrawn:            { label: 'Withdrawal',             color: 'var(--accent-hover)' },
    unspent_reclaimed:    { label: 'Unspent funds reclaimed',color: 'var(--muted)'        },
  };
  const { label, color } = LABELS[a.event_type] ?? { label: a.event_type, color: 'var(--muted)' };

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="size-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
          {new Date(a.created_at).toLocaleString()}
        </p>
      </div>
      {a.tx_hash && (
        <a
          href={buildTxExplorerUrl(5042002, a.tx_hash)}
          target="_blank" rel="noreferrer"
          aria-label="View transaction"
          className="flex-shrink-0 transition-opacity hover:opacity-70"
        >
          <ExternalLink className="size-3.5" style={{ color: 'var(--muted)' }} />
        </a>
      )}
    </div>
  );
}
