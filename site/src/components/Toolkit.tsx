import { ArrowUpRight, Cable, Cpu, Stethoscope } from 'lucide-react';

export default function Toolkit({ onStart }: { onStart: () => void }) {
  return (
    <section className="toolkit-section container" id="tools">
      <div className="section-topline">
        <span className="section-label">01 / The readiness toolkit</span>
      </div>
      <h2>
        Three tools.
        <br />
        One clearer starting point.
      </h2>
      <p>
        Three tools share one local dashboard. Start with Ollama, or test a local OpenAI-compatible
        API.
      </p>
      <div className="feature-grid">
        {[
          {
            icon: Stethoscope,
            title: 'Local AI Doctor',
            guide: 'local-ai-doctor',
            question: 'Is my setup working?',
            text: 'Check runtime connectivity, installed models, hardware information, and reported memory placement. Get next steps for observed problems.',
          },
          {
            icon: Cpu,
            title: 'Model & Context Checker',
            guide: 'model-and-context-checker',
            question: 'What will this model need?',
            text: 'Inspect model metadata and estimate memory for supported architectures. Estimates, unknowns, and declared context limits stay distinct.',
          },
          {
            icon: Cable,
            title: 'App Compatibility Tester',
            guide: 'app-compatibility-tester',
            question: 'Will it work with my app?',
            text: 'Verify streaming, structured JSON, tool calling, or embeddings with small real requests. Inspect the responses and request examples.',
          },
        ].map(({ icon: Icon, title, text, guide, question }) => (
          <article className="feature-card" key={title}>
            <div className="feature-copy">
              <Icon size={28} strokeWidth={1.4} aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <span className="tool-question">{question}</span>
              </div>
              <div>
                <p>{text}</p>
                <a
                  className="text-link tool-guide"
                  href={`#/docs/readiness-toolkit?section=${guide}`}
                >
                  Read the guide <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p>
        Use the Linux application preview with your existing AI server and models. Python is
        bundled. Windows and macOS applications are pending; developer setup is also available.
      </p>
      <button className="button dark" onClick={onStart}>
        Set up the local toolkit <ArrowUpRight size={15} />
      </button>
    </section>
  );
}
