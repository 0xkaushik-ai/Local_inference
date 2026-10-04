import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowUpRight, ArrowRight } from 'lucide-react';
import Brand from './components/Brand';
import Header from './components/Header';
import ReportPreview from './components/ReportPreview';
import StartDialog from './components/StartDialog';
import Workflow from './components/Workflow';
import Toolkit from './components/Toolkit';

const Documentation = lazy(() => import('./components/Documentation'));
const subscribeToHash = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};

export default function App() {
  const route = useSyncExternalStore(subscribeToHash, () => window.location.hash);
  useEffect(() => {
    if (!route.startsWith('#/docs/')) {
      document.title = 'DeviceBench — Local AI readiness';
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
      'On your computer. Start the Python companion to use the three readiness tools in a local dashboard, or use the CLI. This website explains the product and shows sample reports. Your device is checked only by the companion you run locally.',
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
      'This is the V1 preview, currently available through the source setup. Linux has recorded live validation. Windows/macOS validation, a distribution license, and public package publishing are still pending. The internal Python package version is 0.2.0.',
  },
];

function Home() {
  const [startOpen, setStartOpen] = useState(false);
  const openSetup = () => setStartOpen(true);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header onStart={openSetup} />
      <main id="main">
        <section className="hero container">
          <div className="hero-kicker">
            <span className="brand-tick" /> Local AI readiness / V1 preview{' '}
            <span className="hero-edition">Your machine. Clear next steps.</span>
          </div>
          <div className="hero-copy">
            <h1>
              Local AI.
              <br />
              Ready for <span>you?</span>
            </h1>
            <div className="hero-content">
              <p>
                Find setup problems, understand model requirements, and test the features your app
                needs. Three practical tools, in one local workspace.
              </p>
              <div className="hero-actions">
                <button className="button dark" onClick={openSetup}>
                  Get started <ArrowUpRight size={17} />
                </button>
                <a className="hero-secondary" href="#tools">
                  Explore the tools <ArrowDown size={16} />
                </a>
              </div>
              <span className="hero-footnote">
                Runs locally · No account required · Linux verified
              </span>
            </div>
          </div>
          <div className="runtime-line" aria-label="Runtime support by workflow">
            <span>Readiness tools</span>
            <a href="#/docs/readiness-toolkit">
              Ollama <ArrowUpRight size={13} />
            </a>
            <a href="#/docs/overview?section=runtime-support">
              Local OpenAI-compatible APIs <ArrowUpRight size={13} />
            </a>
            <span className="runtime-end">CLI + local dashboard</span>
          </div>
        </section>

        <Toolkit onStart={openSetup} />
        <Workflow onStart={openSetup} />

        <section className="product-section container" aria-label="Interactive example report">
          <ReportPreview onStart={openSetup} />
          <p className="product-caption">
            <span>Fig. 01</span> Illustrative reports. Launch the local dashboard to check your own
            setup.
          </p>
        </section>

        <section className="principles container" id="capabilities">
          <div className="section-heading">
            <span className="section-label">03 / Make the next decision</span>
            <h2>
              Useful answers.
              <br />
              Visible limitations.
            </h2>
            <p>
              Understand what worked, what needs attention, and what the tool could not determine.
            </p>
          </div>
          <div className="measure-list">
            <article>
              <span className="measure-number">01</span>
              <h3>See the finding</h3>
              <p>
                Connection problems, unsupported features, and missing data have distinct results. A
                completed check does not automatically mean everything passed.
              </p>
              <span className="measure-unit">Clear result statuses</span>
            </article>
            <article>
              <span className="measure-number">02</span>
              <h3>Understand the limits</h3>
              <p>
                Memory estimates include assumptions. Compatibility checks include the observed
                responses. Missing hardware or model data stays visible.
              </p>
              <span className="measure-unit">Evidence with context</span>
            </article>
            <article>
              <span className="measure-number">03</span>
              <h3>Keep a useful record</h3>
              <p>
                Download a readable HTML report or structured JSON. Share the details your teammate
                needs to investigate the same setup.
              </p>
              <span className="measure-unit">Export when you choose</span>
            </article>
          </div>
        </section>

        <section className="documentation-section container" id="documentation">
          <div className="section-heading">
            <span className="section-label">04 / Documentation</span>
            <h2>
              From first check
              <br />
              to useful evidence.
            </h2>
            <p>
              Installation, tool references, and a clear record of what is validated and what comes
              next.
            </p>
          </div>
          <div className="guide-list">
            {[
              [
                '01',
                'Install and run',
                'Launch the local companion and collect your first report.',
                'quickstart',
              ],
              [
                '02',
                'Use the tools',
                'Commands, supported features, estimates, and result statuses.',
                'readiness-toolkit',
              ],
              [
                '03',
                'Understand your results',
                'What pass, unsupported, unavailable, and memory estimates mean.',
                'readiness-toolkit?section=statuses-reports-and-limits',
              ],
              [
                '04',
                'Check current support',
                'Verified platforms, runtime support, and preview limitations.',
                'overview',
              ],
            ].map(([number, title, description, id]) => (
              <a key={id} href={`#/docs/${id}`}>
                <span className="measure-number">{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <ArrowUpRight size={20} />
              </a>
            ))}
          </div>
          <a className="text-link" href="#/docs/overview">
            Browse all documentation <ArrowUpRight size={16} />
          </a>
        </section>

        <section className="faq-section container">
          <div>
            <span className="section-label">05 / Before you start</span>
            <h2>A few practical details.</h2>
          </div>
          <div className="faq-list">
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <span className="faq-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing-section container">
          <div>
            <span className="section-label">Your hardware. Your results.</span>
            <h2>
              See what
              <br />
              runs <em>here.</em>
            </h2>
          </div>
          <div className="closing-action">
            <p>
              Start with your runtime.
              <br />
              Keep a record of what works.
            </p>
            <button className="button dark" onClick={openSetup}>
              Get started <ArrowRight size={17} />
            </button>
            <a href="#/docs/quickstart">
              Read the documentation <ArrowUpRight size={14} />
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer container">
        <div className="footer-top">
          <a href="#" aria-label="DeviceBench home">
            <Brand />
          </a>
          <p>A toolkit for local AI readiness.</p>
          <div>
            <a href={repository} target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={13} />
            </a>
            <a href="#/docs/overview">Documentation</a>
            <a href="#/docs/benchmarks">Benchmarks</a>
            <a href="#/docs/engine-results">Research</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>DeviceBench / V1 preview · Diagnose. Inspect. Test.</span>
          <a href="#main">Back to top ↑</a>
        </div>
      </footer>
      <StartDialog
        key={startOpen ? 'open' : 'closed'}
        open={startOpen}
        onClose={() => setStartOpen(false)}
      />
    </>
  );
}
