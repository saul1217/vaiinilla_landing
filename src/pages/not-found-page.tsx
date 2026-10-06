import { Link } from 'react-router-dom';
import { PageShell } from '../components/shell';

export function NotFoundPage({
  title = 'No encontramos esa página',
  lead = 'Revisa el enlace o vuelve al inicio.',
  cta = { to: '/', label: 'Ir al inicio' },
}: {
  title?: string;
  lead?: string;
  cta?: { to: string; label: string };
}) {
  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container">
          <p className="eyebrow">404</p>
          <h1>{title}</h1>
          <p className="app-lead">{lead}</p>
          <Link className="btn btn--primary" to={cta.to}>
            {cta.label}
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
