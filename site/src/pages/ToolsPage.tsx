import { Link } from 'react-router';
import ClosingBand from '../components/ClosingBand';
import PageIntro from '../components/PageIntro';
import { ToolGrid, ToolkitFoot } from '../components/Toolkit';
import { docHref } from '../lib/docs-manifest';
import { useSetup } from '../lib/site-context';

const comparison = [
  {
    tool: 'Local AI Doctor',
    answers: 'Is my setup working?',
    checks:
      'Runtime connection and version, installed models, model placement, CPU, memory, and GPU data.',
    inference: 'No. It never loads a model.',
    command: 'devicebench doctor',
  },
  {
    tool: 'Model & Context Checker',
    answers: 'What will this model need?',
    checks:
      'Declared context limit, a memory estimate with its assumptions, and fit against free memory in each pool.',
    inference: 'No. It reads model metadata.',
    command: 'devicebench inspect --model NAME --context 4096',
  },
  {
    tool: 'App Compatibility Tester',
    answers: 'Will it work with my app?',
    checks: 'Streaming, structured JSON, tool calling, and embeddings, one small request each.',
    inference:
      'Yes. Models may stay loaded for five minutes. Tool calls are checked, never executed.',
    command: 'devicebench compat --model NAME --checks streaming json',
  },
];
const exitCodes = [
  ['0', 'No failed, unsupported, or unavailable requirements. Warnings may still be present.'],
  ['1', 'At least one requirement failed or is unsupported.'],
  ['2', 'The runtime was unavailable or an error prevented a usable observation.'],
];

export default function ToolsPage() {
  const openSetup = useSetup();
  return (
    <>
      <title>Readiness tools — DeviceBench</title>
      <PageIntro
        crumb="Tools"
        title="Three tools for local AI readiness."
        actions={
          <>
            <button className="button primary" onClick={openSetup}>
              Get started
            </button>
            <Link className="button secondary" to={docHref('readiness-toolkit')}>
              Read the tool reference
            </Link>
          </>
        }
      >
        <p>
          Each tool answers one question about your setup, your model, or your app. Use them in
          order or on their own, in the local dashboard or from the command line.
        </p>
      </PageIntro>

      <section className="section toolkit-section flush" id="tools" aria-label="The three tools">
        <div className="container">
          <ToolGrid />
          <ToolkitFoot onStart={openSetup} />
        </div>
      </section>

      <section className="section compare-section" aria-labelledby="compare-title">
        <div className="container">
          <div className="section-head split">
            <h2 id="compare-title">Compare the tools.</h2>
            <p>
              What each tool reads, whether it sends requests to your model, and how to run it from
              a terminal.
            </p>
          </div>
          <div className="compare-table" role="region" aria-label="Tool comparison" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Checks</th>
                  <th scope="col">Sends inference requests</th>
                  <th scope="col">Command</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(({ tool, answers, checks, inference, command }) => (
                  <tr key={tool}>
                    <th scope="row">
                      {tool}
                      <span>{answers}</span>
                    </th>
                    <td>{checks}</td>
                    <td>{inference}</td>
                    <td>
                      <code translate="no">{command}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section scripts-section" aria-labelledby="scripts-title">
        <div className="container scripts-grid">
          <div className="section-head">
            <h2 id="scripts-title">Use it in scripts.</h2>
            <p>
              Every tool also runs from the command line and writes the same HTML and JSON reports.
              Exit codes let you gate a build on the result.
            </p>
            <Link className="text-link section-link" to={docHref('readiness-toolkit')}>
              Read the command reference
            </Link>
          </div>
          <div>
            <pre className="terminal-sample" tabIndex={0} aria-label="Example command">
              <code translate="no">
                devicebench compat --model NAME --checks streaming json --out reports/compat
              </code>
            </pre>
            <dl className="exit-codes">
              {exitCodes.map(([code, meaning]) => (
                <div key={code}>
                  <dt>
                    Exit <code>{code}</code>
                  </dt>
                  <dd>{meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <ClosingBand
        title="Run the three checks on your machine."
        text="The Linux preview bundles Python and the dashboard. Bring your own runtime and models."
      />
    </>
  );
}
