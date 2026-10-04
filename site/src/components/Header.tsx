import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Brand from './Brand';

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
        <a href="#" aria-label="DeviceBench home">
          <Brand />
        </a>
        <nav
          className={`main-nav${menuOpen ? ' open' : ''}`}
          aria-label="Main navigation"
          id="main-navigation"
        >
          <a href="#tools" onClick={() => setMenuOpen(false)}>
            Tools
          </a>
          <a href="#workflow" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#product" onClick={() => setMenuOpen(false)}>
            Example report
          </a>
          <a href="#/docs/overview" onClick={() => setMenuOpen(false)}>
            Documentation <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="nav-actions">
          <a
            className="nav-github"
            href="https://github.com/0xkaushik-ai/Local_inference"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={14} />
          </a>
          <button
            className="button dark nav-start"
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
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
    </header>
  );
}
