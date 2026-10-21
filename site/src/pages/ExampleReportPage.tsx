import { Link } from 'react-router';
import ClosingBand from '../components/ClosingBand';
import PageIntro from '../components/PageIntro';
import ReportPreview from '../components/ReportPreview';
import { docHref } from '../lib/docs-manifest';
import { useSetup } from '../lib/site-context';

// Status meanings follow docs/readiness-toolkit.md, "Statuses, reports, and limits".
const statuses = [
  ['pass', 'Passed', 'The recorded requirement was observed.'],
  ['fail', 'Failed', 'The observation did not satisfy the requirement.'],
  ['unsupported', 'Unsupported', 'A declared feature or endpoint is unsupported.'],
  [
    'unavailable',
    'Unavailable',
    'Infrastructure or protocol errors prevented a usable observation.',
  ],
  ['warning', 'Review', 'A limit to read before you rely on the result.'],
  ['info', 'Information', 'Context such as estimates, inventory, and recorded assumptions.'],
];
const exportFields = [
  ['tool, created_at', 'Which tool ran and when.'],
  ['endpoint, protocol', 'The runtime address and API that were checked.'],
  ['findings', 'Each status with its detail, next step, and evidence.'],
  ['hardware, models', 'Device and inventory details observed by the check.'],
  ['scope', 'What the report does and does not establish.'],
];

export default function ExampleReportPage() {
  const openSetup = useSetup();
  return (
    <>
      <title>Example report — DeviceBench</title>
      <PageIntro
        crumb="Example report"
        title="See a report before you run one."
        actions={<span className="sample-badge">Sample data</span>}
      >
        <p>
          Every check ends with a plain verdict, the findings behind it, and a next step. Pick a
          tool to explore a sample report. Nothing on this page checks your device.
        </p>
      </PageIntro>

      <section
        className="section product-section flush"
        id="product"
        aria-label="Interactive example report"
      >
        <div className="container">
          <ReportPreview onStart={openSetup} />
          <p className="product-caption">
            Illustrative reports. Launch the local dashboard to check your own setup.
          </p>
        </div>
      </section>

      <section className="section statuses-section" aria-labelledby="statuses-title">
        <div className="container">
          <div className="section-head split">
            <h2 id="statuses-title">Read the results.</h2>
            <p>
              Each finding has one status. Failed, unsupported, and unavailable mean different
              things, so a completed check does not automatically mean everything passed.
            </p>
          </div>
          <dl className="status-grid">
            {statuses.map(([status, label, meaning]) => (
              <div key={status}>
                <dt>
                  <span className={`status-badge ${status}`}>{label}</span>
                </dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section exports-section" aria-labelledby="exports-title">
        <div className="container exports-grid">
          <div className="section-head">
            <h2 id="exports-title">Keep the evidence.</h2>
            <p>
              Download a readable HTML report for people, or JSON for your code. Both keep the
              statuses, assumptions, prompts, and response evidence. Reports include device and
              model details, so review them before sharing.
            </p>
            <Link
              className="text-link section-link"
              to={docHref('readiness-toolkit', 'statuses-reports-and-limits')}
            >
              Read about reports and limits
            </Link>
          </div>
          <dl className="field-list">
            {exportFields.map(([field, meaning]) => (
              <div key={field}>
                <dt>
                  <code translate="no">{field}</code>
                </dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <ClosingBand
        title="Run a report on your own machine."
        text="Your local results depend on your runtime, model, and device."
      />
    </>
  );
}
