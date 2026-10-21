import { Link } from 'react-router';
import PageIntro from '../components/PageIntro';

export default function NotFoundPage() {
  return (
    <>
      <title>Page not found — DeviceBench</title>
      <PageIntro
        crumb="Not found"
        title="This page doesn’t exist."
        actions={
          <>
            <Link className="button primary" to="/">
              Go to the home page
            </Link>
            <Link className="button secondary" to="/docs">
              Browse the documentation
            </Link>
          </>
        }
      >
        <p>The address may be mistyped, or the page may have moved.</p>
      </PageIntro>
    </>
  );
}
