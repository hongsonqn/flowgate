import { ShieldCheck, Zap, TrendingUp, ArrowRight, Lock, Users, RotateCcw } from 'lucide-react';
import { ConnectKitButton } from 'connectkit';

interface LandingHeroProps {
  onNavigate: (view: string) => void;
}

export function LandingHero({ onNavigate }: LandingHeroProps) {
  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Hero section ──────────────────────────────────────── */}
      <section className="text-center pt-12 pb-20 px-4" aria-label="Hero">

        {/* Network badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8 border"
          style={{ background: 'rgba(18,45,69,0.05)', color: 'var(--accent)', borderColor: 'var(--border)' }}
        >
          <span className="dot-live" aria-hidden />
          Live on Arc Testnet · USDC gas · sub-second finality
        </div>

        <h1
          className="display font-bold text-balance mb-6"
          style={{ color: 'var(--ink)', fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.1, letterSpacing: '-0.03em' }}
        >
          Budget that pays<br />
          <span style={{ color: 'var(--accent-hover)' }}>as it's earned.</span>
        </h1>

        <p
          className="text-lg md:text-xl max-w-xl mx-auto mb-10 text-pretty leading-relaxed"
          style={{ color: 'var(--ink-2)' }}
        >
          Lock USDC once. Set an authorized attester. Recipients earn as they
          deliver — no approvals, no batch runs. Unspent funds return at period end.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <button
            onClick={() => onNavigate('create')}
            className="btn btn-primary px-7 py-3 text-base"
          >
            Create a Budget Gate
            <ArrowRight className="size-5" aria-hidden />
          </button>
          <ConnectKitButton label="Connect Wallet" />
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs" style={{ color: 'var(--muted)' }}>
          {[
            { icon: ShieldCheck, text: 'No admin keys' },
            { icon: Lock,        text: 'Funds locked in contract' },
            { icon: Zap,         text: 'ECDSA-verified attestations' },
            { icon: RotateCcw,   text: 'Unused funds auto-return' },
          ].map(({ icon: Icon, text }) => (
            <span key={text} className="flex items-center gap-1.5">
              <Icon className="size-3.5 flex-shrink-0" aria-hidden />
              {text}
            </span>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="mb-16" aria-labelledby="how-it-works-heading">
        <h2
          id="how-it-works-heading"
          className="display font-bold text-center mb-8"
          style={{ color: 'var(--ink)', fontSize: '1.5rem' }}
        >
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              step: '01',
              icon: Lock,
              title: 'Lock USDC once',
              desc: 'Fund a named budget with USDC for a defined period. Funds are locked in the contract — not held by anyone.',
              color: 'var(--accent)',
              bg:    'var(--accent-subtle)',
            },
            {
              step: '02',
              icon: Zap,
              title: 'Attestations trigger release',
              desc: "Your authorized attester submits signed usage proofs. Each proof advances a recipient's earned balance — no human approval.",
              color: 'var(--accent-hover)',
              bg:    'var(--accent-subtle)',
            },
            {
              step: '03',
              icon: TrendingUp,
              title: "Pull earned, reclaim what's left",
              desc: "Recipients withdraw earned USDC any time. At period end, you reclaim every unearned cent — automatically.",
              color: 'var(--success)',
              bg:    'var(--success-subtle)',
            },
          ].map(({ step, icon: Icon, title, desc, color, bg }) => (
            <div
              key={step}
              className="card p-7 flex flex-col"
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}
                >
                  <Icon className="size-5" style={{ color }} aria-hidden />
                </div>
                <span className="display font-bold text-3xl tabular-nums leading-none mt-0.5" style={{ color: 'var(--border-strong)', letterSpacing: '-0.04em' }}>
                  {step}
                </span>
              </div>
              <h3 className="display font-semibold text-base mb-2" style={{ color: 'var(--ink)' }}>{title}</h3>
              <p className="text-sm text-pretty leading-relaxed" style={{ color: 'var(--ink-2)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Use cases ─────────────────────────────────────────── */}
      <section
        className="card p-8 mb-12"
        aria-labelledby="use-cases-heading"
      >
        <h2
          id="use-cases-heading"
          className="display font-bold text-xl mb-6 text-center"
          style={{ color: 'var(--ink)' }}
        >
          Works for any usage-to-payment workflow
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'API billing',        detail: 'Pay per verified call batch'     },
            { label: 'Contractor work',    detail: 'Pay per attested deliverable'    },
            { label: 'DAO grants',         detail: 'Continuous contributor drip'     },
            { label: 'SLA payouts',        detail: 'Pay on uptime proofs'            },
            { label: 'Compute credits',    detail: 'Pay per GPU-hour attestation'    },
            { label: 'Agent services',     detail: 'Autonomous agent earnings'       },
            { label: 'Content creation',   detail: 'Pay per verified publish'        },
            { label: 'Partner revenue',    detail: 'Verified referral payouts'       },
          ].map(({ label, detail }) => (
            <div
              key={label}
              className="card-inner rounded-xl p-4 transition-colors hover:border-opacity-50"
            >
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>{label}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mechanism differentiation ─────────────────────────── */}
      <section
        className="rounded-3xl p-8 mb-12 border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
        aria-labelledby="mechanism-heading"
      >
        <div className="max-w-3xl">
          {/* Comparison chips */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { label: 'Escrow',    sub: 'waits for human approval', strike: true },
              { label: 'Streaming', sub: 'pays by time elapsed',     strike: true },
              { label: 'FlowGate', sub: 'pays by verified usage',   strike: false },
            ].map(({ label, sub, strike }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm"
                style={{
                  background: strike ? 'transparent' : 'var(--accent-subtle)',
                  borderColor: strike ? 'var(--border)' : 'var(--border-strong)',
                  color: strike ? 'var(--subtle)' : 'var(--accent-hover)',
                  textDecoration: strike ? 'line-through' : 'none',
                  opacity: strike ? 0.7 : 1,
                }}
              >
                <span className="font-semibold">{label}</span>
                <span className="text-xs opacity-75">{sub}</span>
              </div>
            ))}
          </div>

          <h3 id="mechanism-heading" className="display font-bold text-lg mb-3" style={{ color: 'var(--ink)' }}>
            Not escrow. Not streaming. A new mechanism.
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            Traditional escrow waits for a human to approve release. Streaming pays by time elapsed.
            FlowGate pays by <em>verified usage</em> — the attester signs a proof of what was
            actually delivered, and the contract releases only that amount. Funds are locked once,
            earned incrementally by proof, and any unused amount returns to the owner when the period
            closes. No one holds your money. No polling. No batch processing.
          </p>
        </div>
      </section>

      {/* ── CTA footer ────────────────────────────────────────── */}
      <section className="card p-10 text-center mb-4" aria-label="Get started">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Users className="size-6" style={{ color: 'var(--muted)' }} aria-hidden />
        </div>
        <h2 className="display font-bold text-2xl mb-3" style={{ color: 'var(--ink)' }}>
          Ready to create your first budget gate?
        </h2>
        <p className="text-sm mb-7 max-w-md mx-auto text-pretty" style={{ color: 'var(--muted)' }}>
          It takes two transactions — USDC approval and budget creation.
          Gas is paid in USDC. No ETH needed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('create')}
            className="btn btn-primary px-7 py-3 text-sm"
          >
            Create a Budget Gate
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            onClick={() => onNavigate('docs')}
            className="btn btn-secondary px-7 py-3 text-sm"
          >
            How it works
          </button>
        </div>
      </section>

    </div>
  );
}
