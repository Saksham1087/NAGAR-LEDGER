import { useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import type { TranslationBundle } from '../data/translations';
import type { CivicTicket } from '../types/civic';
import { evaluateTicketSla, getTicketCps } from '../utils/ledgerEngine';
import { StatusStamp } from './StatusStamp';

interface TicketInspectorModalProps {
  ticket: CivicTicket | null;
  t: TranslationBundle;
  nowMs: number;
  isConfirmed: boolean;
  onClose: () => void;
  onConfirmTicket: (ticketId: string) => void;
}

export function TicketInspectorModal({
  ticket,
  t,
  nowMs,
  isConfirmed,
  onClose,
  onConfirmTicket,
}: TicketInspectorModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!ticket) return;
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
  }, [ticket, onClose]);

  if (!ticket) return null;

  const sla = evaluateTicketSla(ticket, nowMs);
  const cps = getTicketCps(ticket, nowMs);

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
        aria-labelledby="inspector-ticket-title"
      >
        <div className="drawer-header">
          <div>
            <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {ticket.id} · WARD {ticket.wardNumber} ({ticket.prabhag})
            </div>
            <h2 id="inspector-ticket-title" style={{ fontSize: '1.15rem', marginTop: '0.2rem' }}>
              Ticket Audit &amp; Escalation Record
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="drawer-close-btn"
            aria-label="Close ticket inspector"
            onClick={onClose}
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <StatusStamp
              status={sla.effectiveStatus}
              label={t.statuses[sla.effectiveStatus]}
            />
            <span
              className="mono tabular"
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: sla.isBreached ? 'var(--danger)' : 'var(--text)',
              }}
            >
              {sla.formattedCountdown}
            </span>
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem' }}>{ticket.title}</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {ticket.description}
            </p>
            <div
              className="mono"
              style={{
                marginTop: '0.75rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.45rem',
                alignItems: 'center',
              }}
            >
              <MapPin size={13} strokeWidth={1.5} aria-hidden="true" />
              <span>{ticket.streetAddress}</span>
              <span aria-hidden="true">·</span>
              <span>
                {ticket.lat.toFixed(4)}°N, {ticket.lng.toFixed(4)}°E
              </span>
            </div>
          </div>

          {/* CPS Formula Breakdown Box */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="field-label">CIVIC PRIORITY SCORE BREAKDOWN</span>
              <span className="mono tabular" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent)' }}>
                {cps.totalScore} / 100
              </span>
            </div>

            <dl className="formula-list" style={{ marginTop: '0.75rem' }}>
              <div className="formula-item">
                <dt>Base Category ({t.categories[ticket.category]})</dt>
                <dd className="mono tabular">+{cps.baseUrgency} pts</dd>
              </div>
              <div className="formula-item">
                <dt>Neighbor Cluster ({ticket.confirmations} citizens)</dt>
                <dd className="mono tabular">+{cps.clusterBonus} pts</dd>
              </div>
              <div className="formula-item">
                <dt>Critical Zone Multiplier</dt>
                <dd className="mono tabular">
                  ×{cps.criticalMultiplier.toFixed(2)}{' '}
                  {ticket.criticalZoneNote ? `(${ticket.criticalZoneNote})` : ''}
                </dd>
              </div>
              <div className="formula-item" style={{ borderBottom: 0 }}>
                <dt>SLA Decay Boost</dt>
                <dd className="mono tabular">+{cps.decayBoost} pts</dd>
              </div>
            </dl>
          </div>

          {/* Escalation & Assignment */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              paddingBlock: '0.85rem',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <span className="field-label">ASSIGNED WARD OFFICER</span>
              <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{ticket.assignedOfficer}</div>
            </div>
            <div>
              <span className="field-label">SLA ESCALATION TARGET</span>
              <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{ticket.escalationOfficer}</div>
            </div>
          </div>

          {/* Immutable 6-Stage Audit Trail */}
          <div>
            <span className="field-label" style={{ display: 'block', marginBottom: '0.85rem' }}>
              IMMUTABLE AUDIT TRAIL
            </span>
            <ol className="timeline-list">
              {ticket.auditTrail.map((step) => (
                <li
                  key={step.stage}
                  className={`timeline-step ${step.completed ? 'is-done' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.88rem' }}>{step.stage}</strong>
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {step.timestampIso
                        ? new Intl.DateTimeFormat('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Kolkata',
                          }).format(new Date(step.timestampIso))
                        : 'Pending'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {step.actor} — {step.note}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              className={`btn--confirm ${isConfirmed ? 'is-confirmed' : ''}`}
              disabled={isConfirmed || sla.effectiveStatus === 'verified'}
              onClick={() => onConfirmTicket(ticket.id)}
            >
              {isConfirmed
                ? `${t.actions.confirmed} (${ticket.confirmations})`
                : `${t.actions.confirmPlusOne} (${ticket.confirmations})`}
            </button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
