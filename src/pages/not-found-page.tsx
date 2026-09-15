import { Link } from 'react-router-dom';
import { PageShell } from '../components/shell';

export function NotFoundPage() {
  return (
    <PageShell>
      <main id="main-content" className="app-page">
        <div className="container">
          <p className="eyebrow">404</p>
          <h1>No encontramos esa página</h1>
          <p className="app-lead">Revisa el enlace o vuelve al inicio.</p>
          <Link className="btn btn--primary" to="/">
            Ir al inicio
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
