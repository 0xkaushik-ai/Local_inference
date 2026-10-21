import { lazy, Suspense, useSyncExternalStore } from 'react';
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
import { Link } from 'react-router';
import ClosingBand from '../components/ClosingBand';
import FitDemo from '../components/FitDemo';
import Toolkit from '../components/Toolkit';
import { docHref } from '../lib/docs-manifest';
import { useSetup } from '../lib/site-context';

// Decorative and animated, so it loads after first paint in its own chunk, and only on screens
// wide enough to show it beside the hero text.
const SignalTraces = lazy(() => import('../components/SignalTraces'));
const wideScreen = matchMedia('(min-width: 1081px)');
const subscribeToWidth = (callback: () => void) => {
  wideScreen.addEventListener('change', callback);
  return () => wideScreen.removeEventListener('change', callback);
};

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
    to: docHref('quickstart'),
  },
  {
    Icon: ListChecks,
    title: 'Use the tools',
    description: 'Commands, supported features, estimates, and result statuses.',
    to: docHref('readiness-toolkit'),
  },
  {
    Icon: ScanEye,
    title: 'Understand your results',
    description: 'What passed, unsupported, unavailable, and memory estimates mean.',
    to: docHref('readiness-toolkit', 'statuses-reports-and-limits'),
  },
  {
    Icon: LifeBuoy,
    title: 'Check current support',
    description: 'Verified platforms, runtime support, and preview limitations.',
    to: docHref('overview'),
  },
];

export default function HomePage() {
  const openSetup = useSetup();
  const wide = useSyncExternalStore(subscribeToWidth, () => wideScreen.matches);
  return (
    <>
      <title>DeviceBench — Know if local AI will run on your machine</title>
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
              <Link className="button secondary" to={docHref('quickstart')}>
                Read the quickstart
              </Link>
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
          <Link to={docHref('readiness-toolkit')}>
            Ollama native API <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <Link to={docHref('overview', 'runtime-support')}>
            Local OpenAI-compatible servers <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <span className="runtime-end">Desktop launcher, local dashboard, and CLI</span>
        </div>
      </section>

      <Toolkit onStart={openSetup} />

      <section className="section explore-section" aria-labelledby="explore-title">
        <div className="container">
          <div className="section-head split">
            <h2 id="explore-title">See it before you install it.</h2>
            <p>
              Walk through the workflow step by step, or open an interactive sample report. Nothing
              on these pages touches your device.
            </p>
          </div>
          <div className="explore-grid">
            <Link className="explore-card" to="/how-it-works">
              <div className="explore-visual steps-visual" aria-hidden="true">
                {['Diagnose', 'Inspect', 'Test', 'Export'].map((step, index) => (
                  <span key={step}>
                    <i>{index + 1}</i>
                    {step}
                  </span>
                ))}
              </div>
              <h3>How it works</h3>
              <p>
                Four steps from setup to evidence, and exactly what runs where on your computer.
              </p>
              <span className="text-link">
                Explore the workflow <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
            <Link className="explore-card" to="/example-report">
              <div className="explore-visual report-visual" aria-hidden="true">
                <span data-status="pass">Streaming</span>
                <span data-status="pass">Structured JSON</span>
                <span data-status="review">Tool calling</span>
              </div>
              <h3>Example report</h3>
              <p>Findings, next steps, and the raw evidence behind an interactive sample report.</p>
              <span className="text-link">
                Open the example <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="principles-band" id="capabilities" aria-labelledby="principles-title">
        <div className="container">
          <div className="section-head">
            <h2 id="principles-title">Honest about what it knows.</h2>
            <p>
              A check that cannot decide says so. Every result carries its evidence and its limits,
              so the next decision is yours to make.
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
                Estimates name their assumptions. Failed, unsupported, and unavailable are different
                results, and missing hardware data stays unknown.
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

      <section className="section guides-section" id="documentation" aria-labelledby="guides-title">
        <div className="container">
          <div className="section-head split">
            <h2 id="guides-title">Start with a guide.</h2>
            <p>
              Installation, tool references, and a clear record of what is validated and what comes
              next.
            </p>
          </div>
          <div className="guide-grid">
            {guides.map(({ Icon, title, description, to }) => (
              <Link key={to} className="guide-card" to={to}>
                <Icon size={20} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
                <ArrowRight className="guide-arrow" size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link className="text-link" to="/docs">
            <BookOpen size={16} aria-hidden="true" /> Browse all documentation
          </Link>
        </div>
      </section>

      <section className="section faq-section" id="faq" aria-labelledby="faq-title">
        <div className="container faq-grid">
          <div className="section-head">
            <h2 id="faq-title">Questions, answered.</h2>
            <p>
              Still unsure? The <Link to={docHref('overview')}>documentation overview</Link> covers
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

      <ClosingBand />
    </>
  );
}
