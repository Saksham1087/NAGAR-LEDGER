import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCivicPriorityScore,
  computeLedgerTelemetry,
  evaluateTicketSla,
  filterAndSortTickets,
  findNearbyDuplicates,
  generateTicketId,
} from './ledgerEngine';
import type { CivicTicket } from '../types/civic';

const NOW = 1_763_400_000_000;

function makeTicket(overrides: Partial<CivicTicket> = {}): CivicTicket {
  return {
    id: 'MBMC-2026-0842',
    title: 'Main water pipeline joint leak near Golden Nest Circle',
    description: 'Continuous pressurized leak flooding eastbound lane.',
    category: 'water',
    localityId: 'golden-nest',
    localityName: 'Golden Nest Circle',
    wardNumber: 8,
    prabhag: 'Mira Road East',
    streetAddress: 'Golden Nest Circle, Phase II, Mira Road East',
    lat: 19.2861,
    lng: 72.8692,
    mapX: 520,
    mapY: 310,
    status: 'open',
    createdAtMs: NOW - 4 * 3600000,
    slaHours: 24,
    inspectionWindowHours: 3,
    nearCriticalZone: true,
    confirmations: 5,
    duplicatesMerged: 2,
    assignedOfficer: 'JE Rajesh Patil (Prabhag 3)',
    escalationOfficer: 'DMC (Water Supply)',
    auditTrail: [],
    ...overrides,
  };
}

test('calculateCivicPriorityScore applies base urgency, capped cluster bonus, 1.25x multiplier, and decay', () => {
  // Base water = 35; 4 neighbor confirmations = +12; subtotal = 47; 1.25x = 58.75; decay 8h past -> +2; total = 61
  const res = calculateCivicPriorityScore({
    category: 'water',
    neighborConfirmations: 4,
    nearCriticalZone: true,
    hoursPastInspection: 8,
  });
  assert.equal(res.baseUrgency, 35);
  assert.equal(res.clusterBonus, 12);
  assert.equal(res.criticalMultiplier, 1.25);
  assert.equal(res.decayBoost, 2);
  assert.equal(res.totalScore, 61);
  assert.equal(res.dispatchTier, 'P2 Urgent (Same Shift)');

  // Cluster bonus caps at 25 and total clamps to 100
  const maxRes = calculateCivicPriorityScore({
    category: 'drainage',
    neighborConfirmations: 20,
    nearCriticalZone: true,
    hoursPastInspection: 80,
  });
  assert.equal(maxRes.clusterBonus, 25);
  assert.equal(maxRes.totalScore, 100);
  assert.equal(maxRes.dispatchTier, 'P1 Immediate (<2h)');
});

test('evaluateTicketSla flags overdue tickets as escalated and near-deadline as sla_risk', () => {
  const overdue = makeTicket({
    createdAtMs: NOW - 26 * 3600000,
    slaHours: 24,
  });
  const overdueEval = evaluateTicketSla(overdue, NOW);
  assert.equal(overdueEval.isBreached, true);
  assert.equal(overdueEval.effectiveStatus, 'escalated');
  assert.match(overdueEval.formattedCountdown, /OVERDUE/);

  const atRisk = makeTicket({
    createdAtMs: NOW - 20 * 3600000,
    slaHours: 24,
  });
  const riskEval = evaluateTicketSla(atRisk, NOW);
  assert.equal(riskEval.isBreached, false);
  assert.equal(riskEval.isAtRisk, true);
  assert.equal(riskEval.effectiveStatus, 'sla_risk');
});

test('findNearbyDuplicates returns active matching locality + category tickets and ignores verified ones', () => {
  const activeMatch = makeTicket({ id: 'MBMC-2026-0842', localityId: 'golden-nest', category: 'water' });
  const verifiedMatch = makeTicket({
    id: 'MBMC-2026-0811',
    localityId: 'golden-nest',
    category: 'water',
    status: 'verified',
  });
  const otherLocality = makeTicket({ id: 'MBMC-2026-0845', localityId: 'kashimira', category: 'water' });

  const matches = findNearbyDuplicates([activeMatch, verifiedMatch, otherLocality], 'golden-nest', 'water', NOW);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'MBMC-2026-0842');
});

test('filterAndSortTickets filters by query/category/status and sorts by CPS descending', () => {
  const t1 = makeTicket({ id: 'MBMC-2026-0842', category: 'water', confirmations: 2, nearCriticalZone: false });
  const t2 = makeTicket({ id: 'MBMC-2026-0849', category: 'drainage', confirmations: 9, nearCriticalZone: true });
  const result = filterAndSortTickets(
    [t1, t2],
    { query: '', category: 'all', prabhag: 'all', status: 'all', sortBy: 'cps_desc' },
    NOW
  );
  assert.equal(result[0].id, 'MBMC-2026-0849');
});

test('computeLedgerTelemetry counts open, resolved, escalated, and merged duplicates accurately', () => {
  const openT = makeTicket({ id: '1', createdAtMs: NOW - 2 * 3600000, slaHours: 24, duplicatesMerged: 3 });
  const escalatedT = makeTicket({ id: '2', createdAtMs: NOW - 30 * 3600000, slaHours: 24, duplicatesMerged: 2 });
  const verifiedT = makeTicket({ id: '3', status: 'verified', duplicatesMerged: 1 });

  const stats = computeLedgerTelemetry([openT, escalatedT, verifiedT], NOW);
  assert.equal(stats.activeOpen, 2);
  assert.equal(stats.escalatedToDmc, 1);
  assert.equal(stats.resolvedFast, 1);
  assert.equal(stats.mergedDuplicates, 6);
});

test('generateTicketId increments sequence cleanly', () => {
  const nextId = generateTicketId([makeTicket({ id: 'MBMC-2026-0842' }), makeTicket({ id: 'MBMC-2026-0854' })]);
  assert.equal(nextId, 'MBMC-2026-0855');
});
