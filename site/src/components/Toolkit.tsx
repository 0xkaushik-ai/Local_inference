import { ArrowRight, Cable, Check, Cpu, Stethoscope } from 'lucide-react';

const tools = [
  {
    Icon: Stethoscope,
    title: 'Local AI Doctor',
    guide: 'local-ai-doctor',
    question: 'Is my setup working?',
    text: 'Check runtime connectivity, installed models, hardware information, and reported memory placement. Get next steps for observed problems.',
    points: [
      'Runtime reachability and version',
      'Installed model inventory',
      'CPU, memory, and GPU data',
    ],
  },
  {
    Icon: Cpu,
    title: 'Model & Context Checker',
    guide: 'model-and-context-checker',
    question: 'What will this model need?',
    text: 'Inspect model metadata and estimate memory for supported architectures. Estimates, unknowns, and declared context limits stay distinct.',
    points: [
      'Declared context limit',
      'Memory estimate with assumptions',
      'Fit against free memory',
    ],
  },
  {
    Icon: Cable,
    title: 'App Compatibility Tester',
    guide: 'app-compatibility-tester',
    question: 'Will it work with my app?',
    text: 'Verify streaming, structured JSON, tool calling, or embeddings with small real requests. Inspect the responses and request examples.',
    points: [
      'Only the features you select',
      'Request and response evidence',
      'Tool calls checked, not run',
    ],
  },
];

export default function Toolkit({ onStart }: { onStart: () => void }) {
  return (
    <section className="section toolkit-section" id="tools" aria-labelledby="tools-title">
      <div className="container">
        <div className="section-head split">
          <h2 id="tools-title">Three checks, one local workspace.</h2>
          <p>
            Start with your setup, then size a model, then test what your app needs. Each tool also
            works on its own, in the dashboard or from the command line.
          </p>
        </div>
        <ol className="tool-grid">
          {tools.map(({ Icon, title, text, guide, question, points }, index) => (
            <li key={title}>
              <article className="tool-card">
                <div className="tool-top">
                  <span className="tool-icon">
                    <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="tool-step">Step {index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p className="tool-question">{question}</p>
                <p>{text}</p>
                <ul className="tool-points">
                  {points.map((point) => (
                    <li key={point}>
                      <Check size={15} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <a
                  className="text-link tool-guide"
                  href={`#/docs/readiness-toolkit?section=${guide}`}
                >
                  Read the guide <ArrowRight size={15} aria-hidden="true" />
                </a>
              </article>
            </li>
          ))}
        </ol>
        <div className="toolkit-foot">
          <p>
            Use the Linux application preview with your existing AI server and models. Python is
            bundled. Windows and macOS applications are pending; developer setup is also available.
          </p>
          <button className="button dark" onClick={onStart}>
            Set up the local toolkit
          </button>
        </div>
      </div>
    </section>
  );
}
