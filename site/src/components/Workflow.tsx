import { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  FileJson,
  FolderOpen,
  PanelsTopLeft,
} from 'lucide-react';
import { navigateTabs } from '../lib/tabs';

const steps = [
  {
    title: 'Diagnose your setup',
    description:
      'Open DeviceBench. Its launcher starts the dashboard in your browser. Local AI Doctor checks your server, lists installed models, and explains missing hardware information without loading a model.',
    link: 'Set up the toolkit',
    panel: 'Local AI Doctor',
    fields: [
      ['Open', 'Local AI Doctor'],
      ['Action', 'Run Doctor'],
      ['Review', 'Connection, models, hardware'],
    ],
    lines: [
      'Check the local runtime',
      'Read the installed model inventory',
      'Review findings and next steps',
    ],
  },
  {
    title: 'Inspect your model',
    description:
      'In the dashboard, select Model & Context Checker, choose an installed model, and set your context size. Review declared limits and memory estimates; missing data stays visible.',
    link: 'Read the model guide',
    guide: '#/docs/readiness-toolkit?section=model-and-context-checker',
    panel: 'Model & Context Checker',
    fields: [
      ['Choose', 'An installed model'],
      ['Set context', 'For example, 4096 tokens'],
      ['Review', 'Limits and memory estimates'],
    ],
    lines: [
      'Inspect identity and context limits',
      'Estimate supported memory layouts',
      'Treat estimates as guidance, not a load guarantee',
    ],
  },
  {
    title: 'Test app compatibility',
    description:
      'Choose App Compatibility Tester, select the features your app needs, and run the check. Read the findings for streaming, structured JSON, tool calling, or embeddings.',
    link: 'Read the compatibility guide',
    guide: '#/docs/readiness-toolkit?section=app-compatibility-tester',
    panel: 'App Compatibility Tester',
    fields: [
      ['Choose', 'Your model and app preset'],
      ['Select checks', 'Only the features your app needs'],
      ['Run', 'Read the observed responses'],
    ],
    lines: [
      'Select only the features you need',
      'Use a separate embedding model if needed',
      'Distinguish failed, unsupported, and unavailable',
    ],
  },
  {
    title: 'Export the evidence',
    description:
      'Download your findings as HTML or JSON from the dashboard. Read the observed responses and review device details before sharing with your team. Save reports before stopping the companion.',
    link: 'Read the export guide',
    guide: '#/docs/readiness-toolkit?section=statuses-reports-and-limits',
    panel: 'Your report files',
    fields: [
      ['report.html', 'Readable, standalone findings'],
      ['report.json', 'Structured evidence'],
      ['Before sharing', 'Review machine and model details'],
    ],
    lines: [
      'Readable, standalone HTML',
      'Structured findings and recorded assumptions',
      'Download before closing the local companion',
    ],
  },
];
export default function Workflow({ onStart }: { onStart: () => void }) {
  const [active, setActive] = useState(0);
  const selected = steps[active];
  return (
    <section className="section workflow-section" id="workflow" aria-labelledby="workflow-title">
      <div className="container">
        <div className="section-head split">
          <h2 id="workflow-title">From setup to evidence in four steps.</h2>
          <p>
            The launcher opens the dashboard in your browser. Work through the tools in order, or
            jump straight to the one you need.
          </p>
        </div>
        <div className="workflow-layout">
          <div>
            <div
              className="workflow-tabs"
              role="tablist"
              onKeyDown={navigateTabs}
              aria-label="Local AI workflow"
              aria-orientation="vertical"
            >
              {steps.map((step, i) => (
                <div key={step.title} className={`workflow-step ${active === i ? 'active' : ''}`}>
                  <button
                    role="tab"
                    tabIndex={active === i ? 0 : -1}
                    aria-selected={active === i}
                    aria-controls="workflow-panel"
                    id={`workflow-${i}`}
                    onClick={() => setActive(i)}
                  >
                    <span className="workflow-number">0{i + 1}</span>
                    <strong>{step.title}</strong>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <div className="workflow-description">
              <p>{selected.description}</p>
              {selected.guide ? (
                <a className="text-link" href={selected.guide}>
                  {selected.link} <ArrowUpRight size={15} />
                </a>
              ) : (
                <button className="text-button" onClick={onStart}>
                  {selected.link} <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          </div>
          <div
            className="workflow-panel"
            id="workflow-panel"
            role="tabpanel"
            aria-labelledby={`workflow-${active}`}
          >
            <div className="window-bar">
              <span className="window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="window-title">DeviceBench dashboard</span>
              <span className="window-address" translate="no">
                127.0.0.1:8766
              </span>
            </div>
            <div className="workflow-terminal">
              <div className="terminal-label">
                {active === 3 ? (
                  <FolderOpen size={19} aria-hidden="true" />
                ) : (
                  <PanelsTopLeft size={19} aria-hidden="true" />
                )}
                <span>{selected.panel}</span>
                <span className="terminal-step">Step {active + 1} of 4</span>
              </div>
              <dl className="workflow-fields">
                {selected.fields.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {selected.lines.map((line) => (
                <div className="terminal-check" key={line}>
                  <Check size={14} aria-hidden="true" />
                  {line}
                </div>
              ))}
            </div>
            <div className="workflow-file">
              <FileJson size={18} aria-hidden="true" />
              <span>
                Your checks stay on your computer
                <small>Save HTML and JSON reports before quitting.</small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
