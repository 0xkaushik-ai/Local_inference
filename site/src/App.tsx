import { lazy, Suspense, useEffect, useRef } from 'react';
import { Route, Routes, useLocation, useNavigationType } from 'react-router';
import SiteLayout from './components/SiteLayout';
import ExampleReportPage from './pages/ExampleReportPage';
import HomePage from './pages/HomePage';
import HowItWorksPage from './pages/HowItWorksPage';
import NotFoundPage from './pages/NotFoundPage';
import ToolsPage from './pages/ToolsPage';

const Documentation = lazy(() => import('./components/Documentation'));

/**
 * Scroll like a multi-page site: new pages start at the top, and `#section` links (including on
 * first load) scroll to their target. Back, forward, and reloads keep the browser's restoration.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  const navigation = useNavigationType();
  const initial = useRef(true);
  useEffect(() => {
    const firstRender = initial.current;
    initial.current = false;
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    else if (!firstRender && navigation !== 'POP') window.scrollTo(0, 0);
  }, [pathname, hash, navigation]);
  return null;
}

/**
 * Site routes. Marketing pages share the site layout; documentation has its own reader layout and
 * loads lazily. Unknown paths render the not-found page inside the site layout.
 */
export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="example-report" element={<ExampleReportPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route
          path="docs/:id?"
          element={
            <Suspense
              fallback={
                <main className="container docs-loading" aria-live="polite">
                  Loading documentation…
                </main>
              }
            >
              <Documentation />
            </Suspense>
          }
        />
      </Routes>
    </>
  );
}
