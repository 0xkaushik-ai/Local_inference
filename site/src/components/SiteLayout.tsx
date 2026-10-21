import { useState } from 'react';
import { Outlet } from 'react-router';
import Header from './Header';
import SiteFooter from './SiteFooter';
import StartDialog from './StartDialog';
import type { SiteContext } from '../lib/site-context';

/** Shared frame for the marketing pages: header, page content, footer, and the setup dialog. */
export default function SiteLayout() {
  const [startOpen, setStartOpen] = useState(false);
  const context: SiteContext = { openSetup: () => setStartOpen(true) };
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header onStart={context.openSetup} />
      <main id="main">
        <Outlet context={context} />
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
