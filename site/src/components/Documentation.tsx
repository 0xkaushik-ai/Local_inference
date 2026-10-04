import { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowUpRight, BookOpen } from 'lucide-react';
import Brand from './Brand';
import { docHref, documents, headingId, resolveDocLink } from '../lib/documentation';

export default function Documentation({ route }: { route: string }) {
  const [id, query = ''] = route.slice('#/docs/'.length).split('?');
  const selected = documents.find((entry) => entry.id === (id || 'overview'));
  const section = new URLSearchParams(query).get('section');
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    const target = section ? document.getElementById(section) : content.current;
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    target?.focus({ preventScroll: true });
  }, [selected, section]);

  const headings = selected?.content.split('\n').filter((line) => /^## /.test(line)) ?? [];
  const heading = (line = 1) =>
    headingId(selected?.content.split('\n')[line - 1].replace(/^#+\s*/, '') ?? '');
  return (
    <>
      <title>{`${selected?.title ?? 'Page not found'} — DeviceBench docs`}</title>
      <a className="skip-link" href={docHref(id || 'overview', 'doc-content')}>
        Skip to documentation
      </a>
      <header className="docs-header">
        <div className="container">
          <a href="#main" aria-label="DeviceBench home">
            <Brand />
          </a>
          <span>
            <BookOpen size={16} /> Documentation
          </span>
          <a className="text-link" href="#main">
            <ArrowLeft size={15} /> Back to product
          </a>
        </div>
      </header>
      <div className="docs-layout container">
        <nav className="docs-sidebar" aria-label="Documentation">
          <span className="section-label">DeviceBench / 0.2</span>
          {Array.from(new Set(documents.map((entry) => entry.group))).map((group) => (
            <div key={group}>
              <h2>{group}</h2>
              {documents
                .filter((entry) => entry.group === group)
                .map((entry) => (
                  <a
                    key={entry.id}
                    href={docHref(entry.id)}
                    aria-current={entry.id === selected?.id ? 'page' : undefined}
                  >
                    {entry.title}
                  </a>
                ))}
            </div>
          ))}
        </nav>
        <main className="docs-content" id="doc-content" ref={content} tabIndex={-1}>
          <div className="docs-breadcrumb">
            Documentation <span>/</span> {selected?.group ?? 'Not found'}
          </div>
          {selected ? (
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
                    const destination = resolveDocLink(href, selected.path);
                    if (destination === null)
                      return (
                        <span className="local-evidence" title={href}>
                          {children} (local evidence file)
                        </span>
                      );
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
                  table: ({ children }) => (
                    <div
                      className="docs-table"
                      role="region"
                      aria-label="Reference table"
                      tabIndex={0}
                    >
                      <table>{children}</table>
                    </div>
                  ),
                }}
              >
                {selected.content}
              </Markdown>
            </article>
          ) : (
            <article className="docs-prose">
              <h1>Page not found</h1>
              <p>
                This documentation page does not exist.{' '}
                <a href={docHref('overview')}>Return to the documentation overview.</a>
              </p>
            </article>
          )}
          <footer className="docs-footnote">
            <span>DeviceBench · Local AI readiness</span>
            {selected && (
              <a
                href={`https://github.com/0xkaushik-ai/Local_inference/blob/master/${selected.path}`}
                target="_blank"
                rel="noreferrer"
              >
                Source on GitHub <ArrowUpRight size={13} />
              </a>
            )}
          </footer>
        </main>
        <aside className="docs-outline" aria-label="On this page">
          <span className="section-label">On this page</span>
          {headings.map((line) => (
            <a key={line} href={docHref(selected!.id, headingId(line.slice(3)))}>
              {line.slice(3)}
            </a>
          ))}
        </aside>
      </div>
    </>
  );
}
