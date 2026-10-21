const sources = import.meta.glob<string>(
  [
    '../../../docs/*.md',
    '../../../README.md',
    '../../../Documents.md',
    '../../README.md',
    '../../docs/*.md',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const entries = [
  ['overview', 'Start here', 'docs/overview.md', 'Getting started'],
  ['quickstart', 'Install and run', 'docs/quickstart.md', 'Getting started'],
  ['readiness-toolkit', 'Readiness tools', 'docs/readiness-toolkit.md', 'Guides'],
  ['benchmarks', 'Benchmarks and evidence', 'docs/benchmarks.md', 'Guides'],
  ['runanywhere', 'RunAnywhere adapter', 'docs/runanywhere.md', 'Guides'],
  ['roadmap', 'Project roadmap', 'docs/roadmap.md', 'Project'],
  ['readiness-release', 'Release evidence', 'docs/readiness-release.md', 'Project'],
  ['engine-experiment', 'CPU experiment', 'docs/engine-experiment.md', 'Research'],
  ['engine-results', 'Engine results', 'docs/engine-results.md', 'Research'],
  ['engine-kernel-notes', 'Kernel notes', 'docs/engine-kernel-notes.md', 'Research'],
  ['research', 'Product research', 'docs/research.md', 'Research'],
  ['development', 'Development', 'docs/development.md', 'Contributing'],
  ['readme', 'Repository README', 'README.md', 'Contributing'],
  ['handoff', 'Project handoff', 'Documents.md', 'Contributing'],
  ['website', 'Website development', 'site/README.md', 'Contributing'],
  ['design-system', 'Design system', 'site/docs/design-system.md', 'Contributing'],
];

export const documents = entries.map(([id, title, path, group]) => {
  const sourcePath = path.startsWith('site/') ? `../../${path.slice(5)}` : `../../../${path}`;
  const content = sources[sourcePath];
  if (!content) throw new Error(`Missing documentation source: ${path}`);
  return { id, title, path, group, content };
});

export type DocumentEntry = (typeof documents)[number];

export const docHref = (id: string, section = '') =>
  `#/docs/${id}${section ? `?section=${encodeURIComponent(section)}` : ''}`;

export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

export function resolveDocLink(href: string, sourcePath: string) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return href;
  const resolved = new URL(href, `https://docs.invalid/${sourcePath}`);
  const path = decodeURIComponent(resolved.pathname.slice(1));
  const document = documents.find((entry) => entry.path === path);
  if (document) return docHref(document.id, decodeURIComponent(resolved.hash.slice(1)));
  // Generated evidence stays on the user's machine and is not part of the website.
  if (path.startsWith('reports/')) return null;
  return `https://github.com/0xkaushik-ai/Local_inference/blob/master/${path}${resolved.hash}`;
}

/** The pages before and after a document in reading order. */
export function neighbors(id: string | undefined) {
  const index = documents.findIndex((entry) => entry.id === id);
  return {
    previous: index > 0 ? documents[index - 1] : undefined,
    next: index >= 0 && index < documents.length - 1 ? documents[index + 1] : undefined,
  };
}

const plain = (line: string) =>
  line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|]/g, '')
    .replace(/^\s*(?:[-+]|\d+\.)\s+/, '')
    .trim();

export type SearchEntry = {
  key: string;
  docId: string;
  docTitle: string;
  group: string;
  heading: string;
  section: string;
  text: string;
};

/** One entry per page and per level-two or level-three heading, with its section text. */
export const searchIndex: SearchEntry[] = documents.flatMap((doc) => {
  const sections: SearchEntry[] = [];
  let current: SearchEntry = {
    key: doc.id,
    docId: doc.id,
    docTitle: doc.title,
    group: doc.group,
    heading: doc.title,
    section: '',
    text: '',
  };
  let fenced = false;
  for (const line of doc.content.split('\n')) {
    if (line.startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    const heading = !fenced && /^(##|###) /.exec(line);
    if (heading) {
      sections.push(current);
      const text = line.replace(/^#+\s*/, '');
      current = {
        ...current,
        key: `${doc.id}:${headingId(text)}`,
        heading: plain(text),
        section: headingId(text),
        text: '',
      };
    } else if (!fenced && !line.startsWith('# ') && current.text.length < 1500) {
      const words = plain(line);
      if (words) current.text += `${current.text ? ' ' : ''}${words}`;
    }
  }
  sections.push(current);
  return sections;
});

/** Rank sections that contain every term, preferring heading and title matches. */
export function searchDocs(query: string, limit = 10) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const phrase = terms.join(' ');
  const results: { entry: SearchEntry; score: number }[] = [];
  for (const entry of searchIndex) {
    const heading = entry.heading.toLowerCase();
    const title = entry.docTitle.toLowerCase();
    const text = entry.text.toLowerCase();
    let score = heading.includes(phrase) ? 10 : text.includes(phrase) ? 3 : 0;
    for (const term of terms) {
      if (heading.startsWith(term)) score += 8;
      else if (heading.includes(term)) score += 5;
      else if (title.includes(term)) score += 2;
      else if (text.includes(term)) score += 1;
      else {
        score = 0;
        break;
      }
    }
    if (score) results.push({ entry, score: entry.section ? score : score + 1 });
  }
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

/** A short excerpt of the section text around the first matching term. */
export function snippet(entry: SearchEntry, query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = entry.text.toLowerCase();
  const phraseAt = text.indexOf(terms.join(' '));
  const at = phraseAt >= 0 ? phraseAt : terms.length ? text.indexOf(terms[0]) : -1;
  const start = Math.max(0, at - 60);
  const excerpt = entry.text.slice(start, start + 150).trim();
  return excerpt
    ? `${start > 0 ? '…' : ''}${excerpt}${start + 150 < entry.text.length ? '…' : ''}`
    : '';
}
