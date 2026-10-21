import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Brand from './Brand';

const links = [
  ['Tools', '#tools'],
  ['How it works', '#workflow'],
  ['Example report', '#product'],
  ['Docs', '#/docs/overview'],
];

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}

export default function Header({ onStart }: { onStart: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggle.current?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target))
        setMenuOpen(false);
    }
    const desktop = matchMedia('(min-width: 901px)');
    function resize(event: MediaQueryListEvent) {
      if (event.matches) setMenuOpen(false);
    }
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
      desktop.removeEventListener('change', resize);
    };
  }, [menuOpen]);

  return (
    <header className="site-header" ref={header}>
      <div className="nav-container">
        <a className="brand-link" href="#" aria-label="DeviceBench home">
          <Brand />
        </a>
        <nav
          className={`main-nav${menuOpen ? ' open' : ''}`}
          aria-label="Main navigation"
          id="main-navigation"
        >
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <a
            className="nav-github"
            href="https://github.com/0xkaushik-ai/Local_inference"
            target="_blank"
            rel="noreferrer"
          >
            <GitHubMark />
            <span>GitHub</span>
          </a>
          <button
            className="button primary small nav-start"
            onClick={() => {
              setMenuOpen(false);
              onStart();
            }}
          >
            Get started
          </button>
          <button
            ref={toggle}
            className="icon-button mobile-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
          >
            {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
