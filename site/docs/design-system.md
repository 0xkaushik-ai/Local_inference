# Design system

The website presents DeviceBench as a precise developer instrument: an identity
borrowed from test equipment, with accurate descriptions of its capabilities.

## Brand

- The mark is a chip (the device) with three rising bars (the measurement); the
  tallest bar carries the signal yellow. `src/components/Brand.tsx` renders it with
  the `DeviceBench` wordmark. `public/assets/favicon.svg` adapts it to dark browser
  chrome, and `public/assets/og-image.png` and `apple-touch-icon.png` are rendered
  from the same geometry. Keep the mark's proportions; do not recolor the chip.
- The local dashboard in `src/devicebench/readiness/web/` at the repository root uses
  the same mark, favicon, and neutral and signal tokens. Its stylesheet is separate
  from the React website and uses system fonts because its content security policy
  allows no font downloads.

## Visual foundation

- White paper (`#ffffff`), graphite ink (`#15171b`), cool neutral lines
  (`#e3e5e8`), and instrument yellow (`#f2b705`). Yellow is a fill only (primary
  buttons, the mark, link underlines, selection markers) and never carries text
  on white. Dark mode follows the system preference with its own token values.
  Color, border, radius, shadow, and type tokens live in `src/styles.css`.
- Status colors are reserved for results: pass green, review amber, fail red, and
  neutral information. Chart series use the validated blue, orange, and aqua set
  shared with the dashboard's memory meter, with a legend and values beside every
  bar.
- Locally bundled IBM Plex Sans and IBM Plex Mono. Headlines use Plex Sans at a
  condensed width (84–88%) with tight tracking; body copy is 15–19px. Monospace is
  for commands, addresses, and numeric readouts, not for decorative labels.
- One filled primary action (yellow) and an outlined or underlined secondary
  action. Sentence case throughout; no all-caps eyebrows above headings.
- The hero's memory-fit demo uses the Model & Context Checker's formula with
  clearly labeled sample inputs. Reports put findings, next steps, and evidence
  within reach. Decorative layers never cover controls or content.
- Runtime names link to the relevant setup or research documentation. They do not
  imply customer endorsements or partnerships.

## Motion

- One ambient animation: circuit traces around the hero demo card, with yellow
  pulses flowing into it. `src/components/SignalTraces.tsx` uses Motion for React
  and is a lazy chunk that loads after first paint, only at widths of 1081px and
  above where the card sits beside the text.
- Pulses animate `transform` and `opacity` only, so they run on the compositor with
  no layout or script work per frame. They stop when the hero leaves the viewport
  and never run under `prefers-reduced-motion`; the traces then render statically.
- Content never waits on motion: headings and copy render immediately. The demo
  card's entrance and its number tween are short, CSS- or frame-based, and skipped
  under reduced motion. Add new motion only when it explains a change of state.

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

Open with the question the product answers and the interactive memory-fit demo.
Then present the three V1 readiness tools, explain diagnose, inspect, test, and
export as the customer workflow, and follow with clearly labeled examples of the same
three readiness reports and their next steps. Benchmarks and CPU research belong
in advanced documentation; benchmark controls are deferred. Every tool has a guide;
installation, support scope, report semantics, and V1 preview status are accessible
through local documentation.

The customer app bundles Python and the dashboard. Its launcher opens the local
workspace and provides connection and lifecycle controls. The AI runtime/models
remain separate prerequisites. Describe this candidate as a portable Linux
preview with manual updates; public availability, signing, other Linux systems,
and Windows/macOS apps require their own release evidence.

The documentation reader uses the same type and color tokens, a grouped sidebar
(an off-canvas menu below 1024px), readable prose, copyable code blocks,
horizontally scrollable tables, previous and next links, and a desktop section
outline that follows scrolling. Search (Ctrl K, ⌘K, or `/`) covers every page and
section heading with keyboard navigation. Guides come from the repository Markdown,
avoiding a separate copy of product claims. Preserve working hash URLs and keyboard
focus when moving between documents and sections; the rendered article is memoized
so that menu, search, and outline state never remount its headings.
