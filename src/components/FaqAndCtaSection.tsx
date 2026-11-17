import { useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { FAQ_ITEMS, MIRA_BHAYANDAR_LOCALITIES } from '../data/miraBhayandarData';
import type { TranslationBundle } from '../data/translations';

interface FaqAndCtaSectionProps {
  t: TranslationBundle;
  onOpenReport: (preselectedLocalityId?: string) => void;
}

export function FaqAndCtaSection({ t, onOpenReport }: FaqAndCtaSectionProps) {
  const [quickLocality, setQuickLocality] = useState<string>(
    MIRA_BHAYANDAR_LOCALITIES[0].id
  );
  const selectedLoc = MIRA_BHAYANDAR_LOCALITIES.find((l) => l.id === quickLocality);

  return (
    <>
      <section className="section" aria-labelledby="faq-heading">
        <div className="container">
          <div className="section-header">
            <span className="section-index">05. PROCESS &amp; GOVERNANCE FAQ</span>
            <h2 id="faq-heading">How SLA enforcement works on the ground</h2>
          </div>

          <div className="faq-list">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="faq-item">
                <summary className="faq-summary">
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    strokeWidth={1.5}
                    className="faq-chevron"
                    aria-hidden="true"
                  />
                </summary>
                <div className="faq-body">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--compact" aria-labelledby="final-cta-heading">
        <div className="container">
          <div className="cta-banner">
            <div>
              <span
                className="mono"
                style={{ fontSize: '0.75rem', opacity: 0.78, display: 'block', marginBottom: '0.5rem' }}
              >
                ZERO ACCOUNT FRICTION · PUBLIC RECORD
              </span>
              <h2 id="final-cta-heading">
                Spot a burst pipe or open drain on your commute? Put it on the public clock.
              </h2>
              <p style={{ marginTop: '0.75rem' }}>
                Select your Mira-Bhayandar locality to look up your Ward Officer and start a
                30-second geo-verified ticket.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                backgroundColor: 'var(--bg)',
                color: 'var(--text)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <label htmlFor="quick-ward-lookup" className="field-label">
                QUICK WARD &amp; LOCALITY LOOKUP
              </label>
              <select
                id="quick-ward-lookup"
                className="select"
                value={quickLocality}
                onChange={(e) => setQuickLocality(e.target.value)}
              >
                {MIRA_BHAYANDAR_LOCALITIES.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    Ward {loc.wardNumber} — {loc.name} ({loc.prabhag})
                  </option>
                ))}
              </select>

              {selectedLoc && (
                <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  GPS {selectedLoc.lat.toFixed(4)}°N, {selectedLoc.lng.toFixed(4)}°E ·{' '}
                  {selectedLoc.landmark}
                </div>
              )}

              <button
                type="button"
                className="btn btn--primary"
                style={{ width: '100%' }}
                onClick={() => onOpenReport(quickLocality)}
              >
                <span>{t.hero.primaryCta}</span>
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
