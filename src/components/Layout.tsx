import { ReactNode } from 'react';
import { ConnectKitButton } from 'connectkit';
import { NavLink } from './NavLink';
import { Footer } from './Footer';
import { Logo } from './Logo';
import { LayoutDashboard, Zap, Inbox, BookOpen } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  view: string;
  onNavigate: (view: string) => void;
  onFooterNavigate?: (view: string) => void;
}

export function Layout({ children, view, onNavigate, onFooterNavigate }: LayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--surface-strong)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('home')}
              className="focus-visible:outline-none focus-visible:ring-2 rounded-xl"
              style={{ outlineColor: 'var(--focus)' }}
              aria-label="FlowGate home"
            >
              <Logo markSize={28} wordmarkSize="md" mode="default" />
            </button>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            <NavLink active={view === 'dashboard'} onClick={() => onNavigate('dashboard')}>
              <LayoutDashboard className="size-3.5" />
              Dashboard
            </NavLink>
            <NavLink active={view === 'create'} onClick={() => onNavigate('create')}>
              <Zap className="size-3.5" />
              New Budget
            </NavLink>
            <NavLink active={view === 'recipient'} onClick={() => onNavigate('recipient')}>
              <Inbox className="size-3.5" />
              My Earnings
            </NavLink>
            <NavLink active={view === 'docs'} onClick={() => onNavigate('docs')}>
              <BookOpen className="size-3.5" />
              How it works
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ConnectKitButton />
        </div>
      </header>

      {/* Mobile nav */}
      <nav
        className="md:hidden sticky top-[57px] z-30 border-b px-4 py-2 flex items-center gap-1 overflow-x-auto"
        style={{
          background: 'var(--surface-strong)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'var(--border)',
        }}
      >
        <NavLink active={view === 'dashboard'} onClick={() => onNavigate('dashboard')}>
          <LayoutDashboard className="size-3.5" />
          Dashboard
        </NavLink>
        <NavLink active={view === 'create'} onClick={() => onNavigate('create')}>
          <Zap className="size-3.5" />
          New Budget
        </NavLink>
        <NavLink active={view === 'recipient'} onClick={() => onNavigate('recipient')}>
          <Inbox className="size-3.5" />
          My Earnings
        </NavLink>
        <NavLink active={view === 'docs'} onClick={() => onNavigate('docs')}>
          <BookOpen className="size-3.5" />
          How it works
        </NavLink>
      </nav>

      {/* Main */}
      <main className="flex-1 px-4 md:px-8 py-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      <Footer onNavigate={onFooterNavigate ?? onNavigate} />
    </div>
  );
}
