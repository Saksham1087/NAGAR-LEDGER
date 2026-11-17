import { BASE_WARD_SCORECARDS } from '../data/miraBhayandarData';
import type { CivicTicket, PrabhagZone } from '../types/civic';
import { computeWardScorecards } from '../utils/ledgerEngine';

interface WardScorecardSectionProps {
  tickets: CivicTicket[];
  nowMs: number;
  onFilterWard?: (prabhag: PrabhagZone) => void;
}

export function WardScorecardSection({
  tickets,
  nowMs,
  onFilterWard,
}: WardScorecardSectionProps) {
  const rows = computeWardScorecards(tickets, BASE_WARD_SCORECARDS, nowMs);

  return (
    <section
      id="ward-scorecard"
      className="section section--surface"
      aria-labelledby="ward-scorecard-heading"
    >
      <div className="container">
        <div className="section-header">
          <span className="section-index">04. WARD ACCOUNTABILITY SCORECARD</span>
          <h2 id="ward-scorecard-heading">
            Public SLA compliance across Mira-Bhayandar Prabhag Samitis
          </h2>
          <p className="section-lead">
            Mean Time to Resolve (MTTR), on-time SLA compliance, and active DMC
            escalations updated live from the public ticket ledger.
          </p>
        </div>

        {/* Desktop Comparison Table */}
        <div className="ward-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th scope="col">PRABHAG / WARDS</th>
                <th scope="col">RESPONSIBLE OFFICER</th>
                <th scope="col">MTTR (HOURS)</th>
                <th scope="col">SLA COMPLIANCE</th>
                <th scope="col">OPEN CRITICAL</th>
                <th scope="col">ESCALATED TO DMC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const barClass =
                  row.slaCompliancePct >= 80
                    ? 'ward-bar-fill'
                    : row.slaCompliancePct >= 70
                      ? 'ward-bar-fill ward-bar-fill--warn'
                      : 'ward-bar-fill ward-bar-fill--danger';

                return (
                  <tr key={row.prabhag}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {onFilterWard ? (
                          <button
                            type="button"
                            className="ledger-row-title-btn"
                            onClick={() => onFilterWard(row.prabhag)}
                          >
                            {row.wardLabel}
                          </button>
                        ) : (
                          row.wardLabel
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {row.wardRange} · {row.totalTracked} tracked tickets
                      </div>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{row.juniorEngineer}</td>
                    <td className="mono tabular" style={{ fontWeight: 600 }}>
                      {row.mttrHours.toFixed(1)}h
                    </td>
                    <td className="mono tabular">
                      <span className="ward-bar-track" aria-hidden="true">
                        <span
                          className={barClass}
                          style={{ display: 'block', width: `${row.slaCompliancePct}%` }}
                        />
                      </span>
                      <strong>{row.slaCompliancePct}%</strong>
                    </td>
                    <td className="mono tabular">{row.openCriticalCount}</td>
                    <td
                      className="mono tabular"
                      style={{
                        color: row.escalatedCount > 0 ? 'var(--danger)' : 'var(--text-muted)',
                        fontWeight: row.escalatedCount > 0 ? 600 : 400,
                      }}
                    >
                      {row.escalatedCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Ward Cards */}
        <div className="ward-mobile-cards">
          {rows.map((row) => (
            <article key={row.prabhag} className="ledger-card">
              <div style={{ fontWeight: 700 }}>{row.wardLabel}</div>
              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {row.wardRange} · {row.juniorEngineer}
              </div>
              <div
                className="mono tabular"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                    SLA COMPLIANCE
                  </span>
                  <strong>{row.slaCompliancePct}%</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                    MTTR
                  </span>
                  <strong>{row.mttrHours.toFixed(1)} hrs</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                    OPEN CRITICAL
                  </span>
                  <strong>{row.openCriticalCount}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>
                    ESCALATED DMC
                  </span>
                  <strong style={{ color: row.escalatedCount > 0 ? 'var(--danger)' : 'inherit' }}>
                    {row.escalatedCount}
                  </strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
