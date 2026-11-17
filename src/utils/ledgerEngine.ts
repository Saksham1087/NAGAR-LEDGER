import type {
  CivicTicket,
  CpsBreakdown,
  CpsInputs,
  IssueCategory,
  LedgerFilters,
  PrabhagZone,
  SlaEvaluation,
  TicketStatus,
  WardScorecardRow,
} from '../types/civic';

export const CATEGORY_BASE_URGENCY: Record<IssueCategory, number> = {
  drainage: 40,
  water: 35,
  garbage: 25,
  road: 20,
  streetlight: 18,
};

export const CATEGORY_SLA_HOURS: Record<IssueCategory, number> = {
  garbage: 12,
  water: 24,
  drainage: 24,
  streetlight: 48,
  road: 72,
};

export const CATEGORY_INSPECTION_WINDOW_HOURS: Record<IssueCategory, number> = {
  garbage: 2,
  water: 3,
  drainage: 3,
  streetlight: 6,
  road: 8,
};

/**
 * Computes the transparent Civic Priority Score (0-100):
 * - Base Category Urgency (Drainage/Manhole 40, Water 35, Garbage 25, Road 20, Streetlight 18)
 * - Community Cluster Bonus (+3 pts per neighbor confirmation, capped at +25)
 * - Critical Zone Multiplier (1.25x within 200m of school/hospital/station/nullah)
 * - SLA Decay Boost (+1 pt per 4h past initial inspection window)
 */
export function calculateCivicPriorityScore(inputs: CpsInputs): CpsBreakdown {
  const baseUrgency = CATEGORY_BASE_URGENCY[inputs.category];
  const validConfirmations = Math.max(0, Math.floor(inputs.neighborConfirmations));
  const clusterBonus = Math.min(25, validConfirmations * 3);
  const criticalMultiplier = inputs.nearCriticalZone ? 1.25 : 1.0;
  const validDecayHours = Math.max(0, inputs.hoursPastInspection);
  const decayBoost = Math.floor(validDecayHours / 4);

  const rawScore = (baseUrgency + clusterBonus) * criticalMultiplier + decayBoost;
  const totalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  let dispatchTier: CpsBreakdown['dispatchTier'] = 'P3 Scheduled';
  if (totalScore >= 70) {
    dispatchTier = 'P1 Immediate (<2h)';
  } else if (totalScore >= 45) {
    dispatchTier = 'P2 Urgent (Same Shift)';
  }

  return {
    baseUrgency,
    clusterBonus,
    criticalMultiplier,
    decayBoost,
    totalScore,
    dispatchTier,
  };
}

export function getTicketCps(ticket: CivicTicket, nowMs: number): CpsBreakdown {
  const elapsedHours = Math.max(0, (nowMs - ticket.createdAtMs) / 3600000);
  const hoursPastInspection = Math.max(0, elapsedHours - ticket.inspectionWindowHours);
  const neighborConfirmations = Math.max(0, ticket.confirmations - 1);

  return calculateCivicPriorityScore({
    category: ticket.category,
    neighborConfirmations,
    nearCriticalZone: ticket.nearCriticalZone,
    hoursPastInspection,
  });
}

export function formatDurationCompact(ms: number): string {
  const absMs = Math.abs(ms);
  const totalMinutes = Math.floor(absMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((absMs % 60000) / 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${hh}h ${mm}m ${ss}s`;
}

export function evaluateTicketSla(ticket: CivicTicket, nowMs: number): SlaEvaluation {
  const deadlineMs = ticket.createdAtMs + ticket.slaHours * 3600000;
  const remainingMs = deadlineMs - nowMs;

  if (ticket.status === 'verified') {
    return {
      deadlineMs,
      remainingMs: 0,
      formattedCountdown: 'CLOSED / VERIFIED',
      isBreached: false,
      isAtRisk: false,
      effectiveStatus: 'verified',
    };
  }

  if (ticket.status === 'awaiting_audit') {
    return {
      deadlineMs,
      remainingMs: Math.max(0, remainingMs),
      formattedCountdown: '48H AUDIT WINDOW',
      isBreached: false,
      isAtRisk: false,
      effectiveStatus: 'awaiting_audit',
    };
  }

  const isBreached = remainingMs <= 0;
  const riskThresholdMs = ticket.slaHours * 3600000 * 0.25;
  const isAtRisk = !isBreached && remainingMs <= riskThresholdMs;

  let effectiveStatus: TicketStatus = ticket.status;
  if (isBreached) {
    effectiveStatus = 'escalated';
  } else if (isAtRisk) {
    effectiveStatus = 'sla_risk';
  } else {
    effectiveStatus = 'open';
  }

  const formattedCountdown = isBreached
    ? `+${formatDurationCompact(remainingMs)} OVERDUE`
    : formatDurationCompact(remainingMs);

  return {
    deadlineMs,
    remainingMs,
    formattedCountdown,
    isBreached,
    isAtRisk,
    effectiveStatus,
  };
}

/**
 * Finds active tickets within 50m / matching locality & category so citizens can "+1 Confirm"
 * rather than filing duplicate reports.
 */
export function findNearbyDuplicates(
  tickets: CivicTicket[],
  localityId: string,
  category: IssueCategory,
  nowMs: number
): CivicTicket[] {
  return tickets.filter((ticket) => {
    const sla = evaluateTicketSla(ticket, nowMs);
    if (sla.effectiveStatus === 'verified') return false;
    return ticket.localityId === localityId && ticket.category === category;
  });
}

export function filterAndSortTickets(
  tickets: CivicTicket[],
  filters: LedgerFilters,
  nowMs: number
): CivicTicket[] {
  const queryNorm = filters.query.trim().toLowerCase();

  const filtered = tickets.filter((ticket) => {
    const sla = evaluateTicketSla(ticket, nowMs);
    if (filters.category !== 'all' && ticket.category !== filters.category) return false;
    if (filters.prabhag !== 'all' && ticket.prabhag !== filters.prabhag) return false;
    if (filters.status !== 'all' && sla.effectiveStatus !== filters.status) return false;

    if (queryNorm.length > 0) {
      const searchable = [
        ticket.id,
        ticket.title,
        ticket.localityName,
        ticket.streetAddress,
        ticket.prabhag,
        `ward ${ticket.wardNumber}`,
        `w-${ticket.wardNumber}`,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(queryNorm)) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sortBy === 'cps_desc') {
      return getTicketCps(b, nowMs).totalScore - getTicketCps(a, nowMs).totalScore;
    }
    if (filters.sortBy === 'sla_asc') {
      const slaA = evaluateTicketSla(a, nowMs);
      const slaB = evaluateTicketSla(b, nowMs);
      return slaA.remainingMs - slaB.remainingMs;
    }
    if (filters.sortBy === 'confirmations_desc') {
      return b.confirmations - a.confirmations;
    }
    return b.createdAtMs - a.createdAtMs;
  });
}

export function computeLedgerTelemetry(tickets: CivicTicket[], nowMs: number) {
  let activeOpen = 0;
  let resolvedFast = 0;
  let escalatedToDmc = 0;
  let mergedDuplicates = 0;

  for (const ticket of tickets) {
    const sla = evaluateTicketSla(ticket, nowMs);
    mergedDuplicates += ticket.duplicatesMerged;

    if (sla.effectiveStatus === 'verified' || sla.effectiveStatus === 'awaiting_audit') {
      resolvedFast += 1;
    } else {
      activeOpen += 1;
      if (sla.effectiveStatus === 'escalated') {
        escalatedToDmc += 1;
      }
    }
  }

  return {
    activeOpen,
    resolvedFast,
    escalatedToDmc,
    mergedDuplicates,
  };
}

export function computeWardScorecards(
  tickets: CivicTicket[],
  baseRows: Omit<WardScorecardRow, 'openCriticalCount' | 'escalatedCount' | 'totalTracked'>[],
  nowMs: number
): WardScorecardRow[] {
  const byPrabhag = new Map<PrabhagZone, { openCritical: number; escalated: number; total: number }>();

  for (const row of baseRows) {
    byPrabhag.set(row.prabhag, { openCritical: 0, escalated: 0, total: 0 });
  }

  for (const ticket of tickets) {
    const bucket = byPrabhag.get(ticket.prabhag);
    if (!bucket) continue;
    bucket.total += 1;
    const sla = evaluateTicketSla(ticket, nowMs);
    const cps = getTicketCps(ticket, nowMs).totalScore;
    if (sla.effectiveStatus === 'escalated') {
      bucket.escalated += 1;
    }
    if (
      sla.effectiveStatus !== 'verified' &&
      sla.effectiveStatus !== 'awaiting_audit' &&
      cps >= 55
    ) {
      bucket.openCritical += 1;
    }
  }

  return baseRows.map((row) => {
    const counts = byPrabhag.get(row.prabhag) ?? { openCritical: 0, escalated: 0, total: 0 };
    return {
      ...row,
      openCriticalCount: counts.openCritical,
      escalatedCount: counts.escalated,
      totalTracked: counts.total,
    };
  });
}

export function generateTicketId(existingTickets: CivicTicket[]): string {
  let maxNum = 840;
  for (const t of existingTickets) {
    const match = t.id.match(/MBMC-2026-(\d+)/);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `MBMC-2026-${String(maxNum + 1).padStart(4, '0')}`;
}
