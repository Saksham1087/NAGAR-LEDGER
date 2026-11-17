import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { CitizenAuditCase } from '../types/civic';

interface CitizenAuditSectionProps {
  auditCases: CitizenAuditCase[];
  auditVotes: Record<string, 'verify' | 'reopen'>;
  onVoteAudit: (ticketId: string, vote: 'verify' | 'reopen') => void;
}

function SchematicArtwork({
  mode,
  type,
}: {
  mode: 'before' | 'after';
  type: CitizenAuditCase['schematicType'];
}) {
  const isBefore = mode === 'before';

  return (
    <svg
      viewBox="0 0 800 500"
      width="800"
      height="500"
      style={{ width: '100%', height: '100%', display: 'block' }}
      role="img"
      aria-label={`${isBefore ? 'Before repair' : 'After repair'} architectural site inspection schematic`}
    >
      <defs>
        <pattern id={`grid-${mode}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke={isBefore ? 'rgba(180,35,24,0.14)' : 'rgba(20,107,58,0.14)'}
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect width="800" height="500" fill={isBefore ? '#231D1C' : '#18221D'} />
      <rect width="800" height="500" fill={`url(#grid-${mode})`} />

      {/* Street Curb & Footpath Elevation */}
      <rect x="0" y="340" width="800" height="160" fill={isBefore ? '#332C2A' : '#24302A'} />
      <line
        x1="0"
        y1="340"
        x2="800"
        y2="340"
        stroke={isBefore ? '#E5A199' : '#8CE2B0'}
        strokeWidth="2"
      />
      <line
        x1="0"
        y1="210"
        x2="800"
        y2="210"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
        strokeDasharray="16 12"
      />

      {type === 'pothole' &&
        (isBefore ? (
          <g>
            {/* Dislodged paver blocks and deep depression */}
            <path
              d="M 220 275 Q 320 238, 460 258 Q 575 275, 550 315 Q 410 342, 245 316 Z"
              fill="#110E0E"
              stroke="#FF6347"
              strokeWidth="2.5"
            />
            <polygon points="275,275 315,264 330,285 285,295" fill="#4E423F" stroke="#FF947E" strokeWidth="1" />
            <polygon points="415,278 465,269 472,292 422,296" fill="#4E423F" stroke="#FF947E" strokeWidth="1" />
            <text x="236" y="232" fill="#FF947E" fontFamily="monospace" fontSize="15">
              HAZARD: SUNKEN PAVER CAVITY (DEPTH 18cm)
            </text>
          </g>
        ) : (
          <g>
            {/* Re-bedded M40 pavers & compacted level line */}
            <rect
              x="210"
              y="246"
              width="380"
              height="74"
              fill="#2B3D33"
              stroke="#34D399"
              strokeWidth="2"
            />
            <path
              d="M 210 270 H 590 M 210 295 H 590 M 285 246 V 320 M 360 246 V 320 M 435 246 V 320 M 510 246 V 320"
              stroke="#34D399"
              strokeWidth="1.2"
              strokeOpacity="0.6"
            />
            <text x="236" y="232" fill="#34D399" fontFamily="monospace" fontSize="15">
              REPAIRED: M40 PAVER RE-BEDDED · LEVEL ±2mm
            </text>
          </g>
        ))}

      {type === 'water' &&
        (isBefore ? (
          <g>
            <rect x="140" y="248" width="520" height="44" fill="#3A2D2B" stroke="#FF947E" strokeWidth="1.5" />
            <circle cx="400" cy="270" r="34" fill="#1A1515" stroke="#FF6347" strokeWidth="2.5" />
            <path
              d="M 400 236 C 378 190, 345 170, 325 148 M 400 236 C 425 186, 455 162, 475 138 M 400 236 V 126"
              stroke="#7CC4FA"
              strokeWidth="3"
              strokeDasharray="6 4"
              fill="none"
            />
            <text x="225" y="112" fill="#FF947E" fontFamily="monospace" fontSize="15">
              PRESSURIZED LEAK: 42 L/MIN LOSS AT VALVE GLAND
            </text>
          </g>
        ) : (
          <g>
            <rect x="140" y="248" width="520" height="44" fill="#27362E" stroke="#34D399" strokeWidth="1.5" />
            <circle cx="400" cy="270" r="34" fill="#1C2922" stroke="#34D399" strokeWidth="2.5" />
            <rect x="372" y="256" width="56" height="28" fill="#34D399" fillOpacity="0.25" stroke="#34D399" strokeWidth="1.5" />
            <text x="232" y="190" fill="#34D399" fontFamily="monospace" fontSize="15">
              SEALED: FLANGE PACKED · 0.0 L/MIN SEEPAGE
            </text>
          </g>
        ))}

      {type === 'garbage' &&
        (isBefore ? (
          <g>
            <rect x="250" y="205" width="220" height="125" fill="#46322E" stroke="#FF6347" strokeWidth="2" />
            <path
              d="M 225 330 Q 260 272, 315 292 Q 360 250, 420 282 Q 495 256, 540 330 Z"
              fill="#634038"
              stroke="#FF947E"
              strokeWidth="1.5"
            />
            <text x="230" y="182" fill="#FF947E" fontFamily="monospace" fontSize="15">
              COMPACTOR OVERFLOW · FOOTPATH OBSTRUCTED
            </text>
          </g>
        ) : (
          <g>
            <rect x="250" y="205" width="220" height="125" fill="#24352C" stroke="#34D399" strokeWidth="2" />
            <line x1="250" y1="245" x2="470" y2="245" stroke="#34D399" strokeWidth="1.5" />
            <text x="225" y="182" fill="#34D399" fontFamily="monospace" fontSize="15">
              CLEARED &amp; WASHED DOWN · FOOTPATH OPEN
            </text>
          </g>
        ))}

      {/* Stamp overlay */}
      <rect
        x="24"
        y="24"
        width={isBefore ? 176 : 194}
        height="34"
        fill={isBefore ? '#B42318' : '#146B3A'}
      />
      <text x="38" y="46" fill="#FFFFFF" fontFamily="monospace" fontSize="14" fontWeight="600">
        {isBefore ? 'BEFORE · FIELD LOG' : 'AFTER · GEO-MATCHED'}
      </text>
    </svg>
  );
}

export function CitizenAuditSection({
  auditCases,
  auditVotes,
  onVoteAudit,
}: CitizenAuditSectionProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    auditCases[0]?.ticketId ?? ''
  );
  const [splitPercent, setSplitPercent] = useState<number>(52);

  const activeCase =
    auditCases.find((c) => c.ticketId === selectedTicketId) ?? auditCases[0];
  const userVote = activeCase ? auditVotes[activeCase.ticketId] : undefined;

  if (!activeCase) return null;

  return (
    <section
      id="citizen-audit"
      className="section"
      aria-labelledby="audit-heading"
    >
      <div className="container">
        <div className="section-header">
          <span className="section-index">03. CITIZEN PROOF-OF-FIX AUDIT</span>
          <h2 id="audit-heading">
            Officials cannot close a ticket without geo-matched proof and 48-hour citizen sign-off.
          </h2>
          <p className="section-lead">
            Slide or use keyboard controls to inspect the field engineer’s post-repair
            submission against the original complaint coordinates.
          </p>
        </div>

        <div className="audit-grid">
          <div className="audit-viewer">
            <div className="audit-viewer__header">
              <span>
                {activeCase.ticketId} · WARD {activeCase.wardNumber} · {activeCase.locality}
              </span>
              <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                GEO-MATCH Δ {activeCase.geoMatchMeters}m
              </span>
            </div>

            <div className="compare-stage">
              <div className="compare-layer">
                <SchematicArtwork mode="after" type={activeCase.schematicType} />
              </div>

              <div
                className="compare-layer"
                style={{
                  clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                }}
              >
                <SchematicArtwork mode="before" type={activeCase.schematicType} />
              </div>

              <div
                className="compare-divider"
                style={{ left: `${splitPercent}%` }}
                aria-hidden="true"
              />
              <div
                className="compare-handle"
                style={{ left: `${splitPercent}%` }}
                aria-hidden="true"
              >
                <ChevronLeft size={14} strokeWidth={2} />
                <ChevronRight size={14} strokeWidth={2} />
              </div>
            </div>

            <div className="compare-controls">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '220px' }}>
                <label htmlFor="audit-split-range" className="field-label" style={{ whiteSpace: 'nowrap' }}>
                  BEFORE / AFTER SPLIT ({splitPercent}%)
                </label>
                <input
                  id="audit-split-range"
                  type="range"
                  min={5}
                  max={95}
                  value={splitPercent}
                  onChange={(e) => setSplitPercent(Number(e.target.value))}
                  className="range-input"
                  aria-label="Adjust Before and After inspection split view"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSplitPercent((p) => Math.max(5, p - 15))}
                  aria-label="Reveal more of After repair photo"
                >
                  <ChevronLeft size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>After</span>
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSplitPercent((p) => Math.min(95, p + 15))}
                  aria-label="Reveal more of Before complaint photo"
                >
                  <span>Before</span>
                  <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '0.75rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
              className="mono"
            >
              <span>BEFORE: {activeCase.beforeTimestamp}</span>
              <span>AFTER: {activeCase.afterTimestamp}</span>
            </div>
          </div>

          <div className="audit-cases-list" aria-label="Resolved tickets open for citizen verification">
            {auditCases.map((item) => {
              const isSelected = item.ticketId === activeCase.ticketId;
              const vote = auditVotes[item.ticketId];
              return (
                <article
                  key={item.ticketId}
                  className={`audit-case-card ${isSelected ? 'is-active' : ''}`}
                >
                  <div
                    className="mono"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>
                      {item.ticketId} · Ward {item.wardNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTicketId(item.ticketId)}
                      style={{
                        background: 'none',
                        border: 0,
                        padding: 0,
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                        fontWeight: 600,
                        textDecoration: 'underline',
                      }}
                    >
                      {isSelected ? 'Viewing Split' : 'Load in Viewer'}
                    </button>
                  </div>

                  <h3 style={{ fontSize: '1.05rem' }}>{item.title}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {item.resolvedBy}
                  </p>

                  <div className="audit-vote-row">
                    <button
                      type="button"
                      className={`btn btn--sm ${vote === 'verify' ? 'btn--primary' : 'btn--secondary'}`}
                      aria-pressed={vote === 'verify'}
                      onClick={() => {
                        setSelectedTicketId(item.ticketId);
                        onVoteAudit(item.ticketId, 'verify');
                      }}
                    >
                      <Check size={14} strokeWidth={1.5} aria-hidden="true" />
                      <span>Verify Fix ({item.verifyVotes})</span>
                    </button>

                    <button
                      type="button"
                      className={`btn btn--sm ${vote === 'reopen' ? 'btn--primary' : 'btn--ghost'}`}
                      aria-pressed={vote === 'reopen'}
                      onClick={() => {
                        setSelectedTicketId(item.ticketId);
                        onVoteAudit(item.ticketId, 'reopen');
                      }}
                    >
                      <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" />
                      <span>Re-open ({item.reopenVotes})</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
