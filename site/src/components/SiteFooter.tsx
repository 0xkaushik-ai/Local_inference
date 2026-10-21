import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import Brand from './Brand';
import { docHref } from '../lib/docs-manifest';

const repository = 'https://github.com/0xkaushik-ai/Local_inference';
const columns = [
  {
    title: 'Product',
    links: [
      ['Readiness tools', '/tools'],
      ['How it works', '/how-it-works'],
      ['Example report', '/example-report'],
      ['Questions', '/#faq'],
    ],
  },
  {
    title: 'Documentation',
    links: [
      ['Quickstart', docHref('quickstart')],
      ['Tool reference', docHref('readiness-toolkit')],
      ['Benchmarks', docHref('benchmarks')],
      ['Release evidence', docHref('readiness-release')],
    ],
  },
  {
    title: 'Project',
    links: [
      ['Source on GitHub', repository],
      ['Roadmap', docHref('roadmap')],
      ['Engine research', docHref('engine-results')],
      ['Development', docHref('development')],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" aria-label="DeviceBench home">
            <Brand />
          </Link>
          <p>Local AI readiness for developers. Diagnose, inspect, and test on your own machine.</p>
        </div>
        {columns.map(({ title, links }) => (
          <div className="footer-column" key={title}>
            <h2>{title}</h2>
            <ul>
              {links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('http') ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      {label}
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  ) : (
                    <Link to={href}>{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>DeviceBench V1 preview, version 0.2.0</span>
        <a href="#main">Back to top</a>
      </div>
    </footer>
  );
}
