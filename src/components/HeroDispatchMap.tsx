import { useCallback, useEffect, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  ColorScheme,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { ArrowRight, MapPin } from 'lucide-react';
import type { TranslationBundle } from '../data/translations';
import type { CivicTicket, ThemeMode } from '../types/civic';
import {
  computeLedgerTelemetry,
  evaluateTicketSla,
  getTicketCps,
} from '../utils/ledgerEngine';
import { StatusStamp } from './StatusStamp';

interface HeroDispatchMapProps {
  t: TranslationBundle;
  tickets: CivicTicket[];
  nowMs: number;
  theme: ThemeMode;
  mapsEnabled: boolean;
  onOpenReport: () => void;
  onJumpToLedger: () => void;
  onInspectTicket: (ticketId: string) => void;
}

const MIRA_BHAYANDAR_CENTER = { lat: 19.2915, lng: 72.8565 };

type AdvancedMarkerRefInstance = ReturnType<typeof useAdvancedMarkerRef>[1];

interface TicketAdvancedMarkerProps {
  ticket: CivicTicket;
  cpsScore: number;
  statusColor: string;
  isSelected: boolean;
  onSelect: (ticketId: string, marker: AdvancedMarkerRefInstance) => void;
}

function TicketAdvancedMarker({
  ticket,
  cpsScore,
  statusColor,
  isSelected,
  onSelect,
}: TicketAdvancedMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: ticket.lat, lng: ticket.lng }}
      zIndex={isSelected ? 1000 : cpsScore}
      title={`${ticket.id} · Ward ${ticket.wardNumber} (${ticket.localityName}) · CPS ${cpsScore}`}
      onClick={() => onSelect(ticket.id, marker)}
    >
      <Pin
        background={statusColor}
        borderColor={isSelected ? '#111315' : '#FFFFFF'}
        glyphColor="#FFFFFF"
        glyphText={`W${ticket.wardNumber}`}
        scale={isSelected ? 1.25 : 1}
      />
    </AdvancedMarker>
  );
}

function MapCameraSync({
  activeTicket,
}: {
  activeTicket: CivicTicket | undefined;
}) {
  const map = useMap('hero-dispatch-map');

  useEffect(() => {
    if (!map || !activeTicket) return;
    map.panTo({ lat: activeTicket.lat, lng: activeTicket.lng });
  }, [map, activeTicket?.id, activeTicket?.lat, activeTicket?.lng]);

  return null;
}

function GoogleDispatchCanvas({
  t,
  tickets,
  nowMs,
  theme,
  activeTicket,
  onSelectTicket,
  onInspectTicket,
  onMapUnavailable,
}: {
  t: TranslationBundle;
  tickets: CivicTicket[];
  nowMs: number;
  theme: ThemeMode;
  activeTicket: CivicTicket | undefined;
  onSelectTicket: (ticketId: string) => void;
  onInspectTicket: (ticketId: string) => void;
  onMapUnavailable: () => void;
}) {
  const apiStatus = useApiLoadingStatus();
  const [infoAnchor, setInfoAnchor] = useState<AdvancedMarkerRefInstance>(null);
  const [infoTicketId, setInfoTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (
      apiStatus === APILoadingStatus.FAILED ||
      apiStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      onMapUnavailable();
    }
  }, [apiStatus, onMapUnavailable]);

  const handleMarkerClick = useCallback(
    (ticketId: string, marker: AdvancedMarkerRefInstance) => {
      onSelectTicket(ticketId);
      setInfoTicketId(ticketId);
      setInfoAnchor(marker);
    },
    [onSelectTicket]
  );

  const infoTicket = infoTicketId
    ? tickets.find((item) => item.id === infoTicketId) ?? null
    : null;
  const infoSla = infoTicket ? evaluateTicketSla(infoTicket, nowMs) : null;
  const infoCps = infoTicket ? getTicketCps(infoTicket, nowMs) : null;

  return (
    <div className="dispatch-map-wrap dispatch-map-wrap--gmaps">
      <div className="dispatch-google-map-shell">
        <GoogleMap
          id="hero-dispatch-map"
          mapId="DEMO_MAP_ID"
          defaultCenter={MIRA_BHAYANDAR_CENTER}
          defaultZoom={12.6}
          colorScheme={theme === 'dark' ? ColorScheme.DARK : ColorScheme.LIGHT}
          gestureHandling="cooperative"
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCameraSync activeTicket={activeTicket} />

          {tickets.slice(0, 12).map((ticket) => {
            const sla = evaluateTicketSla(ticket, nowMs);
            const cps = getTicketCps(ticket, nowMs);
            const isSelected = activeTicket?.id === ticket.id;
            const pinColor =
              sla.effectiveStatus === 'escalated'
                ? '#B42318'
                : sla.effectiveStatus === 'verified'
                  ? '#146B3A'
                  : sla.effectiveStatus === 'awaiting_audit'
                    ? '#8C4E00'
                    : '#C8321A';

            return (
              <TicketAdvancedMarker
                key={ticket.id}
                ticket={ticket}
                cpsScore={cps.totalScore}
                statusColor={pinColor}
                isSelected={isSelected}
                onSelect={handleMarkerClick}
              />
            );
          })}

          {infoTicket && infoAnchor && infoSla && infoCps && (
            <InfoWindow
              anchor={infoAnchor}
              headerContent={
                <span className="gmp-info-card__id">
                  {infoTicket.id} · WARD {infoTicket.wardNumber}
                </span>
              }
              onCloseClick={() => {
                setInfoAnchor(null);
                setInfoTicketId(null);
              }}
            >
              <div className="gmp-info-card">
                <div className="gmp-info-card__title">{infoTicket.title}</div>
                <div className="gmp-info-card__meta">
                  {t.statuses[infoSla.effectiveStatus]} · CPS {infoCps.totalScore}/100 ·{' '}
                  {infoSla.formattedCountdown}
                </div>
                <button
                  type="button"
                  className="gmp-info-card__btn"
                  onClick={() => onInspectTicket(infoTicket.id)}
                >
                  Inspect Ticket
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
      <div className="dispatch-map-status-note">
        <span>
          {apiStatus === APILoadingStatus.LOADED
            ? 'LIVE GOOGLE MAPS · MIRA-BHAYANDAR WARDS 1–24'
            : 'LOADING MIRA-BHAYANDAR MAP LAYERS...'}
        </span>
        {activeTicket && (
          <span className="tabular">
            {activeTicket.lat.toFixed(4)}°N, {activeTicket.lng.toFixed(4)}°E
          </span>
        )}
      </div>
    </div>
  );
}

export function HeroDispatchMap({
  t,
  tickets,
  nowMs,
  theme,
  mapsEnabled,
  onOpenReport,
  onJumpToLedger,
  onInspectTicket,
}: HeroDispatchMapProps) {
  const prioritized = [...tickets]
    .sort((a, b) => getTicketCps(b, nowMs).totalScore - getTicketCps(a, nowMs).totalScore)
    .slice(0, 4);

  const [selectedId, setSelectedId] = useState<string>(prioritized[0]?.id ?? '');
  const [mapMode, setMapMode] = useState<'google' | 'vector'>(
    mapsEnabled ? 'google' : 'vector'
  );
  const [mapsUnavailable, setMapsUnavailable] = useState<boolean>(false);

  useEffect(() => {
    if (!mapsEnabled) {
      setMapMode('vector');
    }
  }, [mapsEnabled]);

  const handleMapUnavailable = useCallback(() => {
    setMapsUnavailable(true);
    setMapMode('vector');
  }, []);

  const showGoogleMap = mapsEnabled && !mapsUnavailable && mapMode === 'google';

  const activeTicket =
    tickets.find((item) => item.id === selectedId) ?? prioritized[0] ?? tickets[0];
  const telemetry = computeLedgerTelemetry(tickets, nowMs);

  const tickerEntries = tickets.slice(0, 6).map((ticket) => {
    const sla = evaluateTicketSla(ticket, nowMs);
    const cps = getTicketCps(ticket, nowMs);
    return `${ticket.id} · WARD ${String(ticket.wardNumber).padStart(2, '0')} ${ticket.localityName.toUpperCase()} · CPS ${cps.totalScore} · ${sla.formattedCountdown}`;
  });

  return (
    <>
      <section className="hero-section" aria-labelledby="hero-heading">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div>
              <span className="hero-kicker">{t.hero.kicker}</span>
              <h1 id="hero-heading" className="hero-title">
                {t.hero.headline}
              </h1>
              <p className="hero-lead">{t.hero.lead}</p>

              <div className="hero-cta-row">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={onOpenReport}
                >
                  <span>{t.hero.primaryCta}</span>
                  <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={onJumpToLedger}
                >
                  {t.hero.secondaryCta}
                </button>
              </div>
            </div>

            <div className="hero-facts" aria-label="Core accountability rules">
              <div>
                <span className="hero-fact__label">GEO-CLUSTERING</span>
                <span className="hero-fact__value tabular">50m Radius</span>
              </div>
              <div>
                <span className="hero-fact__label">STATUTORY SLA</span>
                <span className="hero-fact__value tabular">12h / 24h / 72h</span>
              </div>
              <div>
                <span className="hero-fact__label">CLOSURE AUDIT</span>
                <span className="hero-fact__value tabular">48h Citizen Audit</span>
              </div>
            </div>
          </div>

          <aside className="dispatch-panel" aria-label="Live Mira-Bhayandar ward dispatch map">
            <div className="dispatch-panel__head">
              <span className="dispatch-panel__title">
                MIRA-BHAYANDAR DISPATCH · WARDS 1–24
              </span>
              <div className="dispatch-panel__actions">
                {mapsEnabled && !mapsUnavailable && (
                  <div className="segmented-control" role="group" aria-label="Map layer view">
                    <button
                      type="button"
                      className="segmented-control__btn"
                      aria-pressed={mapMode === 'google'}
                      onClick={() => setMapMode('google')}
                    >
                      Google Map
                    </button>
                    <button
                      type="button"
                      className="segmented-control__btn"
                      aria-pressed={mapMode === 'vector'}
                      onClick={() => setMapMode('vector')}
                    >
                      Vector
                    </button>
                  </div>
                )}

                {activeTicket && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => onInspectTicket(activeTicket.id)}
                  >
                    <span>Inspect {activeTicket.id.slice(-4)}</span>
                    <ArrowRight size={13} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {showGoogleMap ? (
              <GoogleDispatchCanvas
                t={t}
                tickets={tickets}
                nowMs={nowMs}
                theme={theme}
                activeTicket={activeTicket}
                onSelectTicket={setSelectedId}
                onInspectTicket={onInspectTicket}
                onMapUnavailable={handleMapUnavailable}
              />
            ) : (
              <div className="dispatch-map-wrap">
                <svg
                  className="dispatch-map-svg"
                  viewBox="0 0 600 375"
                  width="600"
                  height="375"
                  role="img"
                  aria-label="Vector map of Mira-Bhayandar showing Vasai Creek, Western Railway line, Western Express Highway, and active civic ticket pins"
                >
                  <defs>
                    <pattern
                      id="ledgerGrid"
                      width="30"
                      height="30"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 30 0 L 0 0 0 30"
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="0.7"
                      />
                    </pattern>
                  </defs>
                  <rect width="600" height="375" fill="url(#ledgerGrid)" />

                  <path
                    d="M 0 0 L 600 0 L 600 62 C 510 52, 445 78, 365 86 C 280 94, 210 64, 145 104 C 82 142, 48 212, 32 375 L 0 375 Z"
                    fill="var(--surface)"
                    stroke="var(--border-strong)"
                    strokeWidth="1.2"
                  />
                  <text
                    x="110"
                    y="44"
                    fill="var(--text-muted)"
                    fontFamily="var(--font-mono)"
                    fontSize="10"
                    letterSpacing="1.5"
                  >
                    VASAI / MIRA CREEK
                  </text>

                  <text
                    x="52"
                    y="175"
                    fill="var(--text-muted)"
                    fontFamily="var(--font-mono)"
                    fontSize="9.5"
                  >
                    UTTAN · W1
                  </text>

                  <path
                    d="M 244 76 L 266 154 L 306 274 L 328 368"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  />
                  <rect x="249" y="138" width="14" height="14" fill="var(--bg-elevated)" stroke="var(--text)" strokeWidth="1.2" />
                  <text
                    x="184"
                    y="130"
                    fill="var(--text-muted)"
                    fontFamily="var(--font-mono)"
                    fontSize="9"
                  >
                    BHAYANDAR STN
                  </text>

                  <rect x="299" y="267" width="14" height="14" fill="var(--bg-elevated)" stroke="var(--text)" strokeWidth="1.2" />
                  <text
                    x="212"
                    y="286"
                    fill="var(--text-muted)"
                    fontFamily="var(--font-mono)"
                    fontSize="9"
                  >
                    MIRA RD STN
                  </text>

                  <path
                    d="M 432 72 C 452 148, 468 232, 496 368"
                    fill="none"
                    stroke="var(--border-strong)"
                    strokeWidth="3.5"
                  />
                  <text
                    x="484"
                    y="206"
                    fill="var(--text-muted)"
                    fontFamily="var(--font-mono)"
                    fontSize="9"
                  >
                    NH-48 WEH
                  </text>

                  <text x="356" y="108" fill="var(--text-muted)" fontFamily="var(--font-mono)" fontSize="9">
                    BHAYANDAR (E)
                  </text>
                  <text x="380" y="206" fill="var(--text-muted)" fontFamily="var(--font-mono)" fontSize="9">
                    MIRA ROAD (E)
                  </text>
                  <text x="498" y="336" fill="var(--text-muted)" fontFamily="var(--font-mono)" fontSize="9">
                    KASHIMIRA
                  </text>

                  {tickets.slice(0, 8).map((ticket) => {
                    const sla = evaluateTicketSla(ticket, nowMs);
                    const cps = getTicketCps(ticket, nowMs);
                    const isSelected = activeTicket?.id === ticket.id;
                    const pinColor =
                      sla.effectiveStatus === 'escalated'
                        ? 'var(--danger)'
                        : sla.effectiveStatus === 'verified'
                          ? 'var(--success)'
                          : 'var(--accent)';

                    return (
                      <g
                        key={ticket.id}
                        transform={`translate(${ticket.mapX}, ${ticket.mapY})`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedId(ticket.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${ticket.id}, Ward ${ticket.wardNumber} ${ticket.localityName}, Priority Score ${cps.totalScore}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId(ticket.id);
                          }
                        }}
                      >
                        {isSelected && (
                          <circle
                            r="16"
                            fill="none"
                            stroke={pinColor}
                            strokeWidth="1.5"
                            strokeDasharray="3 2"
                          />
                        )}
                        <circle
                          r={isSelected ? 8 : 6}
                          fill={pinColor}
                          stroke="var(--bg-elevated)"
                          strokeWidth="1.8"
                        />
                        <text
                          x="10"
                          y="4"
                          fill="var(--text)"
                          fontFamily="var(--font-mono)"
                          fontSize="10"
                          fontWeight={isSelected ? '600' : '500'}
                        >
                          W{ticket.wardNumber}·{cps.totalScore}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            <div className="dispatch-feed" aria-label="Highest priority active tickets">
              {prioritized.map((ticket) => {
                const sla = evaluateTicketSla(ticket, nowMs);
                const cps = getTicketCps(ticket, nowMs);
                const isSelected = activeTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`dispatch-feed__item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedId(ticket.id);
                      onInspectTicket(ticket.id);
                    }}
                  >
                    <div className="dispatch-feed__left">
                      <div className="mono dispatch-feed__meta">
                        <span>{ticket.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <MapPin
                            size={11}
                            strokeWidth={1.5}
                            style={{ display: 'inline', verticalAlign: '-1px', marginRight: '2px' }}
                            aria-hidden="true"
                          />
                          Ward {ticket.wardNumber} · {ticket.localityName}
                        </span>
                      </div>
                      <div className="dispatch-feed__title">{ticket.title}</div>
                    </div>

                    <div className="dispatch-feed__right">
                      <StatusStamp
                        status={sla.effectiveStatus}
                        label={t.statuses[sla.effectiveStatus]}
                      />
                      <span
                        className="mono tabular"
                        style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}
                      >
                        CPS {cps.totalScore} · {sla.formattedCountdown}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </section>

      <section className="telemetry-strip" aria-label="Real-time ledger operational metrics">
        <div className="container telemetry-grid">
          <div className="telemetry-cell">
            <span className="telemetry-cell__label">ACTIVE OPEN TICKETS</span>
            <span className="telemetry-cell__value tabular" data-testid="telemetry-open">
              {telemetry.activeOpen}
            </span>
            <span className="telemetry-cell__sub">Across Wards 1–24</span>
          </div>
          <div className="telemetry-cell">
            <span className="telemetry-cell__label">RESOLVED / IN 48H AUDIT</span>
            <span className="telemetry-cell__value tabular" data-testid="telemetry-resolved">
              {telemetry.resolvedFast}
            </span>
            <span className="telemetry-cell__sub">With geo-matched after-photos</span>
          </div>
          <div className="telemetry-cell">
            <span className="telemetry-cell__label">SLA BREACHES AT DMC DESK</span>
            <span
              className="telemetry-cell__value tabular"
              style={{ color: telemetry.escalatedToDmc > 0 ? 'var(--danger)' : 'var(--text)' }}
              data-testid="telemetry-escalated"
            >
              {telemetry.escalatedToDmc}
            </span>
            <span className="telemetry-cell__sub">Auto-escalated past deadline</span>
          </div>
          <div className="telemetry-cell">
            <span className="telemetry-cell__label">50M DUPLICATES MERGED</span>
            <span className="telemetry-cell__value tabular" data-testid="telemetry-merged">
              {telemetry.mergedDuplicates}
            </span>
            <span className="telemetry-cell__sub">Consolidated via +1 Confirm</span>
          </div>
        </div>
      </section>

      <div className="ledger-ticker" role="region" aria-label="Recent Mira-Bhayandar ward dispatch stream">
        <div className="ledger-ticker__track">
          {[...tickerEntries, ...tickerEntries].map((entry, index) => (
            <span key={index} className="tabular">
              {entry}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
