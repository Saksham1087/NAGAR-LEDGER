import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  ColorScheme,
  Map as GoogleMap,
  Pin,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  Copy,
  Crosshair,
  Loader2,
  MapPin,
  Mic,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react';
import { MIRA_BHAYANDAR_LOCALITIES } from '../data/miraBhayandarData';
import type { TranslationBundle } from '../data/translations';
import type { NewTicketInput } from '../hooks/useLedgerStore';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import type { CivicTicket, IssueCategory, LanguageCode, ThemeMode } from '../types/civic';
import { findNearbyDuplicates, getTicketCps } from '../utils/ledgerEngine';

interface ReportDrawerProps {
  open: boolean;
  t: TranslationBundle;
  language: LanguageCode;
  tickets: CivicTicket[];
  confirmedTicketIds: string[];
  nowMs: number;
  theme: ThemeMode;
  mapsEnabled: boolean;
  initialLocalityId?: string;
  onClose: () => void;
  onConfirmDuplicate: (ticketId: string) => void;
  onCreateTicket: (input: NewTicketInput) => CivicTicket;
  onInspectTicket: (ticketId: string) => void;
}

function ReportPickerPanSync({ coords }: { coords: { lat: number; lng: number } }) {
  const map = useMap('report-pin-picker-map');
  useEffect(() => {
    if (!map) return;
    map.panTo(coords);
  }, [map, coords.lat, coords.lng]);
  return null;
}

function ReportPinMapPicker({
  coords,
  theme,
  onPickCoords,
}: {
  coords: { lat: number; lng: number };
  theme: ThemeMode;
  onPickCoords: (next: { lat: number; lng: number }) => void;
}) {
  const apiStatus = useApiLoadingStatus();
  if (
    apiStatus === APILoadingStatus.FAILED ||
    apiStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return null;
  }

  return (
    <div className="report-map-picker" aria-label="Interactive incident pin map">
      <GoogleMap
        id="report-pin-picker-map"
        mapId="DEMO_MAP_ID"
        defaultCenter={coords}
        defaultZoom={15}
        colorScheme={theme === 'dark' ? ColorScheme.DARK : ColorScheme.LIGHT}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
        onClick={(ev) => {
          if (ev.detail.latLng) {
            onPickCoords({
              lat: Number(ev.detail.latLng.lat.toFixed(5)),
              lng: Number(ev.detail.latLng.lng.toFixed(5)),
            });
          }
        }}
      >
        <ReportPickerPanSync coords={coords} />
        <AdvancedMarker position={coords} title="Incident location pin">
          <Pin background="#C8321A" borderColor="#111315" glyphColor="#FFFFFF" />
        </AdvancedMarker>
      </GoogleMap>
    </div>
  );
}

const CATEGORIES: IssueCategory[] = [
  'water',
  'drainage',
  'garbage',
  'road',
  'streetlight',
];

export function ReportDrawer({
  open,
  t,
  language,
  tickets,
  confirmedTicketIds,
  nowMs,
  theme,
  mapsEnabled,
  initialLocalityId,
  onClose,
  onConfirmDuplicate,
  onCreateTicket,
  onInspectTicket,
}: ReportDrawerProps) {
  const defaultLoc =
    MIRA_BHAYANDAR_LOCALITIES.find((l) => l.id === initialLocalityId) ??
    MIRA_BHAYANDAR_LOCALITIES[0];

  const [localityId, setLocalityId] = useState<string>(defaultLoc.id);
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLoc.lat,
    lng: defaultLoc.lng,
  });
  const [category, setCategory] = useState<IssueCategory>('road');
  const [title, setTitle] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>('');
  const [gpsLocked, setGpsLocked] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createdTicket, setCreatedTicket] = useState<CivicTicket | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const [touched, setTouched] = useState<{ title?: boolean; description?: boolean; phone?: boolean }>({});
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleVoiceReport = useCallback((transcript: string) => {
    setDescription((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    setTitle((prevTitle) => {
      if (prevTitle.trim().length > 0) return prevTitle;
      const firstSentence = transcript.split(/[.!?।\n]/)[0]?.trim() || transcript;
      const words = firstSentence.split(/\s+/).slice(0, 10).join(' ');
      return words.slice(0, 90);
    });
  }, []);

  const voice = useVoiceRecorder({
    language,
    purpose: 'report',
    onTranscript: handleVoiceReport,
  });

  useEffect(() => {
    if (initialLocalityId) {
      setLocalityId(initialLocalityId);
      const match = MIRA_BHAYANDAR_LOCALITIES.find((l) => l.id === initialLocalityId);
      if (match) {
        setPinnedCoords({ lat: match.lat, lng: match.lng });
      }
    }
  }, [initialLocalityId]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const selectedLocality =
    MIRA_BHAYANDAR_LOCALITIES.find((l) => l.id === localityId) ??
    MIRA_BHAYANDAR_LOCALITIES[0];

  const nearbyMatches = findNearbyDuplicates(tickets, localityId, category, nowMs);

  const titleError =
    (touched.title || submitAttempted) && title.trim().length < 8
      ? 'Enter a concise issue summary (at least 8 characters, e.g. "Burst pipe near bus stop").'
      : '';

  const descError =
    (touched.description || submitAttempted) && description.trim().length < 12
      ? 'Provide specific location details or hazard depth (at least 12 characters).'
      : '';

  const phoneTrimmed = phone.replace(/\s+/g, '');
  const phoneError =
    (touched.phone || submitAttempted) &&
    phoneTrimmed.length > 0 &&
    !/^[6-9]\d{9}$/.test(phoneTrimmed)
      ? 'Enter a valid 10-digit Indian mobile number for SMS alerts, or leave blank.'
      : '';

  const handleSimulateGps = () => {
    setGpsLocked(true);
    setPinnedCoords({ lat: selectedLocality.lat, lng: selectedLocality.lng });
    setStreetAddress(`${selectedLocality.name}, ${selectedLocality.landmark}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (honeypot.trim().length > 0 || submitting) return;
    if (title.trim().length < 8 || description.trim().length < 12 || phoneError) {
      return;
    }

    setSubmitting(true);
    const ticket = onCreateTicket({
      localityId,
      category,
      title,
      description,
      streetAddress: streetAddress || `${selectedLocality.name}, ${selectedLocality.prabhag}`,
      phone: phoneTrimmed || undefined,
      lat: pinnedCoords.lat,
      lng: pinnedCoords.lng,
    });
    setCreatedTicket(ticket);
    setSubmitting(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStreetAddress('');
    setPhone('');
    setTouched({});
    setSubmitAttempted(false);
    setCreatedTicket(null);
    setCopiedId(false);
  };

  const handleCopyId = async () => {
    if (!createdTicket) return;
    try {
      await navigator.clipboard.writeText(createdTicket.id);
      setCopiedId(true);
    } catch {
      setCopiedId(true);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-drawer-title"
      >
        <div className="drawer-header">
          <div>
            <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>
              30-SECOND CIVIC INTAKE · NO LOGIN REQUIRED
            </span>
            <h2 id="report-drawer-title" style={{ fontSize: '1.25rem', marginTop: '0.15rem' }}>
              Log Mira-Bhayandar Civic Issue
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="drawer-close-btn"
            aria-label="Close report drawer"
            onClick={onClose}
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">
          {createdTicket ? (
            <div
              style={{
                backgroundColor: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 700 }}>
                <CheckCircle2 size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>Ticket Logged &amp; Routed to Ward {createdTicket.wardNumber}</span>
              </div>

              <div
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <span className="field-label">PUBLIC TRACKING ID</span>
                  <div className="mono tabular" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    {createdTicket.id}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleCopyId}
                >
                  <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
                  <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>

              <p style={{ fontSize: '0.9rem' }}>
                Assigned to <strong>{createdTicket.assignedOfficer}</strong> with a statutory{' '}
                <strong>{createdTicket.slaHours}h SLA clock</strong>. Your ticket is now live in
                the public ledger.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    const id = createdTicket.id;
                    resetForm();
                    onClose();
                    onInspectTicket(id);
                  }}
                >
                  Inspect Ticket {createdTicket.id}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={resetForm}
                >
                  Log Another Issue
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Honeypot anti-spam trap */}
              <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                <label htmlFor="hp-website">Website URL</label>
                <input
                  id="hp-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <label htmlFor="report-locality" className="field-label">
                    1. MIRA-BHAYANDAR LOCALITY &amp; WARD *
                  </label>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={handleSimulateGps}
                  >
                    <Crosshair size={13} strokeWidth={1.5} aria-hidden="true" />
                    <span>Auto-fill GPS Pin</span>
                  </button>
                </div>

                <select
                  id="report-locality"
                  className="select"
                  value={localityId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setLocalityId(nextId);
                    const nextLoc = MIRA_BHAYANDAR_LOCALITIES.find((l) => l.id === nextId);
                    if (nextLoc) {
                      setPinnedCoords({ lat: nextLoc.lat, lng: nextLoc.lng });
                    }
                  }}
                >
                  {MIRA_BHAYANDAR_LOCALITIES.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      Ward {loc.wardNumber} — {loc.name} ({loc.prabhag})
                    </option>
                  ))}
                </select>

                {mapsEnabled && (
                  <ReportPinMapPicker
                    coords={pinnedCoords}
                    theme={theme}
                    onPickCoords={(next) => {
                      setPinnedCoords(next);
                      setGpsLocked(true);
                    }}
                  />
                )}

                <div
                  className="mono"
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <MapPin size={12} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    {gpsLocked ? 'EXIF GPS LOCKED:' : 'PIN:'} {pinnedCoords.lat.toFixed(4)}°N,{' '}
                    {pinnedCoords.lng.toFixed(4)}°E
                    {mapsEnabled ? ' (click map to refine)' : ''}
                    {selectedLocality.nearCriticalZone ? ' · 1.25x Critical Zone' : ''}
                  </span>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="report-category" className="field-label">
                  2. ISSUE CATEGORY *
                </label>
                <select
                  id="report-category"
                  className="select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IssueCategory)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t.categories[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 50m Geo-Deduplication Alert */}
              {nearbyMatches.length > 0 && (
                <div className="dedup-alert" role="region" aria-label="50-meter duplicate alert">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--warning)' }}>
                    <ShieldAlert size={16} strokeWidth={1.8} aria-hidden="true" />
                    <span>
                      50m Duplicate Check: {nearbyMatches.length} active report(s) already open in{' '}
                      {selectedLocality.name}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                    Adding +1 Confirm raises the existing ticket’s Civic Priority Score immediately
                    instead of splitting ward attention.
                  </p>

                  {nearbyMatches.map((match) => {
                    const isConfirmed = confirmedTicketIds.includes(match.id);
                    const cps = getTicketCps(match, nowMs).totalScore;
                    return (
                      <div key={match.id} className="dedup-match-card">
                        <div style={{ minWidth: 0 }}>
                          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {match.id} · CPS {cps}/100 · {match.confirmations} confirmations
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.15rem' }}>
                            {match.title}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={`btn--confirm ${isConfirmed ? 'is-confirmed' : ''}`}
                          disabled={isConfirmed}
                          onClick={() => onConfirmDuplicate(match.id)}
                        >
                          {isConfirmed ? 'Confirmed +1' : '+1 Confirm Instead'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="field-group">
                <label htmlFor="report-title" className="field-label">
                  3. SHORT ISSUE HEADLINE *
                </label>
                <input
                  id="report-title"
                  type="text"
                  className="input"
                  placeholder="e.g. Burst water valve flooding eastbound auto lane"
                  value={title}
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={titleError ? 'report-title-error' : undefined}
                  onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {titleError && (
                  <span id="report-title-error" className="field-error" role="alert">
                    {titleError}
                  </span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="report-street" className="field-label">
                  4. EXACT LANDMARK / CROSS STREET
                </label>
                <input
                  id="report-street"
                  type="text"
                  className="input"
                  placeholder={`e.g. ${selectedLocality.landmark}`}
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                />
              </div>

              <div className="field-group">
                <div className="report-voice-row">
                  <label htmlFor="report-desc" className="field-label">
                    5. FIELD OBSERVATION &amp; SEVERITY *
                  </label>
                  <button
                    type="button"
                    className={`btn btn--ghost btn--sm voice-dictate-btn ${voice.isRecording ? 'is-recording' : ''}`}
                    onClick={voice.toggleRecording}
                    disabled={voice.isTranscribing}
                  >
                    {voice.isTranscribing ? (
                      <>
                        <Loader2 size={13} className="spin-icon" aria-hidden="true" />
                        <span>Transcribing...</span>
                      </>
                    ) : voice.isRecording ? (
                      <>
                        <Square size={12} strokeWidth={2} aria-hidden="true" />
                        <span>Stop Voice Note</span>
                      </>
                    ) : (
                      <>
                        <Mic size={13} strokeWidth={1.7} aria-hidden="true" />
                        <span>Dictate Issue</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="report-desc"
                  className="textarea"
                  placeholder="Describe approximate size, depth, or duration (or tap Dictate Issue to speak in English, Marathi, or Hindi)."
                  value={description}
                  aria-invalid={Boolean(descError)}
                  aria-describedby={descError ? 'report-desc-error' : undefined}
                  onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
                  onChange={(e) => setDescription(e.target.value)}
                />
                {voice.error && (
                  <span className="field-error" role="alert">
                    {voice.error}
                  </span>
                )}
                {descError && (
                  <span id="report-desc-error" className="field-error" role="alert">
                    {descError}
                  </span>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="report-phone" className="field-label">
                  6. MOBILE FOR SMS STATUS ALERTS (OPTIONAL)
                </label>
                <input
                  id="report-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="input"
                  placeholder="10-digit mobile (optional — report stays anonymous)"
                  value={phone}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? 'report-phone-error' : undefined}
                  onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {phoneError && (
                  <span id="report-phone-error" className="field-error" role="alert">
                    {phoneError}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button type="button" className="btn btn--secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? 'Generating Ticket...' : 'Submit & Start SLA Clock'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
