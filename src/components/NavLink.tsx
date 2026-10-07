import { ReactNode } from 'react';
import clsx from 'clsx';

interface NavLinkProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function NavLink({ active, onClick, children }: NavLinkProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'text-white'
          : 'hover:opacity-80'
      )}
      style={
        active
          ? { background: 'var(--accent)', color: 'white' }
          : { color: 'var(--muted)' }
      }
    >
      {children}
    </button>
  );
}
