import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Cable,
  Check,
  Cpu,
  FileJson,
  Info,
  LayoutDashboard,
  ListChecks,
  Plus,
  Stethoscope,
} from 'lucide-react';
import { navigateTabs } from '../lib/tabs';

const examples = [
  {
    id: 'doctor',
    name: 'Local AI Doctor',
    short: 'Diagnose setup',
    Icon: Stethoscope,
    summary: 'Your runtime is reachable.',
    detail: 'A sample connection check, with hardware and model information alongside it.',
    context: 'Local Ollama · Sample device',
    findings: [
      {
        title: 'Runtime connection',
        status: 'pass',
        detail: 'The local server responded to the model inventory request.',
      },
      {
        title: 'Installed models',
        status: 'info',
        detail: 'An installed model is available to inspect and test.',
      },
      {
        title: 'GPU memory',
        status: 'warning',
        detail:
          'GPU memory information is unavailable in this sample. No GPU memory fit is assumed.',
      },
    ],
    next: 'Choose an installed model and the context size your application needs. The Model & Context Checker will show available metadata and estimates.',
    guide: 'model-and-context-checker',
  },
  {
    id: 'inspect',
    name: 'Model & Context Checker',
    short: 'Check a model',
    Icon: Cpu,
    summary: 'A memory estimate, with assumptions.',
    detail: 'A sample model report for a requested context of 4,096 tokens.',
    context: 'Sample dense model · 4,096-token context',
    findings: [
      {
        title: 'Declared context limit',
        status: 'pass',
        detail: 'The requested context is within the limit reported by this sample model.',
      },
      {
        title: 'Estimated memory',
        status: 'info',
        detail:
          '1.31 GiB estimated for weights, one sequence of KV cache, and a runtime allowance. This is an illustrative value, not a measured load requirement.',
      },
      {
        title: 'Available memory',
        status: 'warning',
        detail:
          'Available memory is unknown in this example. The estimate alone does not establish that the model will fit.',
      },
    ],
    next: 'Review the assumptions, then test the features your application uses. Memory estimates cannot guarantee that a model loads or runs reliably.',
    guide: 'app-compatibility-tester',
  },
  {
    id: 'compat',
    name: 'App Compatibility Tester',
    short: 'Test app features',
    Icon: Cable,
    summary: 'Two checks passed. One needs attention.',
    detail: 'A sample compatibility report with three selected requirements.',
    context: 'Sample model · Streaming, JSON, tool calling',
    findings: [
      {
        title: 'Streaming responses',
        status: 'pass',
        detail:
          'The sample response contains multiple frames, text content, and a terminal record.',
      },
      {
        title: 'Structured JSON',
        status: 'pass',
        detail: 'The sample response matches the requested JSON schema.',
      },
      {
        title: 'Tool calling',
        status: 'unsupported',
        detail:
          'The sample runtime reports that this model does not support tool calling. No function was executed.',
      },
    ],
    next: 'If your app needs tool calling, select a model that declares that capability and rerun the check. A pass on these small probes still needs validation with your own workload.',
    guide: 'app-compatibility-tester',
  },
];
const tabs = [
  { id: 'overview', name: 'Overview', Icon: LayoutDashboard },
  { id: 'next', name: 'Next steps', Icon: ListChecks },
  { id: 'evidence', name: 'Raw evidence', Icon: FileJson },
] as const;
type Tab = (typeof tabs)[number]['id'];

export default function ReportPreview({ onStart }: { onStart: () => void }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [tool, setTool] = useState(0);
  const selected = examples[tool];
  const evidence = {
    example: true,
    source: 'Illustrative product example. No device or model was checked.',
    tool: selected.name,
    context: selected.context,
    findings: selected.findings,
    next_step: selected.next,
  };
  function downloadExample() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'devicebench-illustrative-example.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="report-stage" id="product">
      <div className="product-intro">
        <div>
          <span className="section-label">Inside DeviceBench</span>
          <h2>From a finding to a next step.</h2>
        </div>
        <span className="sample-badge">Interactive example · Sample data</span>
      </div>
      <div className="report-window readiness-preview">
        <aside className="report-sidebar" aria-label="Example workspace">
          <div className="workspace-label">
            <span className="workspace-icon">
              <Cpu size={19} />
            </span>
            <span>
              Local workspace<small>DeviceBench / V1 preview</small>
            </span>
          </div>
          <button className="new-run" onClick={onStart}>
            <Plus size={16} /> Check my setup
          </button>
          <div className="sidebar-heading">EXPLORE THE TOOLS</div>
          <div role="group" aria-label="Choose a sample report">
            {examples.map(({ id, short, Icon }, i) => (
              <button
                key={id}
                className={`experiment${tool === i ? ' selected' : ''}`}
                aria-pressed={tool === i}
                onClick={() => {
                  setTool(i);
                  setTab('overview');
                }}
              >
                <Icon size={16} />
                <span>{short}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-context">
            <Info size={16} />
            <span>
              Illustrative reports<small>No hardware checked here.</small>
            </span>
          </div>
        </aside>
        <div className="report-main">
          <div className="report-toolbar">
            <span>
              <selected.Icon size={15} /> Readiness report
            </span>
            <button
              className="download-button"
              onClick={downloadExample}
              aria-label="Download example JSON"
            >
              <ArrowDownToLine size={15} />
              <span>Example JSON</span>
            </button>
          </div>
          <div className="sample-tool-picker">
            <label htmlFor="sample-tool">Example tool</label>
            <select
              id="sample-tool"
              value={tool}
              onChange={(event) => {
                setTool(Number(event.target.value));
                setTab('overview');
              }}
            >
              {examples.map(({ id, name }, i) => (
                <option key={id} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div
            className="report-tabs"
            role="tablist"
            aria-label="Report views"
            onKeyDown={navigateTabs}
          >
            {tabs.map(({ id, name, Icon }) => (
              <button
                key={id}
                role="tab"
                tabIndex={tab === id ? 0 : -1}
                aria-selected={tab === id}
                aria-controls="report-view"
                id={`tab-${id}`}
                onClick={() => setTab(id)}
              >
                <Icon size={15} />
                {name}
              </button>
            ))}
          </div>
          <div
            className="report-body"
            id="report-view"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
          >
            <div className="report-title">
              <div>
                <h3>{selected.name}</h3>
                <p>{selected.context}</p>
              </div>
            </div>
            {tab === 'overview' && (
              <>
                <div className="readiness-summary">
                  <h4>{selected.summary}</h4>
                  <p>{selected.detail}</p>
                </div>
                <div className="sample-findings">
                  {selected.findings.map((finding) => (
                    <article key={finding.title}>
                      <div>
                        <h4>{finding.title}</h4>
                        <span className={`sample-status ${finding.status}`}>
                          {finding.status === 'info'
                            ? 'Information'
                            : finding.status === 'warning'
                              ? 'Review'
                              : finding.status === 'pass'
                                ? 'Passed'
                                : 'Unsupported'}
                        </span>
                      </div>
                      <p>{finding.detail}</p>
                    </article>
                  ))}
                </div>
                <button className="text-button sample-next" onClick={() => setTab('next')}>
                  Understand the next step <ArrowUpRight size={15} />
                </button>
              </>
            )}
            {tab === 'next' && (
              <div className="sample-next-panel">
                <ListChecks size={28} strokeWidth={1.4} />
                <h4>What to do with this finding</h4>
                <p>{selected.next}</p>
                <a
                  className="text-link"
                  href={`#/docs/readiness-toolkit?section=${selected.guide}`}
                >
                  Read the tool guide <ArrowUpRight size={15} />
                </a>
                <button className="button dark" onClick={onStart}>
                  Check your own setup <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            {tab === 'evidence' && (
              <div className="raw-evidence">
                <p>
                  Sample data for this preview. A real report contains the findings observed on your
                  machine.
                </p>
                <pre tabIndex={0} aria-label="Illustrative report JSON">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div className="report-bottom">
            <Check size={14} /> Example only. Your local results depend on your runtime, model, and
            device.
          </div>
        </div>
      </div>
    </div>
  );
}
