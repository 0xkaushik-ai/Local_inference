# Design system

The website presents DeviceBench as a focused developer product with a restrained,
editorial visual identity and accurate descriptions of its capabilities.

## Visual foundation

- Warm off-white canvas, charcoal text, and a restrained rust accent.
  Color, border, radius, shadow, and base typography tokens live in `src/styles.css`.
  The local dashboard uses the same canvas (`#f6f5f1`), ink (`#242521`), accent
  (`#a43725`), and measurement mark in `src/devicebench/readiness/web/` at the
  repository root. Its stylesheet is separate from the React website.
- Locally bundled IBM Plex Sans and IBM Plex Mono. Marketing body copy is generally 15–20px;
  the companion uses system fonts without a font download. Page headings use
  responsive sizing and limited line lengths. Display type uses lighter weights,
  deliberate line breaks, and tighter spacing; numerical labels use monospace.
- One filled primary action and a text link for the secondary action.
  Navigation, tabs, copy, export, and setup controls use consistent states and sizing.
- Reports put findings, next steps, and evidence within reach. Decorative layers
  never cover controls or content. Thin dividers organize the page; repeated
  decorative cards and abstract illustrations are avoided.
- Runtime names link to the relevant setup or research documentation. They do not
  imply customer endorsements or partnerships.

## Interaction conventions

- Tabs support arrow keys, Home, and End. A single tab set works across desktop and
  mobile, and selection is expressed through text, borders, and ARIA state.
- Native dialog semantics contain keyboard focus. Escape dismisses website setup
  and dashboard Help, returning focus to the trigger. Website copy failures leave
  the command available for manual selection.
- Setup leads with the available app download and the steps to extract, open,
  and run checks. Show platform requirements and preview status beside the action.
  Only show a download link when valid artifact metadata is available; unsupported
  platforms and missing artifacts get explicit availability text. Keep source
  commands inside the developer setup disclosure. Never substitute a repository
  link for an application download.
- The mobile navigation is a disclosure. Escape returns focus to its toggle, an
  outside click closes it, and switching to the desktop layout resets it.
- Visible focus rings and reduced-motion preferences apply throughout. Statuses
  combine words with visual styling so color is not their only distinction.
- Sample reports remain explicitly labeled. The selected tool's findings, next
  steps, raw evidence, and downloaded example JSON use the same illustrative data.
- The dashboard uses one result area per active tool. Show results and enable
  downloads only when the recorded request matches the selected settings. App
  presets select editable feature checkboxes; next-step actions navigate without
  starting inference. Missing runtime information stays visibly unknown.

## Verification

Run `npm run build`, `npm run lint`, `npm run format:check`, and `npm test` from
`site/`. Browser tests exercise report views, export, setup, copy success and failure,
mobile navigation, keyboard controls, and layout at narrow widths and 200% zoom.
The axe checks use WCAG A/AA rules for selected desktop, mobile, and dialog states.
Passing these checks is useful evidence, not a full accessibility certification.

The design targets contrast, keyboard access, reflow, and identifiable controls
from the [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/).
Screenshots are written to ignored `test-results/` paths for desktop/mobile review.

Run `npm run test:toolkit` for the packaged dashboard. It covers the three panels,
current-settings report integrity, app presets, Help keyboard behavior, and axe
checks on desktop/mobile/dialog states. Responsive coverage includes 320, 390,
768, 1024, and 1100 pixels. Fixture screenshots live under
`reports/readiness-browser/` at the repository root, with customer review captures
under `reports/v1-customer-review/`. Record actual results in
[release evidence](../../docs/readiness-release.md); configured tests alone are
not execution evidence.

## Information architecture

Lead with the three V1 readiness tools, then explain diagnose, inspect, test, and
export as the customer workflow. Follow with clearly labeled examples of the same
three readiness reports and their next steps. Benchmarks and CPU research belong
in advanced documentation; benchmark controls are deferred. Every tool has a guide;
installation, support scope, report semantics, and V1 preview status are accessible
through local documentation.

The customer app bundles Python and the dashboard. Its launcher opens the local
workspace and provides connection and lifecycle controls. The AI runtime/models
remain separate prerequisites. Describe this candidate as a portable Linux
preview with manual updates; public availability, signing, other Linux systems,
and Windows/macOS apps require their own release evidence.

The documentation reader uses the same type and color tokens, a restrained sidebar,
readable prose, horizontally scrollable code/tables, and an optional desktop
section outline. Guides come from the repository Markdown, avoiding a separate
copy of product claims. Preserve working hash URLs and keyboard focus when moving
between documents and sections.
