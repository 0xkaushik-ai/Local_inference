import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/ibm-plex-sans/standard.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import App from './App';
import { legacyDocPath } from './lib/docs-manifest';
import './styles.css';

// Keep links from the earlier hash-based site working: rewrite them before the router reads the URL.
const legacySections: Record<string, string> = {
  '#workflow': '/how-it-works',
  '#product': '/example-report',
};
const legacy =
  legacyDocPath(window.location.hash) ??
  (window.location.pathname === '/' ? legacySections[window.location.hash] : undefined);
if (legacy) window.history.replaceState(null, '', legacy);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
