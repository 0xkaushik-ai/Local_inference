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
  ['readiness-toolkit', 'Readiness tools', 'docs/readiness-toolkit.md', 'Use the toolkit'],
  ['benchmarks', 'Benchmarks and evidence', 'docs/benchmarks.md', 'Use the toolkit'],
  ['runanywhere', 'RunAnywhere adapter', 'docs/runanywhere.md', 'Use the toolkit'],
  ['roadmap', 'Project roadmap', 'docs/roadmap.md', 'Project'],
  ['readiness-release', 'Release evidence', 'docs/readiness-release.md', 'Project'],
  ['development', 'Development', 'docs/development.md', 'Project'],
  ['handoff', 'Project handoff', 'Documents.md', 'Project'],
  ['readme', 'Repository README', 'README.md', 'Project'],
  ['website', 'Website development', 'site/README.md', 'Project'],
  ['design-system', 'Design system', 'site/docs/design-system.md', 'Project'],
  ['engine-experiment', 'CPU experiment', 'docs/engine-experiment.md', 'Research'],
  ['engine-results', 'Engine results', 'docs/engine-results.md', 'Research'],
  ['engine-kernel-notes', 'Kernel notes', 'docs/engine-kernel-notes.md', 'Research'],
  ['research', 'Product research', 'docs/research.md', 'Research'],
];

export const documents = entries.map(([id, title, path, group]) => {
  const sourcePath = path.startsWith('site/') ? `../../${path.slice(5)}` : `../../../${path}`;
  const content = sources[sourcePath];
  if (!content) throw new Error(`Missing documentation source: ${path}`);
  return { id, title, path, group, content };
});

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
