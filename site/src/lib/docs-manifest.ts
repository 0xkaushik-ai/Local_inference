/** Documentation pages in reading order: id, title, repository path, sidebar group. */
export const docEntries = [
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
] as const;

/** A documentation path, optionally pointing at a section heading through the URL fragment. */
export const docHref = (id: string, section = '') =>
  `/docs/${id}${section ? `#${encodeURIComponent(section)}` : ''}`;

/** The current path for a link from the earlier hash router (`#/docs/id?section=x`). */
export function legacyDocPath(hash: string) {
  const match = /^#\/docs\/([^?#]*)(?:\?section=([^#&]*))?/.exec(hash);
  if (!match) return null;
  return docHref(match[1] || 'overview', match[2] ? decodeURIComponent(match[2]) : '');
}

/** Every client route, used to emit a static page shell for each one at build time. */
export const siteRoutes = [
  'tools',
  'how-it-works',
  'example-report',
  'docs',
  ...docEntries.map(([id]) => `docs/${id}`),
];
