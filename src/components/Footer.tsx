import { useState } from 'react';
import { Github, Twitter, ExternalLink, ArrowRight, Mail, Shield, FileText, BookOpen, LayoutDashboard, Inbox, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { LogoMark, LogoWordmark } from './Logo';

interface FooterProps {
  onNavigate: (view: string) => void;
}

const YEAR = new Date().getFullYear();

const NAV_GROUPS = [
  {
    label: 'Product',
    links: [
      { label: 'Dashboard', view: 'dashboard', icon: LayoutDashboard },
      { label: 'Create Budget Gate', view: 'create', icon: Zap },
      { label: 'My Earnings', view: 'recipient', icon: Inbox },
      { label: 'How it works', view: 'docs', icon: BookOpen },
    ],
  },
  {
    label: 'Resources',
    links: [
      { label: 'How it works', view: 'docs', icon: BookOpen },
      { label: 'Contract on Explorer', href: 'https://explorer.testnet.arc.io/address/0xc841890e086a9611c3e141cd34369a4f5fed0122', icon: ExternalLink },
      { label: 'Arc Testnet Faucet', href: 'https://faucet.circle.com', icon: ExternalLink },
      { label: 'USDC on Arc', href: 'https://developers.circle.com/stablecoins/usdc-on-arc', icon: ExternalLink },
    ],
  },
  {
    label: 'Legal',
    links: [
      { label: 'Privacy Policy', view: 'privacy', icon: Shield },
      { label: 'Terms of Service', view: 'terms', icon: FileText },
    ],
  },
];

const SOCIAL_LINKS = [
  {
    label: 'GitHub',
    href: 'https://github.com',
    icon: Github,
  },
  {
    label: 'Twitter / X',
    href: 'https://x.com',
    icon: Twitter,
  },
];

export function Footer({ onNavigate }: FooterProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setSubscribed(true);
    setEmail('');
    toast.success("You're on the list — we'll be in touch.");
  }

  function handleLink(link: { view?: string; href?: string }) {
    if (link.href) {
      window.open(link.href, '_blank', 'noopener,noreferrer');
    } else if (link.view) {
      onNavigate(link.view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <footer
      className="w-full border-t"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}
      role="contentinfo"
      aria-label="Site footer"
    >
      {/* Top band — newsletter CTA */}
      <div
        className="border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left copy */}
          <div className="max-w-md">
            <p className="display font-bold text-base mb-1" style={{ color: 'var(--ink)' }}>
              Stay ahead of the protocol
            </p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Get notified on new features, mainnet launch, and developer updates. No spam — unsubscribe any time.
            </p>
          </div>

          {/* Newsletter form */}
          {subscribed ? (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(26,128,71,0.08)', color: 'var(--success)', border: '1px solid rgba(26,128,71,0.2)' }}
            >
              <Shield className="size-4" />
              Subscribed — thank you!
            </div>
          ) : (
            <form
              onSubmit={handleSubscribe}
              className="flex items-stretch gap-2 w-full md:w-auto"
              aria-label="Newsletter subscription"
            >
              <label htmlFor="footer-email" className="sr-only">Email address</label>
              <input
                id="footer-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="flex-1 md:w-64 px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--focus)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(133,177,237,0.20)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ background: 'var(--accent)', outlineColor: 'var(--focus)' }}
              >
                <Mail className="size-3.5" />
                <span className="hidden sm:inline">Subscribe</span>
                <ArrowRight className="size-3.5 sm:hidden" aria-hidden="true" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Main footer body */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand column — spans 2 on large */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <button
              onClick={() => { onNavigate('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-2 mb-4 group focus-visible:outline-none focus-visible:ring-2 rounded-xl transition-opacity hover:opacity-80"
              style={{ outlineColor: 'var(--focus)' }}
              aria-label="FlowGate home"
            >
              <LogoMark size={34} />
              <LogoWordmark size="lg" color="var(--ink)" />
            </button>

            {/* Tagline */}
            <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-2)', maxWidth: '300px' }}>
              Usage-triggered budget authorization on Arc Testnet. Lock USDC once. Pay as it's verified — not just promised.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="size-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
                  style={{
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    outlineColor: 'var(--focus)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--accent)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--surface-muted)';
                    e.currentTarget.style.color = 'var(--muted)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <Icon className="size-4" />
                </a>
              ))}

              {/* Contact email */}
              <a
                href="mailto:hello@flowgate.xyz"
                aria-label="Contact us by email"
                className="size-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2"
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  outlineColor: 'var(--focus)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface-muted)';
                  e.currentTarget.style.color = 'var(--muted)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                <Mail className="size-4" />
              </a>
            </div>
          </div>

          {/* Nav link groups */}
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <h3
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}
              >
                {group.label}
              </h3>
              <ul className="space-y-2.5" role="list">
                {group.links.map(link => (
                  <li key={link.label}>
                    <FooterLink link={link} onActivate={() => handleLink(link)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Copyright */}
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            © {YEAR} FlowGate. Built on{' '}
            <a
              href="https://arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:underline focus-visible:outline-none"
              style={{ color: 'var(--accent-hover)' }}
            >
              Arc
            </a>
            {' '}with{' '}
            <a
              href="https://developers.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:underline focus-visible:outline-none"
              style={{ color: 'var(--accent-hover)' }}
            >
              Circle USDC
            </a>
            . All rights reserved.
          </p>

          {/* Status + contract badge */}
          <div className="flex items-center gap-4">
            {/* Network badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(26,128,71,0.08)', color: 'var(--success)', border: '1px solid rgba(26,128,71,0.18)' }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: 'var(--success)', boxShadow: '0 0 0 2px rgba(26,128,71,0.25)' }}
                aria-hidden="true"
              />
              Arc Testnet
            </div>

            {/* Testnet disclaimer */}
            <p className="text-xs hidden sm:block" style={{ color: 'var(--subtle)' }}>
              Testnet only — no real funds at risk
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Internal sub-component ─────────────────────────────────────── */

interface FooterLinkDef {
  label: string;
  view?: string;
  href?: string;
  icon: React.FC<{ className?: string }>;
}

function FooterLink({
  link,
  onActivate,
}: {
  link: FooterLinkDef;
  onActivate: () => void;
}) {
  const isExternal = !!link.href;
  const Icon = link.icon;

  const baseStyle: React.CSSProperties = { color: 'var(--muted)' };

  const handleHover = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, enter: boolean) => {
    e.currentTarget.style.color = enter ? 'var(--accent-hover)' : 'var(--muted)';
    const span = e.currentTarget.querySelector<HTMLElement>('[data-underline]');
    if (span) span.style.width = enter ? '100%' : '0%';
  };

  const className = [
    'relative inline-flex items-center gap-2 text-sm',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 rounded',
    'group',
  ].join(' ');

  const content = (
    <>
      <Icon className="size-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="relative">
        {link.label}
        {/* animated underline */}
        <span
          data-underline
          className="absolute -bottom-px left-0 h-px transition-all duration-200"
          style={{ width: '0%', background: 'var(--accent-hover)' }}
          aria-hidden="true"
        />
      </span>
      {isExternal && (
        <ExternalLink className="size-3 opacity-50 flex-shrink-0" aria-label="(opens in new tab)" />
      )}
    </>
  );

  if (isExternal) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={{ ...baseStyle, outlineColor: 'var(--focus)' }}
        onMouseEnter={e => handleHover(e, true)}
        onMouseLeave={e => handleHover(e, false)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onActivate}
      className={className}
      style={{ ...baseStyle, outlineColor: 'var(--focus)' }}
      onMouseEnter={e => handleHover(e, true)}
      onMouseLeave={e => handleHover(e, false)}
    >
      {content}
    </button>
  );
}
