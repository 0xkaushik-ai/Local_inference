import { useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, FileJson, FolderOpen, Terminal } from 'lucide-react';
import { navigateTabs } from '../lib/tabs';

const steps = [
  {
    title: 'Diagnose your setup',
    description:
      'Start the local companion and open its dashboard. Local AI Doctor checks your server, lists installed models, and explains missing hardware information without loading a model.',
    link: 'Set up the toolkit',
    command: 'PYTHONPATH=src python3 -m devicebench doctor',
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
    command:
      'PYTHONPATH=src python3 -m devicebench inspect \\\n  --model YOUR_INSTALLED_MODEL --context 4096',
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
    command:
      'PYTHONPATH=src python3 -m devicebench compat \\\n  --model YOUR_INSTALLED_MODEL --checks streaming json',
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
    command:
      'Your downloaded report\n\nreport.html  — readable findings\nreport.json  — structured evidence',
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
    <section className="workflow-section container" id="workflow">
      <div className="section-topline">
        <span className="section-label">02 / The workflow</span>
      </div>
      <h2>
        From setup
        <br />
        to evidence.
      </h2>
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
                  <span>0{i + 1}</span>
                  <strong>{step.title}</strong>
                  <ChevronRight size={17} />
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
          <div className="workflow-window-top">
            <span className="window-dots">
              <i />
              <i />
              <i />
            </span>
            <span>devicebench / {active === 3 ? 'evidence' : 'terminal'}</span>
          </div>
          <div className="workflow-terminal">
            <div className="terminal-label">
              {active === 3 ? <FolderOpen size={19} /> : <Terminal size={19} />}
              <span>
                {active === 3 ? 'Your report files' : 'Optional CLI command from the source folder'}
              </span>
            </div>
            <pre>{selected.command}</pre>
            {selected.lines.map((line) => (
              <div className="terminal-check" key={line}>
                <Check size={14} />
                {line}
              </div>
            ))}
          </div>
          <div className="workflow-file">
            <FileJson size={18} />
            <span>
              Use the dashboard or the CLI
              <small>The same checks. HTML and JSON reports.</small>
            </span>
            <Check size={15} />
          </div>
        </div>
      </div>
    </section>
  );
}
