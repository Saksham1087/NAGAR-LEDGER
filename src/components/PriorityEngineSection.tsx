import { useState } from 'react';
import type { TranslationBundle } from '../data/translations';
import type { IssueCategory } from '../types/civic';
import { calculateCivicPriorityScore } from '../utils/ledgerEngine';

interface PriorityEngineSectionProps {
  t: TranslationBundle;
}

export function PriorityEngineSection({ t }: PriorityEngineSectionProps) {
  const [category, setCategory] = useState<IssueCategory>('water');
  const [neighborConfirmations, setNeighborConfirmations] = useState<number>(4);
  const [nearCriticalZone, setNearCriticalZone] = useState<boolean>(true);
  const [hoursPastInspection, setHoursPastInspection] = useState<number>(8);

  const cps = calculateCivicPriorityScore({
    category,
    neighborConfirmations,
    nearCriticalZone,
    hoursPastInspection,
  });

  return (
    <section
      id="priority-engine"
      className="section section--surface"
      aria-labelledby="priority-heading"
    >
      <div className="container sticky-split">
        <div className="sticky-split__aside">
          <span className="section-index">02. CIVIC PRIORITY SCORE ENGINE</span>
          <h2 id="priority-heading">
            Dispatch queues ranked by civic risk, not political noise.
          </h2>
          <p className="section-lead" style={{ marginTop: '0.85rem' }}>
            Every complaint receives a public 0–100 Civic Priority Score (CPS). Ward
            crews are dispatched top-down from the highest score, and every term in
            the equation is inspectable by citizens.
          </p>

          <dl className="formula-list">
            <div className="formula-item">
              <dt style={{ fontWeight: 600 }}>1. Base Category Urgency</dt>
              <dd className="mono tabular" style={{ color: 'var(--text-muted)' }}>
                18–40 pts
              </dd>
            </div>
            <div className="formula-item">
              <dt style={{ fontWeight: 600 }}>2. 50m Neighbor Confirmations</dt>
              <dd className="mono tabular" style={{ color: 'var(--text-muted)' }}>
                +3 pts each (cap +25)
              </dd>
            </div>
            <div className="formula-item">
              <dt style={{ fontWeight: 600 }}>3. Critical Zone Proximity (&lt;200m)</dt>
              <dd className="mono tabular" style={{ color: 'var(--text-muted)' }}>
                1.25x multiplier
              </dd>
            </div>
            <div className="formula-item">
              <dt style={{ fontWeight: 600 }}>4. SLA Decay Boost</dt>
              <dd className="mono tabular" style={{ color: 'var(--text-muted)' }}>
                +1 pt per 4h overdue
              </dd>
            </div>
          </dl>
        </div>

        <div className="cps-simulator" aria-label="Interactive Civic Priority Score simulator">
          <div className="cps-readout">
            <div>
              <span className="field-label">COMPUTED CIVIC PRIORITY SCORE</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.35rem' }}>
                <span className="cps-readout__number tabular" data-testid="cps-sim-score">
                  {cps.totalScore}
                </span>
                <span className="mono" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                  / 100
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="field-label">DISPATCH QUEUE TIER</span>
              <div className="mono" style={{ fontWeight: 600, marginTop: '0.3rem' }}>
                {cps.dispatchTier}
              </div>
            </div>
          </div>

          <div className="cps-bar-track" aria-hidden="true">
            <div
              className="cps-bar-fill"
              style={{ width: `${cps.totalScore}%` }}
            />
          </div>

          <div
            className="mono tabular"
            style={{
              fontSize: '0.8rem',
              padding: '0.75rem',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            Formula: ({cps.baseUrgency} base + {cps.clusterBonus} cluster) ×{' '}
            {cps.criticalMultiplier.toFixed(2)} + {cps.decayBoost} decay ={' '}
            <strong>{cps.totalScore} pts</strong>
          </div>

          <div className="cps-controls-grid">
            <div className="field-group">
              <label htmlFor="sim-category" className="field-label">
                ISSUE CATEGORY (BASE URGENCY)
              </label>
              <select
                id="sim-category"
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value as IssueCategory)}
              >
                <option value="drainage">{t.categories.drainage} (40 pts)</option>
                <option value="water">{t.categories.water} (35 pts)</option>
                <option value="garbage">{t.categories.garbage} (25 pts)</option>
                <option value="road">{t.categories.road} (20 pts)</option>
                <option value="streetlight">{t.categories.streetlight} (18 pts)</option>
              </select>
            </div>

            <div className="field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="sim-confirmations" className="field-label">
                  NEIGHBOR +1 CONFIRMATIONS WITHIN 50M
                </label>
                <span className="mono tabular" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {neighborConfirmations} neighbors (+{cps.clusterBonus} pts)
                </span>
              </div>
              <input
                id="sim-confirmations"
                type="range"
                min={0}
                max={12}
                step={1}
                value={neighborConfirmations}
                onChange={(e) => setNeighborConfirmations(Number(e.target.value))}
                className="range-input"
              />
            </div>

            <div className="field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="sim-decay" className="field-label">
                  HOURS PAST INITIAL INSPECTION WINDOW
                </label>
                <span className="mono tabular" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {hoursPastInspection}h (+{cps.decayBoost} pts)
                </span>
              </div>
              <input
                id="sim-decay"
                type="range"
                min={0}
                max={48}
                step={4}
                value={hoursPastInspection}
                onChange={(e) => setHoursPastInspection(Number(e.target.value))}
                className="range-input"
              />
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={nearCriticalZone}
                onChange={(e) => setNearCriticalZone(e.target.checked)}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  Within 200m of School, Hospital, Station, or Flood Nullah (1.25x)
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  e.g. Mira Road Station, Bhayandar Market, or St. Xavier School zone
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
