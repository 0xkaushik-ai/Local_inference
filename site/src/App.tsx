import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileJson,
  Gauge,
  LifeBuoy,
  ListChecks,
  MonitorCheck,
  ScanEye,
} from 'lucide-react';
import Brand from './components/Brand';
import FitDemo from './components/FitDemo';
import Header from './components/Header';
import ReportPreview from './components/ReportPreview';
import StartDialog from './components/StartDialog';
import Workflow from './components/Workflow';
import Toolkit from './components/Toolkit';

const Documentation = lazy(() => import('./components/Documentation'));
// Decorative and animated, so it loads after first paint in its own chunk, and only on screens
// wide enough to show it beside the hero text.
const SignalTraces = lazy(() => import('./components/SignalTraces'));
const wideScreen = matchMedia('(min-width: 1081px)');
const subscribeToWidth = (callback: () => void) => {
  wideScreen.addEventListener('change', callback);
  return () => wideScreen.removeEventListener('change', callback);
};
const subscribeToHash = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};

export default function App() {
  const route = useSyncExternalStore(subscribeToHash, () => window.location.hash);
  useEffect(() => {
    if (!route.startsWith('#/docs/')) {
      document.title = 'DeviceBench — Know if local AI will run on your machine';
      if (route) document.getElementById(route.slice(1))?.scrollIntoView();
    }
  }, [route]);
  return route.startsWith('#/docs/') ? (
    <Suspense
      fallback={
        <main className="container docs-loading" aria-live="polite">
          Loading documentation…
        </main>
      }
    >
      <Documentation route={route} />
    </Suspense>
  ) : (
    <Home />
  );
}

const repository = 'https://github.com/0xkaushik-ai/Local_inference';
const questions = [
  {
    question: 'Where do the tools run?',
    answer:
      'On your computer. Open the DeviceBench application to start the local dashboard. The Linux preview bundles Python; your AI server and models are installed separately. This website explains the product and shows sample reports. Checks run only when you use the local application.',
  },
  {
    question: 'Which runtimes are supported?',
    answer:
      'Connect to native Ollama or an unauthenticated OpenAI-compatible API running on your own computer. Ollama provides the model metadata used by the memory checker; other APIs may not expose those details. Remote and authenticated endpoints are outside V1.',
  },
  {
    question: 'Does a passing check mean my app is production-ready?',
    answer:
      'A pass means a specific small check succeeded. Memory sizing is an estimate, and compatibility checks do not measure model quality or guarantee application reliability. Use the findings to guide testing with your own workload.',
  },
  {
    question: 'What can I export?',
    answer:
      'Download HTML for a readable report or JSON for structured findings and request/response evidence. The dashboard keeps recent reports for the current session, so download anything you want to keep. Reports include device and model details; review before sharing.',
  },
  {
    question: 'What is the current release status?',
    answer:
      'This is the V1 preview, version 0.2.0. Open Get started for available downloads and system requirements. The Linux x64 application has been verified on the build workstation. Windows/macOS applications, wider Linux validation, a distribution license, signing, and public publishing are pending.',
  },
];
const guides = [
  {
    Icon: MonitorCheck,
    title: 'Install and run',
    description: 'Open the app, connect your runtime, and collect your first report.',
    href: '#/docs/quickstart',
  },
  {
    Icon: ListChecks,
    title: 'Use the tools',
    description: 'Commands, supported features, estimates, and result statuses.',
    href: '#/docs/readiness-toolkit',
  },
  {
    Icon: ScanEye,
    title: 'Understand your results',
    description: 'What passed, unsupported, unavailable, and memory estimates mean.',
    href: '#/docs/readiness-toolkit?section=statuses-reports-and-limits',
  },
  {
    Icon: LifeBuoy,
    title: 'Check current support',
    description: 'Verified platforms, runtime support, and preview limitations.',
    href: '#/docs/overview',
  },
];

function Home() {
  const [startOpen, setStartOpen] = useState(false);
  const wide = useSyncExternalStore(subscribeToWidth, () => wideScreen.matches);
  const openSetup = () => setStartOpen(true);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header onStart={openSetup} />
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-grid">
            <div className="hero-content">
              <div className="hero-kicker">
                <span className="kicker-tag">V1 preview</span>
                <span>Tested on Linux. Windows and macOS validation is pending.</span>
              </div>
              <h1 id="hero-title">Know if local AI will run on your machine.</h1>
              <p>
                DeviceBench checks your runtime, estimates the memory a model needs at your context
                length, and tests the API features your app depends on. Everything runs on your
                computer.
              </p>
              <div className="hero-actions">
                <button className="button primary" onClick={openSetup}>
                  Get started
                </button>
                <a className="button secondary" href="#/docs/quickstart">
                  Read the quickstart
                </a>
              </div>
              <ul className="hero-facts" aria-label="Highlights">
                <li>No account</li>
                <li>No telemetry</li>
                <li>HTML and JSON reports</li>
              </ul>
            </div>
            <div className="demo-board">
              {wide && (
                <Suspense fallback={null}>
                  <SignalTraces />
                </Suspense>
              )}
              <FitDemo />
            </div>
          </div>
        </section>

        <section className="runtime-band" aria-label="Supported runtimes">
          <div className="container runtime-line">
            <span className="runtime-label">Works with</span>
            <a href="#/docs/readiness-toolkit">
              Ollama native API <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a href="#/docs/overview?section=runtime-support">
              Local OpenAI-compatible servers <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <span className="runtime-end">Desktop launcher, local dashboard, and CLI</span>
          </div>
        </section>

        <Toolkit onStart={openSetup} />
        <Workflow onStart={openSetup} />

        <section className="section product-section" aria-label="Interactive example report">
          <div className="container">
            <ReportPreview onStart={openSetup} />
            <p className="product-caption">
              Illustrative reports. Launch the local dashboard to check your own setup.
            </p>
          </div>
        </section>

        <section className="principles-band" id="capabilities" aria-labelledby="principles-title">
          <div className="container">
            <div className="section-head">
              <h2 id="principles-title">Honest about what it knows.</h2>
              <p>
                A check that cannot decide says so. Every result carries its evidence and its
                limits, so the next decision is yours to make.
              </p>
            </div>
            <div className="principle-grid">
              <article>
                <Gauge size={22} aria-hidden="true" />
                <h3>Runs on your computer</h3>
                <p>
                  The dashboard runs on 127.0.0.1 and talks only to the local runtime you choose. No
                  account, no telemetry, nothing uploaded.
                </p>
              </article>
              <article>
                <ScanEye size={22} aria-hidden="true" />
                <h3>Limits stay visible</h3>
                <p>
                  Estimates name their assumptions. Failed, unsupported, and unavailable are
                  different results, and missing hardware data stays unknown.
                </p>
              </article>
              <article>
                <FileJson size={22} aria-hidden="true" />
                <h3>Evidence you can keep</h3>
                <p>
                  Download readable HTML or structured JSON with the requests and responses behind
                  each finding. Review device details before sharing.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="section guides-section"
          id="documentation"
          aria-labelledby="guides-title"
        >
          <div className="container">
            <div className="section-head split">
              <h2 id="guides-title">Start with a guide.</h2>
              <p>
                Installation, tool references, and a clear record of what is validated and what
                comes next.
              </p>
            </div>
            <div className="guide-grid">
              {guides.map(({ Icon, title, description, href }) => (
                <a key={href} className="guide-card" href={href}>
                  <Icon size={20} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <ArrowRight className="guide-arrow" size={18} aria-hidden="true" />
                </a>
              ))}
            </div>
            <a className="text-link" href="#/docs/overview">
              <BookOpen size={16} aria-hidden="true" /> Browse all documentation
            </a>
          </div>
        </section>

        <section className="section faq-section" id="faq" aria-labelledby="faq-title">
          <div className="container faq-grid">
            <div className="section-head">
              <h2 id="faq-title">Questions, answered.</h2>
              <p>
                Still unsure? The <a href="#/docs/overview">documentation overview</a> covers
                support and limits in detail.
              </p>
            </div>
            <div className="faq-list">
              {questions.map(({ question, answer }) => (
                <details key={question}>
                  <summary>
                    {question}
                    <span className="faq-icon" aria-hidden="true" />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="closing-band" aria-labelledby="closing-title">
          <div className="container closing-grid">
            <h2 id="closing-title">Find out what runs on your machine.</h2>
            <div className="closing-action">
              <p>Start with Local AI Doctor. Keep a record of what works.</p>
              <div className="closing-buttons">
                <button className="button dark" onClick={openSetup}>
                  Get started
                </button>
                <a className="button outline-dark" href="#/docs/overview">
                  Read the documentation
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <StartDialog
        key={startOpen ? 'open' : 'closed'}
        open={startOpen}
        onClose={() => setStartOpen(false)}
      />
    </>
  );
}

function SiteFooter() {
  const columns = [
    {
      title: 'Product',
      links: [
        ['Readiness tools', '#tools'],
        ['Workflow', '#workflow'],
        ['Example report', '#product'],
        ['Questions', '#faq'],
      ],
    },
    {
      title: 'Documentation',
      links: [
        ['Quickstart', '#/docs/quickstart'],
        ['Tool reference', '#/docs/readiness-toolkit'],
        ['Benchmarks', '#/docs/benchmarks'],
        ['Release evidence', '#/docs/readiness-release'],
      ],
    },
    {
      title: 'Project',
      links: [
        ['Source on GitHub', repository],
        ['Roadmap', '#/docs/roadmap'],
        ['Engine research', '#/docs/engine-results'],
        ['Development', '#/docs/development'],
      ],
    },
  ];
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <a href="#main" aria-label="DeviceBench home">
            <Brand />
          </a>
          <p>Local AI readiness for developers. Diagnose, inspect, and test on your own machine.</p>
        </div>
        {columns.map(({ title, links }) => (
          <div className="footer-column" key={title}>
            <h2>{title}</h2>
            <ul>
              {links.map(([label, href]) => {
                const external = href.startsWith('http');
                return (
                  <li key={label}>
                    <a
                      href={href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer' : undefined}
                    >
                      {label}
                      {external && <ArrowUpRight size={13} aria-hidden="true" />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>DeviceBench V1 preview, version 0.2.0</span>
        <a href="#main">Back to top</a>
      </div>
    </footer>
  );
}
