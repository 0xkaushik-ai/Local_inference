import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** The opening of an inner page: a breadcrumb, its one h1, a short lede, and optional actions. */
export default function PageIntro({
  crumb,
  title,
  children,
  actions,
}: {
  crumb: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="page-intro" aria-labelledby="page-title">
      <div className="container">
        <p className="page-crumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{crumb}</span>
        </p>
        <h1 id="page-title">{title}</h1>
        <div className="page-lede">{children}</div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </section>
  );
}
