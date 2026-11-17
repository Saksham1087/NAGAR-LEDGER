import { useCallback, useEffect, useState } from 'react';
import {
  INITIAL_AUDIT_CASES,
  MIRA_BHAYANDAR_LOCALITIES,
  createInitialTickets,
} from '../data/miraBhayandarData';
import type {
  CitizenAuditCase,
  CivicTicket,
  IssueCategory,
  LanguageCode,
  ThemeMode,
} from '../types/civic';
import {
  CATEGORY_INSPECTION_WINDOW_HOURS,
  CATEGORY_SLA_HOURS,
  generateTicketId,
} from '../utils/ledgerEngine';

const STORAGE_KEYS = {
  tickets: 'nagar-ledger-tickets-v1',
  confirmedIds: 'nagar-ledger-confirmed-v1',
  auditCases: 'nagar-ledger-audit-v1',
  auditVotes: 'nagar-ledger-audit-votes-v1',
  language: 'nagar-ledger-lang-v1',
  theme: 'nagar-ledger-theme',
};

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export interface NewTicketInput {
  localityId: string;
  category: IssueCategory;
  title: string;
  description: string;
  streetAddress: string;
  phone?: string;
}

export function useLedgerStore() {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [tickets, setTickets] = useState<CivicTicket[]>(() => {
    const stored = safeReadJson<CivicTicket[] | null>(STORAGE_KEYS.tickets, null);
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return createInitialTickets(Date.now());
  });

  const [confirmedTicketIds, setConfirmedTicketIds] = useState<string[]>(() =>
    safeReadJson<string[]>(STORAGE_KEYS.confirmedIds, [])
  );

  const [auditCases, setAuditCases] = useState<CitizenAuditCase[]>(() => {
    const stored = safeReadJson<CitizenAuditCase[] | null>(STORAGE_KEYS.auditCases, null);
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return INITIAL_AUDIT_CASES;
  });

  const [auditVotes, setAuditVotes] = useState<Record<string, 'verify' | 'reopen'>>(() =>
    safeReadJson<Record<string, 'verify' | 'reopen'>>(STORAGE_KEYS.auditVotes, {})
  );

  const [language, setLanguage] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.language);
      if (saved === 'en' || saved === 'mr' || saved === 'hi') return saved;
    } catch {
      // ignore
    }
    return 'en';
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
    }
    return 'light';
  });

  // Live 1-second tick for SLA countdown clocks
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.language, language);
    } catch {
      // ignore
    }
  }, [language]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.tickets, tickets);
  }, [tickets]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.confirmedIds, confirmedTicketIds);
  }, [confirmedTicketIds]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.auditCases, auditCases);
  }, [auditCases]);

  useEffect(() => {
    safeWriteJson(STORAGE_KEYS.auditVotes, auditVotes);
  }, [auditVotes]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const confirmTicket = useCallback(
    (ticketId: string, mergeDuplicate = false): boolean => {
      if (confirmedTicketIds.includes(ticketId)) {
        return false;
      }
      setConfirmedTicketIds((prev) => [...prev, ticketId]);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                confirmations: t.confirmations + 1,
                duplicatesMerged: mergeDuplicate ? t.duplicatesMerged + 1 : t.duplicatesMerged,
              }
            : t
        )
      );
      return true;
    },
    [confirmedTicketIds]
  );

  const createTicket = useCallback(
    (input: NewTicketInput): CivicTicket => {
      const locality =
        MIRA_BHAYANDAR_LOCALITIES.find((l) => l.id === input.localityId) ??
        MIRA_BHAYANDAR_LOCALITIES[0];
      const createdAtMs = Date.now();
      const newId = generateTicketId(tickets);
      const slaHours = CATEGORY_SLA_HOURS[input.category];
      const inspectionWindowHours = CATEGORY_INSPECTION_WINDOW_HOURS[input.category];

      const newTicket: CivicTicket = {
        id: newId,
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        localityId: locality.id,
        localityName: locality.name,
        wardNumber: locality.wardNumber,
        prabhag: locality.prabhag,
        streetAddress: input.streetAddress.trim() || `${locality.name}, ${locality.prabhag}`,
        lat: locality.lat,
        lng: locality.lng,
        mapX: locality.mapX,
        mapY: locality.mapY,
        status: 'open',
        createdAtMs,
        slaHours,
        inspectionWindowHours,
        nearCriticalZone: locality.nearCriticalZone,
        criticalZoneNote: locality.criticalZoneLabel,
        confirmations: 1,
        duplicatesMerged: 0,
        assignedOfficer: `Ward ${locality.wardNumber} Duty Officer (${locality.prabhag})`,
        escalationOfficer: 'Deputy Municipal Commissioner (Civic Works)',
        auditTrail: [
          {
            stage: 'Logged',
            timestampIso: new Date(createdAtMs).toISOString(),
            actor: input.phone ? `Citizen SMS Verified (${input.phone.slice(-4)})` : 'Anonymous Geo-Report',
            note: `EXIF coordinates (${locality.lat.toFixed(4)}, ${locality.lng.toFixed(4)}) locked.`,
            completed: true,
          },
          {
            stage: 'Clustered',
            timestampIso: new Date(createdAtMs).toISOString(),
            actor: '50m Geo-Dedup Engine',
            note: 'No open duplicate within 50m; initialized new primary thread.',
            completed: true,
          },
          {
            stage: 'Assigned to Ward Officer',
            timestampIso: new Date(createdAtMs).toISOString(),
            actor: 'MBMC Dispatch Router',
            note: `Routed to Ward ${locality.wardNumber} queue with ${slaHours}h statutory SLA.`,
            completed: true,
          },
          {
            stage: 'Work Crew Dispatched',
            timestampIso: '',
            actor: 'Pending Crew Assignment',
            note: 'Awaiting field unit acknowledgement.',
            completed: false,
          },
          {
            stage: 'After-Photo Uploaded',
            timestampIso: '',
            actor: 'Pending Field Verification',
            note: 'Requires geo-matched after-photo within 25m.',
            completed: false,
          },
          {
            stage: 'Citizen Verified',
            timestampIso: '',
            actor: '48h Citizen Audit Window',
            note: 'Opens after repair photo upload.',
            completed: false,
          },
        ],
      };

      setTickets((prev) => [newTicket, ...prev]);
      setConfirmedTicketIds((prev) => [...prev, newId]);
      return newTicket;
    },
    [tickets]
  );

  const voteAuditCase = useCallback(
    (ticketId: string, vote: 'verify' | 'reopen') => {
      const previousVote = auditVotes[ticketId];
      if (previousVote === vote) return;

      setAuditVotes((prev) => ({ ...prev, [ticketId]: vote }));
      setAuditCases((prev) =>
        prev.map((c) => {
          if (c.ticketId !== ticketId) return c;
          let verifyVotes = c.verifyVotes;
          let reopenVotes = c.reopenVotes;
          if (previousVote === 'verify') verifyVotes = Math.max(0, verifyVotes - 1);
          if (previousVote === 'reopen') reopenVotes = Math.max(0, reopenVotes - 1);
          if (vote === 'verify') verifyVotes += 1;
          if (vote === 'reopen') reopenVotes += 1;
          return { ...c, verifyVotes, reopenVotes };
        })
      );

      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          if (vote === 'reopen') {
            return { ...t, status: 'escalated' };
          }
          return t;
        })
      );
    },
    [auditVotes]
  );

  return {
    nowMs,
    tickets,
    confirmedTicketIds,
    auditCases,
    auditVotes,
    language,
    setLanguage,
    theme,
    toggleTheme,
    confirmTicket,
    createTicket,
    voteAuditCase,
  };
}
