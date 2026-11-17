export type LanguageCode = 'en' | 'mr' | 'hi';

export type ThemeMode = 'light' | 'dark';

export type IssueCategory =
  | 'water'
  | 'drainage'
  | 'garbage'
  | 'road'
  | 'streetlight';

export type TicketStatus =
  | 'open'
  | 'sla_risk'
  | 'escalated'
  | 'awaiting_audit'
  | 'verified';

export type PrabhagZone =
  | 'Mira Road East'
  | 'Kashimira'
  | 'Bhayandar West'
  | 'Bhayandar East'
  | 'Navghar'
  | 'Uttan';

export interface Locality {
  id: string;
  name: string;
  wardNumber: number;
  prabhag: PrabhagZone;
  landmark: string;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  nearCriticalZone: boolean;
  criticalZoneLabel?: string;
}

export interface AuditTrailEvent {
  stage:
    | 'Logged'
    | 'Clustered'
    | 'Assigned to Ward Officer'
    | 'Work Crew Dispatched'
    | 'After-Photo Uploaded'
    | 'Citizen Verified';
  timestampIso: string;
  actor: string;
  note: string;
  completed: boolean;
}

export interface CivicTicket {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  localityId: string;
  localityName: string;
  wardNumber: number;
  prabhag: PrabhagZone;
  streetAddress: string;
  lat: number;
  lng: number;
  mapX: number;
  mapY: number;
  status: TicketStatus;
  createdAtMs: number;
  slaHours: number;
  inspectionWindowHours: number;
  nearCriticalZone: boolean;
  criticalZoneNote?: string;
  confirmations: number;
  duplicatesMerged: number;
  assignedOfficer: string;
  escalationOfficer: string;
  auditTrail: AuditTrailEvent[];
  beforeImageTag?: string;
  afterImageTag?: string;
  citizenVerifyCount?: number;
  citizenReopenCount?: number;
  authorUid?: string;
}

export type CopilotMode = 'search' | 'fast' | 'deep';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  groundingSources?: GroundingSource[];
  createdAtMs: number;
}

export interface CpsInputs {
  category: IssueCategory;
  neighborConfirmations: number;
  nearCriticalZone: boolean;
  hoursPastInspection: number;
}

export interface CpsBreakdown {
  baseUrgency: number;
  clusterBonus: number;
  criticalMultiplier: number;
  decayBoost: number;
  totalScore: number;
  dispatchTier: 'P1 Immediate (<2h)' | 'P2 Urgent (Same Shift)' | 'P3 Scheduled';
}

export interface SlaEvaluation {
  deadlineMs: number;
  remainingMs: number;
  formattedCountdown: string;
  isBreached: boolean;
  isAtRisk: boolean;
  effectiveStatus: TicketStatus;
}

export interface LedgerFilters {
  query: string;
  category: IssueCategory | 'all';
  prabhag: PrabhagZone | 'all';
  status: TicketStatus | 'all';
  sortBy: 'cps_desc' | 'sla_asc' | 'confirmations_desc' | 'newest';
}

export interface WardScorecardRow {
  wardLabel: string;
  prabhag: PrabhagZone;
  wardRange: string;
  juniorEngineer: string;
  mttrHours: number;
  slaCompliancePct: number;
  openCriticalCount: number;
  escalatedCount: number;
  totalTracked: number;
}

export interface CitizenAuditCase {
  ticketId: string;
  title: string;
  wardNumber: number;
  locality: string;
  resolvedBy: string;
  beforeTimestamp: string;
  afterTimestamp: string;
  geoMatchMeters: number;
  schematicType: 'pothole' | 'water' | 'garbage';
  verifyVotes: number;
  reopenVotes: number;
}
