import { ShieldCheck, Zap, TrendingUp, Code, Clock, ArrowRight } from 'lucide-react';

export function HowItWorks() {
  const glass = {
    card: {
      background: 'var(--surface)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--border)',
    } as React.CSSProperties,
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="display font-bold text-2xl mb-2" style={{ color: 'var(--ink)' }}>
        How FlowGate Works
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
        A programmable budget authorization system built on Arc Testnet.
      </p>

      {/* State machine */}
      <div className="rounded-3xl p-6 mb-6" style={glass.card}>
        <h2 className="font-bold text-base mb-4" style={{ color: 'var(--ink)' }}>Budget State Machine</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {['OPEN', 'ACTIVE', 'CLOSED'].map((state, i) => (
            <div key={state} className="flex items-center gap-3">
              <div
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: state === 'ACTIVE' ? 'var(--success-subtle)' : 'var(--surface-muted)',
                  color: state === 'ACTIVE' ? 'var(--success)' : 'var(--ink)',
                }}
              >
                {state}
              </div>
              {i < 2 && <ArrowRight className="size-4" style={{ color: 'var(--muted)' }} />}
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-sm" style={{ color: 'var(--ink-2)' }}>
          <p><strong style={{ color: 'var(--ink)' }}>OPEN:</strong> Budget is funded, period hasn't started. Recipients can be added.</p>
          <p><strong style={{ color: 'var(--ink)' }}>ACTIVE:</strong> Period is running. Attestations can be submitted, recipients can withdraw earned amounts.</p>
          <p><strong style={{ color: 'var(--ink)' }}>CLOSED:</strong> Period ended. No new attestations. Owner can reclaim unearned funds. Recipients can still withdraw any outstanding earned balance.</p>
        </div>
      </div>

      {/* Key roles */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[
          {
            icon: ShieldCheck,
            role: 'Budget Owner',
            desc: 'Creates the budget gate, funds it with USDC, adds recipients, and reclaims unearned funds at period end.',
            actions: ['createBudget', 'addRecipient', 'reclaimUnspent'],
          },
          {
            icon: Zap,
            role: 'Attester',
            desc: 'An authorized address (could be you, an agent, or a backend) that submits ECDSA-signed usage proofs onchain.',
            actions: ['submitAttestation'],
          },
          {
            icon: TrendingUp,
            role: 'Recipient',
            desc: 'Earns USDC through verified attestations and can withdraw any time their earned balance exceeds withdrawn.',
            actions: ['withdraw'],
          },
        ].map(({ icon: Icon, role, desc, actions }) => (
          <div key={role} className="rounded-2xl p-5" style={glass.card}>
            <div
              className="size-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: 'var(--surface-muted)' }}
            >
              <Icon className="size-4" style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--ink)' }}>{role}</h3>
            <p className="text-xs mb-3" style={{ color: 'var(--ink-2)' }}>{desc}</p>
            <div className="space-y-1">
              {actions.map(a => (
                <span key={a} className="mono block text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}>
                  {a}()
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Attestation mechanism */}
      <div className="rounded-3xl p-6 mb-6" style={glass.card}>
        <div className="flex items-center gap-2 mb-4">
          <Code className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="font-bold text-base" style={{ color: 'var(--ink)' }}>Attestation Signature</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--ink-2)' }}>
          The attester signs a message off-chain (or your backend does) and submits it onchain. The contract verifies the ECDSA signature before advancing the recipient's earned balance.
        </p>
        <div
          className="mono rounded-xl p-4 text-xs overflow-x-auto"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
        >
          <pre>{`// Attester signs this message (off-chain)
const message = keccak256(encodePacked(
  ['bytes32',  'address',    'uint256',    'uint256',          'address',       'uint256'],
  [budgetId,   recipient,    newEarned,    attestationNonce,   contractAddress, chainId]
));
const sig = await attester.signMessage(message);

// Then calls:
await budgetGate.submitAttestation(
  budgetId, recipient, newEarned, nonce, sig
);`}</pre>
        </div>
        <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
          <strong>newEarned</strong> is cumulative (monotonically increasing). The nonce prevents replay attacks.
        </div>
      </div>

      {/* Security */}
      <div className="rounded-3xl p-6 mb-6" style={glass.card}>
        <h2 className="font-bold text-base mb-4" style={{ color: 'var(--ink)' }}>Security Properties</h2>
        <div className="space-y-3 text-sm" style={{ color: 'var(--ink-2)' }}>
          {[
            ['No admin keys', 'The contract has no owner, no upgrade function, and no pause mechanism. Once deployed, it is fully autonomous.'],
            ['Reentrancy protected', 'All state-changing functions with token transfers use OpenZeppelin\'s ReentrancyGuard.'],
            ['Monotonic earned', 'Attestations can only increase the earned amount. Replay and rollback are rejected by the nonce and value checks.'],
            ['No double-fund risk', 'Fee-on-transfer tokens are handled correctly: the contract measures the actual received amount.'],
            ['Owner can only reclaim unearned', 'reclaimUnspent returns only (totalAmount - totalEarned). Earned funds always belong to recipients.'],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-3">
              <div className="size-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--success-subtle)' }}>
                <ShieldCheck className="size-3" style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <strong style={{ color: 'var(--ink)' }}>{title}:</strong> {desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why Arc */}
      <div className="rounded-3xl p-6" style={{ ...glass.card, background: 'var(--surface-hover)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="size-4" style={{ color: 'var(--accent)' }} />
          <h2 className="font-bold text-base" style={{ color: 'var(--ink)' }}>Why Arc?</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 text-sm" style={{ color: 'var(--ink-2)' }}>
          <div>
            <strong style={{ color: 'var(--ink)' }}>USDC as gas</strong>
            <p className="text-xs mt-1">No ETH needed. You pay gas in USDC, the same token the contract holds. One asset, no bridging, no juggling.</p>
          </div>
          <div>
            <strong style={{ color: 'var(--ink)' }}>Sub-second finality</strong>
            <p className="text-xs mt-1">Attestations confirm in under a second. Recipients see their earned balance update almost instantly after the attester submits.</p>
          </div>
          <div>
            <strong style={{ color: 'var(--ink)' }}>Stable fees</strong>
            <p className="text-xs mt-1">USDC-denominated gas fees are predictable. Budget owners know exactly what each attestation costs before they set up the gate.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
