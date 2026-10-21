import { useEffect, useId, useRef, useState } from 'react';
import { CornerDownLeft, FileText, Hash, Search, X } from 'lucide-react';
import { docHref, searchDocs, searchIndex, snippet, type SearchEntry } from '../lib/documentation';

const suggested = ['quickstart', 'readiness-toolkit', 'readiness-release', 'overview']
  .map((id) => searchIndex.find((entry) => entry.key === id))
  .filter((entry): entry is SearchEntry => Boolean(entry));

export default function DocsSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const id = useId();
  const results = query.trim() ? searchDocs(query) : suggested;
  const current = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  function go(entry: SearchEntry) {
    window.location.hash = docHref(entry.docId, entry.section);
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-label="Search documentation"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-panel">
        <div className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            role="combobox"
            aria-label="Search documentation"
            aria-expanded={results.length > 0}
            aria-controls={`${id}-results`}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? `${id}-option-${current}` : undefined}
            placeholder="Search guides and sections…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setActive((current + step + results.length) % Math.max(results.length, 1));
              } else if (event.key === 'Enter' && results[current]) {
                event.preventDefault();
                go(results[current]);
              }
            }}
          />
          <button className="icon-button search-close" onClick={onClose} aria-label="Close search">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="search-caption" id={`${id}-caption`}>
          {query.trim()
            ? results.length
              ? `${results.length} ${results.length === 1 ? 'result' : 'results'}`
              : `No results for “${query.trim()}”. Try a tool name, a command, or a status.`
            : 'Suggested pages'}
        </p>
        <ul className="search-results" id={`${id}-results`} role="listbox" aria-label="Results">
          {results.map((entry, index) => {
            const excerpt = query.trim() ? snippet(entry, query) : '';
            return (
              <li
                key={entry.key}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === current}
                className={index === current ? 'active' : undefined}
                onMouseMove={() => setActive(index)}
                onClick={() => go(entry)}
              >
                {entry.section ? (
                  <Hash size={16} aria-hidden="true" />
                ) : (
                  <FileText size={16} aria-hidden="true" />
                )}
                <span className="search-result-text">
                  <span className="search-result-title">
                    {entry.section ? `${entry.docTitle} › ${entry.heading}` : entry.docTitle}
                  </span>
                  {excerpt && <span className="search-result-snippet">{excerpt}</span>}
                </span>
                <CornerDownLeft className="search-enter" size={15} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
        <p className="search-help" aria-hidden="true">
          <kbd>↑</kbd>
          <kbd>↓</kbd> to move <kbd>Enter</kbd> to open <kbd>Esc</kbd> to close
        </p>
      </div>
    </dialog>
  );
}
