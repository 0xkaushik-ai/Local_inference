import { AppWindow, Boxes, Check, Laptop, MonitorSmartphone, Server } from 'lucide-react';
import { Link } from 'react-router';
import ClosingBand from '../components/ClosingBand';
import PageIntro from '../components/PageIntro';
import Workflow from '../components/Workflow';
import { docHref } from '../lib/docs-manifest';
import { useSetup } from '../lib/site-context';

const nodes = [
  {
    Icon: AppWindow,
    name: 'DeviceBench launcher',
    detail: 'Starts the local service and opens your browser. Stop or quit it from here.',
  },
  {
    Icon: MonitorSmartphone,
    name: 'Local dashboard',
    detail: 'Runs the three tools in your browser.',
    address: '127.0.0.1:8766',
  },
  {
    Icon: Server,
    name: 'Your AI runtime',
    detail: 'Ollama or an unauthenticated OpenAI-compatible server.',
    address: '127.0.0.1:11434',
  },
  {
    Icon: Boxes,
    name: 'Your models',
    detail: 'Installed through your runtime. DeviceBench never downloads models.',
  },
];
const requirements = [
  {
    title: 'The Linux application preview',
    detail:
      'A Linux x86_64 desktop with glibc 2.42 or newer. Python and the dashboard are bundled; no source checkout or build is needed.',
  },
  {
    title: 'Or a developer setup',
    detail:
      'Python 3.11 or newer and a source checkout, on Linux, Windows, or macOS. Windows and macOS validation is still pending.',
  },
  {
    title: 'A local AI runtime with a model',
    detail:
      'Ollama, or an OpenAI-compatible server without authentication, running on the same computer with at least one model installed.',
  },
];

export default function HowItWorksPage() {
  const openSetup = useSetup();
  return (
    <>
      <title>How it works — DeviceBench</title>
      <PageIntro
        crumb="How it works"
        title="From setup to evidence, on your own machine."
        actions={
          <Link className="button secondary" to={docHref('quickstart')}>
            Read the quickstart
          </Link>
        }
      >
        <p>
          A desktop launcher starts a local dashboard in your browser. The dashboard talks only to
          the AI runtime on your computer, and every check ends in a report you can keep.
        </p>
      </PageIntro>

      <Workflow onStart={openSetup} />

      <section className="section architecture-section" aria-labelledby="architecture-title">
        <div className="container">
          <div className="section-head split">
            <h2 id="architecture-title">What runs where.</h2>
            <p>
              Every connection stays on the loopback address. The runtime address is configurable,
              but remote and authenticated endpoints are outside the V1 preview.
            </p>
          </div>
          <figure className="architecture">
            <figcaption className="architecture-boundary">
              <Laptop size={16} aria-hidden="true" /> Your computer
            </figcaption>
            <ol className="architecture-flow">
              {nodes.map(({ Icon, name, detail, address }) => (
                <li key={name}>
                  <span className="node-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <strong>{name}</strong>
                  {address && (
                    <code className="node-address" translate="no">
                      {address}
                    </code>
                  )}
                  <span>{detail}</span>
                </li>
              ))}
            </ol>
            <p className="architecture-note">
              No account, no telemetry, and nothing uploaded. Reports are created on your computer
              and downloaded by you.
            </p>
          </figure>
        </div>
      </section>

      <section className="section requirements-section" aria-labelledby="requirements-title">
        <div className="container requirements-grid">
          <div className="section-head">
            <h2 id="requirements-title">What you need.</h2>
            <p>
              Install your runtime and a model first. Local AI Doctor can still diagnose a runtime
              that is not running yet.
            </p>
            <Link className="text-link section-link" to={docHref('overview')}>
              See current support and limits
            </Link>
          </div>
          <ul className="requirement-list">
            {requirements.map(({ title, detail }) => (
              <li key={title}>
                <Check size={18} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ClosingBand
        title="Start with your setup."
        text="Open the launcher, run Local AI Doctor, and keep the report."
      />
    </>
  );
}
