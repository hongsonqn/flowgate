/**
 * ThemeToggle — Sun/Moon icon button for the header.
 * Reads from / writes to ThemeContext.
 */
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative size-9 flex items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2"
      style={{
        background: 'var(--surface-muted)',
        border: '1px solid var(--border)',
        color: 'var(--muted)',
        outlineColor: 'var(--focus)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--accent-subtle)';
        e.currentTarget.style.color = 'var(--accent)';
        e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--surface-muted)';
        e.currentTarget.style.color = 'var(--muted)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Sun — visible in dark mode (click to go light) */}
      <Sun
        className="absolute size-4 transition-all duration-200"
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.5)',
        }}
        aria-hidden="true"
      />
      {/* Moon — visible in light mode (click to go dark) */}
      <Moon
        className="absolute size-4 transition-all duration-200"
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'rotate(90deg) scale(0.5)' : 'rotate(0deg) scale(1)',
        }}
        aria-hidden="true"
      />
    </button>
  );
}
