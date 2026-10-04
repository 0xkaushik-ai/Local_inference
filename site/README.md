# DeviceBench website

A React + TypeScript product website and documentation hub for DeviceBench V1,
the three-tool local AI readiness toolkit. The public-facing status is V1 preview;
`0.2.0` is the internal Python development package version.
Vite handles development and production builds. The design references the visual
structure of [Devin's public website](https://devin.ai/), refined toward an enterprise
developer product: IBM Plex typography, a warm neutral canvas, restrained rust accents,
and an unobstructed report workspace. Branding, artwork, and copy are specific to
DeviceBench. See [design system](docs/design-system.md) for the visual and interaction
conventions.

## Develop

Requires Node.js 22.12+ and npm. The implementation was validated with Node 26.
All direct dependency versions are pinned; `package-lock.json` pins the dependency
tree. Run these commands from `site/`:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:8765/>. Stop any previous server on port 8765 first.

```sh
npm run build          # Type-check and build to dist/
npm run preview        # Serve the production build on port 8765
npm run lint           # ESLint, TypeScript, and React hooks checks
npm run format         # Format source, tests, and configuration
npm run format:check   # Verify formatting
npm test               # Website and documentation checks against dist/
npm run test:toolkit   # Separate local dashboard tests using root .venv
```

Run `npm run build` before `npm test`. Browser tests use installed Google Chrome
via Playwright's `chrome` channel and start a production preview on port 4173.
If Chrome is unavailable, install it with `npx playwright install chrome`.
Screenshots and failure details are generated under `test-results/` and ignored
by Git. Tests cover sample tool selection, report views, JSON download, setup commands,
clipboard success/failure, keyboard dialog dismissal, workflow state, and mobile
navigation and overflow. Accessibility checks use axe against selected desktop,
mobile, and dialog states, plus keyboard interaction and a 200% zoom layout check.
Automated checks cover only part of accessibility; they do not establish full WCAG
conformance.

The toolkit suite requires the parent `.venv` with DeviceBench installed (see the
root README). It launches a synthetic runtime and local dashboard on port 18766;
screenshots are saved under `../reports/readiness-browser/`. It covers the three
tools, both API protocols, report exports, unsupported features, outages, text
injection resistance, results matched to current settings, app presets, next-step
guidance, inventory refresh, responsive layouts, and automated accessibility checks.
Help is checked for keyboard opening/dismissal and focus return. Current test
results and validation boundaries are recorded in the
[release evidence](../docs/readiness-release.md).
The packaged dashboard lives in `../src/devicebench/readiness/web/`;
the static website links users to its local launch commands.

## Structure

```text
site/
  src/
    App.tsx                Page sections and navigation
    components/            Tools, workflow, report, setup, documentation, brand
    lib/                   Keyboard navigation and documentation registry
    styles.css             Responsive styles and reduced-motion support
    main.tsx               React entry and bundled font
  public/assets/           Static favicon
  tests/                   Playwright browser tests
  index.html               Vite HTML entry
  package.json             Reproducible project commands
  package-lock.json        Exact dependency tree
```

IBM Plex Sans and IBM Plex Mono are bundled locally through Fontsource. Icons use
Lucide, and the measurement-inspired brand mark is an original SVG. The page makes
no API requests; external documentation opens only when a user follows a link.

## Behavior and scope

- The report preview uses explicitly illustrative readiness data. Selecting a tool
  updates its findings, suggested next step, and raw evidence. JSON downloads
  retain `"example": true`; no device or model is checked by the website.
- The setup dialog provides real CLI commands with runtime prerequisites and a
  copy button. It does not install models or execute commands.
- Reports, accounts, telemetry, and benchmark execution are not connected to the
  website. Real benchmarks continue to run through `src/devicebench/` in the parent
  repository, with their existing standalone reports.
- Benchmarks and CPU research remain available through advanced documentation.
  They are separate from the three-tool customer journey; the website makes no
  inference speed claim.
- The production build is static and can be hosted from `dist/`; no deployment is
  configured or performed by the development scripts.

## Product structure and documentation

The homepage follows readiness tools → diagnose/inspect/test/export workflow →
interactive readiness example → results and limits → documentation → practical
questions. Benchmarks and CPU research are linked as advanced documentation from
the footer. The setup dialog explains how to start from a local source checkout;
it does not imply that a public package download already exists.

The local toolkit is launched separately. Its dashboard is plain HTML/CSS/JavaScript
bundled in Python, with the same brand colors and measurement mark. It includes
Help & setup, editable app presets, next-step guidance, and reports matched to the
active tool's selected settings. The website illustrates these tools; only the
local companion performs the checks.

Documentation is available at `/#/docs/overview`, with install instructions at
`/#/docs/quickstart`. `src/lib/documentation.ts` lists the supported documents and
imports root Markdown files as raw text through Vite. The reader is lazy-loaded
and renders with `react-markdown` and `remark-gfm`, without raw HTML execution.
Hash routes work on static hosting without server rewrite rules. Internal Markdown
links resolve to bundled pages and section anchors. Links to generated `reports/`
evidence are shown as local-file references; private report data is never bundled.

To update a guide, edit its repository Markdown source. To add one, add its entry
to the documentation registry. Keep the documentation overview, README, handoff,
and roadmap links current. Rebuild to include changes in a production bundle.
The documentation route, section links, browser history, missing-page state,
responsive layout, and accessibility are covered by browser tests.

The new documentation renderer follows the [react-markdown reference](https://github.com/remarkjs/react-markdown).
