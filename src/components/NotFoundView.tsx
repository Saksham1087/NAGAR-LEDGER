interface NotFoundViewProps {
  attemptedPath: string;
  onBackHome: () => void;
  onOpenReport: () => void;
}

export function NotFoundView({
  attemptedPath,
  onBackHome,
  onOpenReport,
}: NotFoundViewProps) {
  return (
    <section className="section" aria-labelledby="not-found-heading">
      <div className="container">
        <div className="not-found-box">
          <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}>
            HTTP 404 · UNINDEXED WARD ROUTE
          </span>
          <h1 id="not-found-heading" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>
            Missing Municipal Record
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            The ledger path <code className="mono">{attemptedPath}</code> does not match an
            active Mira-Bhayandar ward register, ticket serial, or scorecard route.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn--primary" onClick={onBackHome}>
              Return to Live Dispatch Ledger
            </button>
            <button type="button" className="btn btn--secondary" onClick={onOpenReport}>
              Log a Civic Issue
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
