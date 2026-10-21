import { Link } from 'react-router';
import { docHref } from '../lib/docs-manifest';
import { useSetup } from '../lib/site-context';

export default function ClosingBand({
  title = 'Find out what runs on your machine.',
  text = 'Start with Local AI Doctor. Keep a record of what works.',
}: {
  title?: string;
  text?: string;
}) {
  const openSetup = useSetup();
  return (
    <section className="closing-band" aria-labelledby="closing-title">
      <div className="container closing-grid">
        <h2 id="closing-title">{title}</h2>
        <div className="closing-action">
          <p>{text}</p>
          <div className="closing-buttons">
            <button className="button dark" onClick={openSetup}>
              Get started
            </button>
            <Link className="button outline-dark" to={docHref('overview')}>
              Read the documentation
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
