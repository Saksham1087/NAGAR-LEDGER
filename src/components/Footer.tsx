import { ArrowUp, Download } from 'lucide-react';
import { MBMC_HELPLINES } from '../data/miraBhayandarData';
import type { TranslationBundle } from '../data/translations';

interface FooterProps {
  t: TranslationBundle;
  onNavigate: (path: string, anchorId?: string) => void;
  onExportAllJson: () => void;
}

export function Footer({ t, onNavigate, onExportAllJson }: FooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0 });
  };

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="brand-wordmark">NAGAR-LEDGER</div>
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                marginTop: '0.65rem',
                maxWidth: '34ch',
              }}
            >
              Mira-Bhayandar Public Works &amp; Civic Accountability Ledger (Wards 1–24).
              Built for rapid citizen reporting and public SLA auditability.
            </p>
          </div>

          <div>
            <div className="footer-heading">LEDGER SECTIONS</div>
            <ul className="footer-links">
              <li>
                <a
                  href="/#live-ledger"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/', 'live-ledger');
                  }}
                >
                  {t.nav.ledger}
                </a>
              </li>
              <li>
                <a
                  href="/#priority-engine"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/', 'priority-engine');
                  }}
                >
                  {t.nav.priority}
                </a>
              </li>
              <li>
                <a
                  href="/wards"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/wards', 'ward-scorecard');
                  }}
                >
                  {t.nav.wards}
                </a>
              </li>
              <li>
                <a
                  href="/#citizen-audit"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/', 'citizen-audit');
                  }}
                >
                  {t.nav.audit}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="footer-heading">MBMC EMERGENCY HELPLINES</div>
            <ul className="footer-links">
              {MBMC_HELPLINES.map((line) => (
                <li key={line.label}>
                  <div style={{ fontWeight: 600 }}>{line.label}</div>
                  <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {line.phone} · {line.hours}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="footer-heading">OPEN CIVIC DATA</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'flex-start' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={onExportAllJson}
              >
                <Download size={14} strokeWidth={1.5} aria-hidden="true" />
                <span>{t.actions.exportJson}</span>
              </button>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                WCAG 2.2 AA accessible · Zero-tracker prototype persisting locally in browser
                storage.
              </p>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            NAGAR-LEDGER · Mira-Bhayandar Wards 1–24 Civic Works Prototype · Maharashtra
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={scrollToTop}
            aria-label="Back to top"
          >
            <ArrowUp size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>Back to top</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
