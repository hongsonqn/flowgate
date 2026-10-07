import type { ReactNode } from 'react';
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from 'wagmi';
import { erc20Abi, keccak256, encodePacked, parseUnits } from 'viem';
import { Plus, Trash2, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts';
import { BUDGET_GATE_ADDRESS, BUDGET_GATE_ABI } from '../contracts/BudgetGate';
import type { RecipientInput } from '../types';
import { Btn, TxStatus, InlineAlert } from './ui';

const TARGET_CHAIN_ID = 5042002;
const usdcFact    = getUsdc(TARGET_CHAIN_ID)!;
const USDC_ADDRESS  = usdcFact.address as `0x${string}`;
const USDC_DECIMALS = usdcFact.decimals;

interface CreateBudgetProps {
  onCreated: (budgetIdHex: string) => void;
}

type Step = 'form' | 'approve' | 'create' | 'success';

/* ── Step indicator ─────────────────────────────────────── */

const STEPS = [
  { id: 'form',    label: 'Details'  },
  { id: 'approve', label: 'Approve'  },
  { id: 'create',  label: 'Confirm'  },
  { id: 'success', label: 'Done'     },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <nav aria-label="Budget creation steps" className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done    = i < idx;
        const active  = i === idx;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div
                className="size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: done    ? 'var(--success)'       :
                               active ? 'var(--accent)'        : 'var(--surface-muted)',
                  color:      done    ? '#fff'                  :
                               active ? '#fff'                  : 'var(--subtle)',
                  border:     active  ? 'none'                  : '1px solid var(--border)',
                }}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <CheckCircle2 className="size-3.5" aria-hidden /> : i + 1}
              </div>
              <span
                className="text-xs font-medium hidden sm:block"
                style={{ color: active ? 'var(--ink)' : 'var(--subtle)' }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-2 mb-4"
                style={{ background: done ? 'var(--success)' : 'var(--border)' }}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* ── Main component ─────────────────────────────────────── */

export function CreateBudget({ onCreated }: CreateBudgetProps) {
  const { address, chainId } = useAccount();
  const { switchChain }      = useSwitchChain();

  const [step,         setStep]         = useState<Step>('form');
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [totalAmount,  setTotalAmount]  = useState('');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');
  const [attester,     setAttester]     = useState('');
  const [recipients,   setRecipients]   = useState<RecipientInput[]>([{ address: '', allocation: '', label: '' }]);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [budgetIdHex,  setBudgetIdHex]  = useState('');
  const [successTxHash, setSuccessTxHash] = useState('');

  const isWrongChain = chainId !== TARGET_CHAIN_ID;

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID, query: { enabled: !!address },
  });

  const formattedBalance = usdcBalance != null
    ? (Number(usdcBalance) / 10 ** USDC_DECIMALS).toFixed(2) : null;

  const { writeContract: approveUsdc, data: approveTxHash, isPending: isApprovePending } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: createBudget, data: createTxHash, isPending: isCreatePending } = useWriteContract();
  const { isLoading: isCreateConfirming } = useWaitForTransactionReceipt({ hash: createTxHash });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim())                                    errs.name        = 'Name is required';
    if (!totalAmount || isNaN(parseFloat(totalAmount)) || parseFloat(totalAmount) <= 0)
                                                          errs.totalAmount = 'Enter a valid USDC amount';
    if (!startDate)                                       errs.startDate   = 'Start date required';
    if (!endDate)                                         errs.endDate     = 'End date required';
    if (startDate && endDate && new Date(startDate) >= new Date(endDate))
                                                          errs.endDate     = 'End must be after start';
    if (startDate && new Date(startDate) <= new Date())   errs.startDate   = 'Start must be in the future';
    if (!attester || !/^0x[0-9a-fA-F]{40}$/.test(attester))
                                                          errs.attester    = 'Enter a valid Ethereum address';

    const totalAlloc = recipients.reduce((s, r) => { const a = parseFloat(r.allocation); return s + (isNaN(a) ? 0 : a); }, 0);
    if (totalAlloc > parseFloat(totalAmount || '0'))
      errs.allocationSum = `Total allocation (${totalAlloc} USDC) exceeds budget (${totalAmount} USDC)`;

    recipients.forEach((r, i) => {
      if (r.address && !/^0x[0-9a-fA-F]{40}$/.test(r.address))
        errs[`recipient_${i}_address`] = 'Invalid address';
      if (r.address && (!r.allocation || isNaN(parseFloat(r.allocation)) || parseFloat(r.allocation) <= 0))
        errs[`recipient_${i}_allocation`] = 'Enter allocation';
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function computeBudgetId(ts: number): `0x${string}` {
    return keccak256(encodePacked(['address', 'string', 'uint256'], [address!, name, BigInt(ts)]));
  }

  function handleApprove() {
    if (!address)      { toast.error('Connect wallet first'); return; }
    if (isWrongChain)  { switchChain({ chainId: TARGET_CHAIN_ID }); return; }
    if (!validate())   return;

    setStep('approve');
    approveUsdc({
      address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve',
      args: [BUDGET_GATE_ADDRESS as `0x${string}`, parseUnits(totalAmount, USDC_DECIMALS)],
    }, {
      onSuccess: () => toast.success('Approval confirmed'),
      onError:   (e) => { toast.error('Approval failed: ' + e.message); setStep('form'); },
    });
  }

  function handleCreate() {
    if (!address) return;
    const newBudgetId = computeBudgetId(Date.now());
    setBudgetIdHex(newBudgetId);
    setStep('create');

    createBudget({
      address: BUDGET_GATE_ADDRESS, abi: BUDGET_GATE_ABI, functionName: 'createBudget',
      args: [
        newBudgetId,
        USDC_ADDRESS,
        parseUnits(totalAmount, USDC_DECIMALS),
        BigInt(Math.floor(new Date(startDate).getTime() / 1000)),
        BigInt(Math.floor(new Date(endDate).getTime() / 1000)),
        attester as `0x${string}`,
      ],
    }, {
      onSuccess: (txHash) => {
        setSuccessTxHash(txHash);
        void fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            budget_id_hex: newBudgetId, owner_address: address,
            attester_address: attester, usdc_token_address: USDC_ADDRESS,
            total_amount: totalAmount,
            start_time: Math.floor(new Date(startDate).getTime() / 1000),
            end_time:   Math.floor(new Date(endDate).getTime() / 1000),
            chain_id: TARGET_CHAIN_ID, contract_address: BUDGET_GATE_ADDRESS,
            tx_hash: txHash, name, description,
          }),
        });
        setStep('success');
        toast.success('Budget gate created!');
        onCreated(newBudgetId);
      },
      onError: (e) => { toast.error('Create failed: ' + e.message); setStep('form'); },
    });
  }

  // After approval confirmed, auto-proceed to create
  if (isApproveSuccess && step === 'approve') {
    handleCreate();
  }

  function addRecipient() { setRecipients([...recipients, { address: '', allocation: '', label: '' }]); }
  function removeRecipient(i: number) { setRecipients(recipients.filter((_, idx) => idx !== i)); }
  function updateRecipient(i: number, field: keyof RecipientInput, value: string) {
    setRecipients(recipients.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  /* ── Success screen ─────────────────────────────────── */
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto">
        <StepIndicator current="success" />
        <div className="card p-8 text-center">
          <div
            className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'var(--success-subtle)' }}
          >
            <CheckCircle2 className="size-8" style={{ color: 'var(--success)' }} />
          </div>
          <h2 className="display font-bold text-2xl mb-2" style={{ color: 'var(--ink)' }}>
            Budget Gate Created
          </h2>
          <p className="text-sm mb-6 text-pretty" style={{ color: 'var(--muted)', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
            Your USDC is locked in the contract. Add recipients — the period begins at the scheduled start time.
          </p>
          <div className="card-inner rounded-xl p-3 mb-5 text-left">
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>Budget ID</div>
            <div className="mono text-xs break-all leading-relaxed" style={{ color: 'var(--ink-2)' }}>{budgetIdHex}</div>
          </div>
          {successTxHash && (
            <a
              href={buildTxExplorerUrl(TARGET_CHAIN_ID, successTxHash)}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium mb-6 transition-opacity hover:opacity-75"
              style={{ color: 'var(--accent-hover)' }}
            >
              View on ArcScan <ExternalLink className="size-3" />
            </a>
          )}
          <Btn
            fullWidth
            variant="secondary"
            onClick={() => {
              setStep('form');
              setName(''); setDescription(''); setTotalAmount('');
              setStartDate(''); setEndDate(''); setAttester('');
              setRecipients([{ address: '', allocation: '', label: '' }]);
            }}
          >
            <RefreshCw className="size-4" />
            Create Another Budget
          </Btn>
        </div>
      </div>
    );
  }

  const isProcessing = step !== 'form' || isApprovePending || isApproveConfirming || isCreatePending || isCreateConfirming;

  /* ── TX status banner ───────────────────────────────── */
  const txPhase =
    isApprovePending  ? 'wallet-prompt' as const :
    isApproveConfirming ? 'confirming'  as const :
    isCreatePending   ? 'wallet-prompt' as const :
    isCreateConfirming  ? 'confirming'  as const : null;

  const txMessage =
    isApprovePending    ? 'Confirm USDC approval in your wallet…' :
    isApproveConfirming ? 'Waiting for approval to confirm…' :
    isCreatePending     ? 'Confirm budget creation in your wallet…' :
    isCreateConfirming  ? 'Waiting for budget creation to confirm…' : '';

  /* ── Main form ──────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto">
      <StepIndicator current={step} />

      <div className="mb-7">
        <h1 className="display font-bold text-2xl mb-1" style={{ color: 'var(--ink)' }}>
          Create Budget Gate
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Lock USDC and define who earns it by verified usage proof.
        </p>
      </div>

      {/* Wallet / chain alerts */}
      {!address && (
        <InlineAlert kind="warning" className="mb-5">
          Connect your wallet to create a budget gate.
        </InlineAlert>
      )}
      {isWrongChain && address && (
        <InlineAlert
          kind="error"
          className="mb-5"
          action={
            <Btn variant="danger-outline" size="xs" onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}>
              Switch
            </Btn>
          }
        >
          Switch to Arc Testnet to continue.
        </InlineAlert>
      )}

      <div className="space-y-5">
        {/* Budget details */}
        <section className="card p-6" aria-labelledby="section-details">
          <h2 id="section-details" className="font-semibold text-sm mb-5" style={{ color: 'var(--ink)' }}>
            Budget Details
          </h2>
          <div className="space-y-4">
            <Field label="Budget Name" error={errors.name} required>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Q4 API Credits Budget"
                className="input-base w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </Field>

            <Field label="Description (optional)">
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What is this budget for?"
                rows={2}
                className="input-base w-full rounded-xl px-4 py-3 text-sm resize-none"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </Field>

            <Field
              label="Total USDC Amount"
              error={errors.totalAmount}
              hint={formattedBalance != null ? `Your balance: ${formattedBalance} USDC` : undefined}
              required
            >
              <div className="relative">
                <input
                  inputMode="decimal" value={totalAmount}
                  onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setTotalAmount(v); }}
                  placeholder="0.00"
                  className="input-base display w-full rounded-xl px-4 py-3 text-3xl font-bold tabular-nums pr-20"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                  USDC
                </span>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Time" error={errors.startDate} required>
                <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="input-base w-full rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
              </Field>
              <Field label="End Time" error={errors.endDate} required>
                <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="input-base w-full rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
              </Field>
            </div>

            <Field
              label="Attester Address"
              error={errors.attester}
              hint="The wallet authorized to submit usage proofs. Can be you, an agent, or a backend."
              required
            >
              <input
                value={attester} onChange={e => setAttester(e.target.value)}
                placeholder="0x…"
                className="input-base mono w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
              {address && (
                <button
                  type="button"
                  onClick={() => setAttester(address)}
                  className="mt-1.5 text-xs font-semibold transition-opacity hover:opacity-75 focus-visible:outline-none"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  Use my wallet as attester
                </button>
              )}
            </Field>
          </div>
        </section>

        {/* Recipients */}
        <section className="card p-6" aria-labelledby="section-recipients">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 id="section-recipients" className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                Recipients
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Optional — you can also add recipients after creation.
              </p>
            </div>
            <Btn variant="secondary" size="xs" onClick={addRecipient}>
              <Plus className="size-3.5" aria-hidden /> Add
            </Btn>
          </div>

          {errors.allocationSum && (
            <InlineAlert kind="error" className="mb-4">{errors.allocationSum}</InlineAlert>
          )}

          <div className="space-y-3">
            {recipients.map((r, i) => (
              <div key={i} className="card-inner rounded-2xl p-4">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 mb-3">
                  <input
                    value={r.address} onChange={e => updateRecipient(i, 'address', e.target.value)}
                    placeholder="Recipient wallet 0x…"
                    className="input-base mono rounded-xl px-3 py-2.5 text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                    aria-label={`Recipient ${i + 1} wallet address`}
                  />
                  <div className="relative">
                    <input
                      inputMode="decimal" value={r.allocation}
                      onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) updateRecipient(i, 'allocation', v); }}
                      placeholder="0.00"
                      className="input-base w-28 rounded-xl px-3 py-2.5 text-xs tabular-nums pr-12"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                      aria-label={`Recipient ${i + 1} allocation`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted)' }}>USDC</span>
                  </div>
                  <Btn
                    variant="ghost" size="xs"
                    onClick={() => removeRecipient(i)}
                    disabled={recipients.length === 1}
                    aria-label={`Remove recipient ${i + 1}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Btn>
                </div>
                <input
                  value={r.label} onChange={e => updateRecipient(i, 'label', e.target.value)}
                  placeholder="Label (optional — e.g. Backend API service)"
                  className="input-base w-full rounded-xl px-3 py-2.5 text-xs"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  aria-label={`Recipient ${i + 1} label`}
                />
                {(errors[`recipient_${i}_address`] || errors[`recipient_${i}_allocation`]) && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>
                    {errors[`recipient_${i}_address`] ?? errors[`recipient_${i}_allocation`]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* TX status banner */}
        {txPhase && <TxStatus phase={txPhase} message={txMessage} />}

        {/* CTA */}
        <Btn
          fullWidth
          variant="primary"
          size="lg"
          loading={isProcessing && step !== 'form'}
          disabled={!address || isProcessing}
          onClick={handleApprove}
        >
          {!address
            ? 'Connect Wallet First'
            : isWrongChain
            ? 'Switch to Arc Testnet'
            : isProcessing
            ? (step === 'approve' ? 'Approving USDC…' : 'Creating Budget…')
            : `Approve & Create  —  ${totalAmount || '0'} USDC`}
        </Btn>

        <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
          Two wallet transactions: USDC approval + budget creation. Gas paid in USDC on Arc.
        </p>
      </div>
    </div>
  );
}

/* ── Field helper ───────────────────────────────────────── */

function Field({ label, children, error, hint, required }: {
  label: string; children: ReactNode; error?: string; hint?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
        {label}
        {required && <span aria-hidden style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--subtle)' }}>{hint}</p>}
      {error && <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
    </div>
  );
}
