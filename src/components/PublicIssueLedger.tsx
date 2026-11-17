import { useMemo, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import type { TranslationBundle } from '../data/translations';
import type {
  CivicTicket,
  IssueCategory,
  LedgerFilters,
  PrabhagZone,
  TicketStatus,
} from '../types/civic';
import {
  evaluateTicketSla,
  filterAndSortTickets,
  getTicketCps,
} from '../utils/ledgerEngine';
import { StatusStamp } from './StatusStamp';

interface PublicIssueLedgerProps {
  t: TranslationBundle;
  tickets: CivicTicket[];
  confirmedTicketIds: string[];
  nowMs: number;
  onConfirmTicket: (ticketId: string) => void;
  onInspectTicket: (ticketId: string) => void;
  onOpenReport: () => void;
}

const PRABHAGS: PrabhagZone[] = [
  'Mira Road East',
  'Kashimira',
  'Bhayandar West',
  'Bhayandar East',
  'Navghar',
  'Uttan',
];

const CATEGORIES: IssueCategory[] = [
  'water',
  'drainage',
  'garbage',
  'road',
  'streetlight',
];

const STATUS_OPTIONS: (TicketStatus | 'all')[] = [
  'all',
  'open',
  'sla_risk',
  'escalated',
  'awaiting_audit',
  'verified',
];

const DEFAULT_FILTERS: LedgerFilters = {
  query: '',
  category: 'all',
  prabhag: 'all',
  status: 'all',
  sortBy: 'cps_desc',
};

export function PublicIssueLedger({
  t,
  tickets,
  confirmedTicketIds,
  nowMs,
  onConfirmTicket,
  onInspectTicket,
  onOpenReport,
}: PublicIssueLedgerProps) {
  const [filters, setFilters] = useState<LedgerFilters>(DEFAULT_FILTERS);

  const visibleTickets = useMemo(
    () => filterAndSortTickets(tickets, filters, nowMs),
    [tickets, filters, nowMs]
  );

  const handleExportJson = () => {
    const payload = visibleTickets.map((ticket) => ({
      ...ticket,
      computedCps: getTicketCps(ticket, nowMs).totalScore,
      computedSla: evaluateTicketSla(ticket, nowMs),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mbmc-nagrikseva-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters =
    filters.query !== '' ||
    filters.category !== 'all' ||
    filters.prabhag !== 'all' ||
    filters.status !== 'all';

  return (
    <section
      id="live-ledger"
      className="section"
      aria-labelledby="ledger-heading"
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="section-header" style={{ marginBottom: 0 }}>
            <span className="section-index">01. PUBLIC ISSUE LEDGER</span>
            <h2 id="ledger-heading">Live Mira-Bhayandar Dispatch Queue</h2>
            <p className="section-lead">
              Every ticket is stamped with an immutable Ward ID, live SLA clock, and
              Civic Priority Score. Confirming a nearby issue increments its urgency
              without opening a duplicate record.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleExportJson}
            >
              <Download size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>{t.actions.exportJson}</span>
            </button>
          </div>
        </div>

        <div className="ledger-toolbar" role="search" aria-label="Filter public issue ledger">
          <div className="ledger-filters-grid">
            <div className="field-group">
              <label htmlFor="ledger-search" className="field-label">
                SEARCH STREET, LOCALITY, OR TICKET ID
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="ledger-search"
                  type="search"
                  className="input"
                  style={{ paddingLeft: '2.2rem' }}
                  placeholder="e.g. Golden Nest, Ward 8, MBMC-2026-0842"
                  value={filters.query}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, query: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="ledger-category" className="field-label">
                CATEGORY
              </label>
              <select
                id="ledger-category"
                className="select"
                value={filters.category}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    category: e.target.value as IssueCategory | 'all',
                  }))
                }
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t.categories[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="ledger-prabhag" className="field-label">
                PRABHAG / LOCALITY ZONE
              </label>
              <select
                id="ledger-prabhag"
                className="select"
                value={filters.prabhag}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    prabhag: e.target.value as PrabhagZone | 'all',
                  }))
                }
              >
                <option value="all">All Wards (1–24)</option>
                {PRABHAGS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="ledger-sort" className="field-label">
                SORT DISPATCH ORDER
              </label>
              <select
                id="ledger-sort"
                className="select"
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: e.target.value as LedgerFilters['sortBy'],
                  }))
                }
              >
                <option value="cps_desc">Highest Priority Score (CPS)</option>
                <option value="sla_asc">Shortest SLA Remaining</option>
                <option value="confirmations_desc">Most Neighbor Confirmations</option>
                <option value="newest">Most Recently Logged</option>
              </select>
            </div>
          </div>

          <div className="status-tabs">
            <div className="status-tabs__list" role="group" aria-label="Filter by ticket status">
              {STATUS_OPTIONS.map((statusKey) => (
                <button
                  key={statusKey}
                  type="button"
                  className="filter-tab"
                  aria-pressed={filters.status === statusKey}
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, status: statusKey }))
                  }
                >
                  {statusKey === 'all' ? 'All Statuses' : t.statuses[statusKey]}
                </button>
              ))}
            </div>

            <div
              className="mono tabular"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
              aria-live="polite"
            >
              <span>
                Showing {visibleTickets.length} of {tickets.length} records
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  <RotateCcw size={13} strokeWidth={1.5} aria-hidden="true" />
                  <span>{t.actions.resetFilters}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {visibleTickets.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontWeight: 600 }}>
              No civic records match the selected ward or status filters.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Clear filters to inspect the full Mira-Bhayandar queue or log a new street issue.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                {t.actions.resetFilters}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onOpenReport}
              >
                {t.hero.primaryCta}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Data Table */}
            <div className="ledger-table-wrap">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th scope="col">TICKET ID</th>
                    <th scope="col">ISSUE &amp; LOCATION</th>
                    <th scope="col">CPS</th>
                    <th scope="col">SLA CLOCK</th>
                    <th scope="col">STATUS</th>
                    <th scope="col">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTickets.map((ticket) => {
                    const sla = evaluateTicketSla(ticket, nowMs);
                    const cps = getTicketCps(ticket, nowMs);
                    const isConfirmed = confirmedTicketIds.includes(ticket.id);

                    return (
                      <tr key={ticket.id}>
                        <td className="mono tabular" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {ticket.id}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ledger-row-title-btn"
                            onClick={() => onInspectTicket(ticket.id)}
                          >
                            {ticket.title}
                          </button>
                          <div className="ledger-row-meta">
                            <span>Ward {ticket.wardNumber}</span>
                            <span aria-hidden="true">·</span>
                            <span>{ticket.localityName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{t.categories[ticket.category]}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular">{ticket.confirmations} confirmations</span>
                          </div>
                        </td>
                        <td>
                          <div className="cps-cell">
                            <span
                              className={`cps-score tabular ${cps.totalScore >= 70 ? 'cps-score--high' : ''}`}
                            >
                              {cps.totalScore}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              /100
                            </span>
                          </div>
                        </td>
                        <td
                          className="mono tabular"
                          style={{
                            whiteSpace: 'nowrap',
                            fontSize: '0.78rem',
                            color: sla.isBreached ? 'var(--danger)' : 'var(--text)',
                            fontWeight: sla.isBreached ? 600 : 500,
                          }}
                        >
                          {sla.formattedCountdown}
                        </td>
                        <td>
                          <StatusStamp
                            status={sla.effectiveStatus}
                            label={t.statuses[sla.effectiveStatus]}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className={`btn--confirm ${isConfirmed ? 'is-confirmed' : ''}`}
                              disabled={isConfirmed || sla.effectiveStatus === 'verified'}
                              onClick={() => onConfirmTicket(ticket.id)}
                              aria-label={`${isConfirmed ? 'Confirmed' : 'Confirm'} ${ticket.id} (${ticket.confirmations} confirmations)`}
                            >
                              {isConfirmed
                                ? `${t.actions.confirmed} (${ticket.confirmations})`
                                : `${t.actions.confirmPlusOne} (${ticket.confirmations})`}
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => onInspectTicket(ticket.id)}
                              aria-label={`Inspect ticket ${ticket.id}`}
                            >
                              {t.actions.inspectTicket}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Ledger Cards */}
            <div className="ledger-mobile-list">
              {visibleTickets.map((ticket) => {
                const sla = evaluateTicketSla(ticket, nowMs);
                const cps = getTicketCps(ticket, nowMs);
                const isConfirmed = confirmedTicketIds.includes(ticket.id);

                return (
                  <article key={ticket.id} className="ledger-card">
                    <div className="ledger-card__top">
                      <span className="mono tabular" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {ticket.id}
                      </span>
                      <StatusStamp
                        status={sla.effectiveStatus}
                        label={t.statuses[sla.effectiveStatus]}
                      />
                    </div>

                    <div>
                      <button
                        type="button"
                        className="ledger-row-title-btn"
                        style={{ fontSize: '1rem' }}
                        onClick={() => onInspectTicket(ticket.id)}
                      >
                        {ticket.title}
                      </button>
                      <div className="ledger-row-meta">
                        <span>Ward {ticket.wardNumber}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ticket.localityName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.categories[ticket.category]}</span>
                      </div>
                    </div>

                    <div
                      className="mono tabular"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: sla.isBreached ? 'var(--danger)' : 'var(--text-muted)',
                      }}
                    >
                      <span>CPS {cps.totalScore}/100</span>
                      <span>{sla.formattedCountdown}</span>
                    </div>

                    <div className="ledger-card__actions">
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
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => onInspectTicket(ticket.id)}
                      >
                        {t.actions.inspectTicket}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
