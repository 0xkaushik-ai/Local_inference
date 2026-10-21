import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, Menu, Search, X } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import Brand from './Brand';
import DocsSearch from './DocsSearch';
import {
  docHref,
  documents,
  headingId,
  neighbors,
  resolveDocLink,
  type DocumentEntry,
} from '../lib/documentation';

const repository = 'https://github.com/0xkaushik-ai/Local_inference';
const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
const languages: Record<string, string> = {
  sh: 'Terminal',
  bash: 'Terminal',
  shell: 'Terminal',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  json: 'JSON',
  text: 'Text',
  python: 'Python',
  py: 'Python',
};

function CodeBlock({ children, language }: { children: ReactNode; language: string }) {
  const code = useRef<HTMLPreElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(code.current?.textContent?.replace(/\n$/, '') ?? '');
      setState('copied');
    } catch {
      setState('failed');
    }
  }
  return (
    <div className="code-block">
      <div className="code-bar">
        <span>{languages[language] ?? (language ? language.toUpperCase() : 'Code')}</span>
        <button type="button" onClick={copy}>
          {state === 'copied' ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select to copy' : 'Copy'}
          <span className="visually-hidden"> code</span>
        </button>
      </div>
      <pre ref={code} tabIndex={0}>
        {children}
      </pre>
    </div>
  );
}

/**
 * Rendered Markdown for one page. Memoized so that menu, search, and outline state changes do not
 * re-create the custom heading components, which would remount headings and drop their focus.
 */
const DocArticle = memo(function DocArticle({ doc }: { doc: DocumentEntry }) {
  const lines = doc.content.split('\n');
  const heading = (line = 1) => headingId(lines[line - 1]?.replace(/^#+\s*/, '') ?? '');
  return (
    <article className="docs-prose">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h2: ({ node, children }) => (
            <h2 tabIndex={-1} id={heading(node?.position?.start.line)}>
              {children}
            </h2>
          ),
          h3: ({ node, children }) => (
            <h3 tabIndex={-1} id={heading(node?.position?.start.line)}>
              {children}
            </h3>
          ),
          a: ({ href = '', children }) => {
            const destination = resolveDocLink(href, doc.path);
            if (destination === null)
              return (
                <span className="local-evidence" title={href}>
                  {children} (local evidence file)
                </span>
              );
            if (destination.startsWith('/')) return <Link to={destination}>{children}</Link>;
            const external = /^https?:\/\//.test(destination);
            return (
              <a
                href={destination}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
              >
                {children}
              </a>
            );
          },
          pre: ({ node, children }) => {
            const code = node?.children[0];
            const classes = code && 'properties' in code ? code.properties.className : undefined;
            const language = Array.isArray(classes)
              ? String(classes.find((name) => String(name).startsWith('language-')) ?? '')
              : '';
            return <CodeBlock language={language.replace('language-', '')}>{children}</CodeBlock>;
          },
          table: ({ children }) => (
            <div className="docs-table" role="region" aria-label="Reference table" tabIndex={0}>
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {doc.content}
      </Markdown>
    </article>
  );
});

export default function Documentation() {
  const { id = 'overview' } = useParams();
  const { hash } = useLocation();
  const selected = documents.find((entry) => entry.id === id);
  const section = hash ? decodeURIComponent(hash.slice(1)) : null;
  const content = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const { previous, next } = neighbors(selected?.id);

  useEffect(() => {
    const target = section ? document.getElementById(section) : content.current;
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    target?.focus({ preventScroll: true });
  }, [selected, section]);

  useEffect(() => {
    function open(event: KeyboardEvent) {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      if (
        (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) ||
        (event.key === '/' && !typing)
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', open);
    return () => document.removeEventListener('keydown', open);
  }, []);

  useEffect(() => {
    const headings = Array.from(
      content.current?.querySelectorAll<HTMLElement>('.docs-prose h2[id]') ?? [],
    );
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveHeading(visible.target.id);
      },
      { rootMargin: '-88px 0px -66% 0px' },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [selected]);

  const headings = selected?.content.split('\n').filter((line) => /^## /.test(line)) ?? [];
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <title>{`${selected?.title ?? 'Page not found'} — DeviceBench docs`}</title>
      <a className="skip-link" href="#doc-content">
        Skip to documentation
      </a>
      <header className="docs-header">
        <div className="docs-header-inner">
          <Link className="brand-link" to="/" aria-label="DeviceBench home">
            <Brand />
          </Link>
          <span className="docs-label">Docs</span>
          <button
            type="button"
            className="search-trigger"
            onClick={() => setSearchOpen(true)}
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search size={16} aria-hidden="true" />
            <span className="search-trigger-text">Search docs</span>
            <kbd aria-hidden="true">{shortcut}</kbd>
          </button>
          <div className="docs-header-actions">
            <Link className="back-link" to="/">
              <ArrowLeft size={15} aria-hidden="true" /> Back to product
            </Link>
            <a className="nav-github" href={repository} target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <button
            type="button"
            className="icon-button docs-menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="docs-navigation"
            aria-label={menuOpen ? 'Close documentation menu' : 'Open documentation menu'}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </header>
      <div className="docs-layout">
        <nav
          className={`docs-sidebar${menuOpen ? ' open' : ''}`}
          id="docs-navigation"
          aria-label="Documentation"
        >
          {Array.from(new Set(documents.map((entry) => entry.group))).map((group) => (
            <div className="docs-group" key={group}>
              <h2>{group}</h2>
              {documents
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <Link
                    key={entry.id}
                    to={docHref(entry.id)}
                    aria-current={entry.id === selected?.id ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    {entry.title}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <main className="docs-content" id="doc-content" ref={content} tabIndex={-1}>
          <p className="docs-breadcrumb">
            <Link to="/docs">Docs</Link>
            <span aria-hidden="true">/</span>
            {selected?.group ?? 'Not found'}
          </p>
          {selected ? (
            <DocArticle doc={selected} />
          ) : (
            <article className="docs-prose">
              <h1>Page not found</h1>
              <p>
                This documentation page does not exist.{' '}
                <Link to={docHref('overview')}>Return to the documentation overview.</Link>
              </p>
            </article>
          )}
          {selected && (previous || next) && (
            <nav className="docs-pager" aria-label="Previous and next pages">
              {previous ? (
                <Link className="pager-link" to={docHref(previous.id)}>
                  <span>
                    <ArrowLeft size={14} aria-hidden="true" /> Previous
                  </span>
                  <strong>{previous.title}</strong>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link className="pager-link next" to={docHref(next.id)}>
                  <span>
                    Next <ArrowRight size={14} aria-hidden="true" />
                  </span>
                  <strong>{next.title}</strong>
                </Link>
              )}
            </nav>
          )}
          <footer className="docs-footnote">
            <span>DeviceBench V1 preview documentation</span>
            {selected && (
              <a
                href={`${repository}/blob/master/${selected.path}`}
                target="_blank"
                rel="noreferrer"
              >
                Source on GitHub <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            )}
          </footer>
        </main>
        <aside className="docs-outline" aria-label="On this page">
          {headings.length > 0 && <p className="outline-title">On this page</p>}
          {headings.map((line) => {
            const target = headingId(line.slice(3));
            return (
              <Link
                key={line}
                to={docHref(selected!.id, target)}
                aria-current={activeHeading === target ? 'true' : undefined}
              >
                {line.slice(3)}
              </Link>
            );
          })}
        </aside>
      </div>
      <DocsSearch
        key={searchOpen ? 'open' : 'closed'}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
