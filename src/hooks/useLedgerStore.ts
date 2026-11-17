import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  INITIAL_AUDIT_CASES,
  MIRA_BHAYANDAR_LOCALITIES,
  createInitialTickets,
} from '../data/miraBhayandarData';
import {
  BLUEPRINT_LIMITS,
  OperationType,
  db,
  formatFirestoreQuotaNotice,
  handleFirestoreError,
  sanitizeFirestoreId,
} from '../firebase';
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
  tickets: 'nagrikseva-tickets-v1',
  confirmedIds: 'nagrikseva-confirmed-v1',
  auditCases: 'nagrikseva-audit-v1',
  auditVotes: 'nagrikseva-audit-votes-v1',
  language: 'nagrikseva-lang-v1',
  theme: 'nagrikseva-theme',
};

const LEGACY_KEYS = {
  tickets: 'nagar-ledger-tickets-v1',
  confirmedIds: 'nagar-ledger-confirmed-v1',
  auditCases: 'nagar-ledger-audit-v1',
  auditVotes: 'nagar-ledger-audit-votes-v1',
  language: 'nagar-ledger-lang-v1',
};

function safeReadJson<T>(key: string, fallback: T, legacyKey?: string): T {
  try {
    const raw =
      localStorage.getItem(key) ??
      (legacyKey ? localStorage.getItem(legacyKey) : null);
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
  lat?: number;
  lng?: number;
}

export interface AuthSyncState {
  uid?: string | null;
  emailVerified?: boolean;
  authReady: boolean;
}

export function useLedgerStore(authSync?: AuthSyncState) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [tickets, setTickets] = useState<CivicTicket[]>(() => {
    const stored = safeReadJson<CivicTicket[] | null>(
      STORAGE_KEYS.tickets,
      null,
      LEGACY_KEYS.tickets
    );
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return createInitialTickets(Date.now());
  });

  const [confirmedTicketIds, setConfirmedTicketIds] = useState<string[]>(() =>
    safeReadJson<string[]>(
      STORAGE_KEYS.confirmedIds,
      [],
      LEGACY_KEYS.confirmedIds
    )
  );

  const [auditCases, setAuditCases] = useState<CitizenAuditCase[]>(() => {
    const stored = safeReadJson<CitizenAuditCase[] | null>(
      STORAGE_KEYS.auditCases,
      null,
      LEGACY_KEYS.auditCases
    );
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return INITIAL_AUDIT_CASES;
  });

  const [auditVotes, setAuditVotes] = useState<Record<string, 'verify' | 'reopen'>>(() =>
    safeReadJson<Record<string, 'verify' | 'reopen'>>(
      STORAGE_KEYS.auditVotes,
      {},
      LEGACY_KEYS.auditVotes
    )
  );

  const [language, setLanguage] = useState<LanguageCode>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEYS.language) ??
        localStorage.getItem(LEGACY_KEYS.language);
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

  const syncedVoteIdsRef = useRef<Set<string>>(new Set());

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

  const canSyncFirestore = Boolean(
    authSync?.authReady && authSync.uid && authSync.emailVerified
  );
  const activeUid = canSyncFirestore && authSync?.uid
    ? sanitizeFirestoreId(authSync.uid)
    : null;

  // Real-time Cloud Firestore listeners scoped to the verified authenticated user
  useEffect(() => {
    if (!activeUid) {
      syncedVoteIdsRef.current = new Set();
      return;
    }

    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('authorUid', '==', activeUid)
    );
    const votesQuery = query(
      collection(db, 'auditVotes'),
      where('userId', '==', activeUid)
    );

    const unsubTickets = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const remoteTickets: CivicTicket[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          remoteTickets.push({
            id: String(data.id ?? docSnap.id),
            authorUid: typeof data.authorUid === 'string' ? data.authorUid : activeUid,
            title: String(data.title ?? ''),
            description: String(data.description ?? ''),
            category: data.category as IssueCategory,
            localityId: String(data.localityId ?? ''),
            localityName: String(data.localityName ?? ''),
            wardNumber: Number(data.wardNumber ?? 1),
            prabhag: data.prabhag as CivicTicket['prabhag'],
            streetAddress: String(data.streetAddress ?? ''),
            lat: Number(data.lat ?? 19.2813),
            lng: Number(data.lng ?? 72.8685),
            mapX: Number(data.mapX ?? 50),
            mapY: Number(data.mapY ?? 50),
            status: data.status as CivicTicket['status'],
            createdAtMs: Number(data.createdAtMs ?? Date.now()),
            slaHours: Number(data.slaHours ?? 24),
            inspectionWindowHours: Number(data.inspectionWindowHours ?? 3),
            nearCriticalZone: Boolean(data.nearCriticalZone),
            criticalZoneNote:
              typeof data.criticalZoneNote === 'string' ? data.criticalZoneNote : undefined,
            confirmations: Number(data.confirmations ?? 1),
            duplicatesMerged: Number(data.duplicatesMerged ?? 0),
            assignedOfficer: String(data.assignedOfficer ?? ''),
            escalationOfficer: String(data.escalationOfficer ?? ''),
            auditTrail: Array.isArray(data.auditTrail)
              ? (data.auditTrail as CivicTicket['auditTrail'])
              : [],
          });
        });

        remoteTickets.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setTickets((prev) => {
          const remoteById = new Map(remoteTickets.map((item) => [item.id, item]));
          const remainingLocal = prev.filter(
            (item) => !remoteById.has(item.id) && item.authorUid !== activeUid
          );
          return [...remoteTickets, ...remainingLocal];
        });
        setConfirmedTicketIds((prev) => {
          const merged = new Set(prev);
          for (const rt of remoteTickets) {
            merged.add(rt.id);
          }
          return Array.from(merged);
        });
      },
      (error) => {
        const notice = formatFirestoreQuotaNotice(error.message);
        if (notice !== error.message) {
          setSyncNotice(notice);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'tickets');
      }
    );

    const unsubVotes = onSnapshot(
      votesQuery,
      (snapshot) => {
        const nextVoteIds = new Set<string>();
        const remoteVotes: Record<string, 'verify' | 'reopen'> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as {
            ticketId?: string;
            vote?: 'verify' | 'reopen';
          };
          if (data.ticketId && (data.vote === 'verify' || data.vote === 'reopen')) {
            nextVoteIds.add(docSnap.id);
            remoteVotes[data.ticketId] = data.vote;
          }
        });
        syncedVoteIdsRef.current = nextVoteIds;
        if (Object.keys(remoteVotes).length > 0) {
          setAuditVotes((prev) => ({ ...prev, ...remoteVotes }));
        }
      },
      (error) => {
        const notice = formatFirestoreQuotaNotice(error.message);
        if (notice !== error.message) {
          setSyncNotice(notice);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'auditVotes');
      }
    );

    return () => {
      unsubTickets();
      unsubVotes();
    };
  }, [activeUid]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const confirmTicket = useCallback(
    (ticketId: string, mergeDuplicate = false): boolean => {
      if (confirmedTicketIds.includes(ticketId)) {
        return false;
      }

      const target = tickets.find((t) => t.id === ticketId);
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

      if (activeUid && target && target.authorUid === activeUid && target.status !== 'verified') {
        const safeTicketId = sanitizeFirestoreId(ticketId);
        const ticketRef = doc(db, 'tickets', safeTicketId);
        void updateDoc(ticketRef, {
          confirmations: target.confirmations + 1,
          duplicatesMerged: mergeDuplicate
            ? target.duplicatesMerged + 1
            : target.duplicatesMerged,
          updatedAt: serverTimestamp(),
        }).catch((error) => {
          const notice = formatFirestoreQuotaNotice(
            error instanceof Error ? error.message : String(error)
          );
          if (notice !== (error instanceof Error ? error.message : String(error))) {
            setSyncNotice(notice);
            return;
          }
          handleFirestoreError(error, OperationType.UPDATE, `tickets/${safeTicketId}`);
        });
      }

      return true;
    },
    [activeUid, confirmedTicketIds, tickets]
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

      const resolvedLat = input.lat ?? locality.lat;
      const resolvedLng = input.lng ?? locality.lng;

      const cleanTitle = input.title.trim().slice(0, BLUEPRINT_LIMITS.ticketTitleMaxLength);
      const cleanDesc = input.description
        .trim()
        .slice(0, BLUEPRINT_LIMITS.ticketDescriptionMaxLength);
      const trimmedStreet = input.streetAddress.trim();
      const cleanStreet = (
        trimmedStreet.length >= 2 ? trimmedStreet : `${locality.name}, ${locality.prabhag}`
      ).slice(0, BLUEPRINT_LIMITS.streetAddressMaxLength);

      const newTicket: CivicTicket = {
        id: newId,
        authorUid: activeUid ?? undefined,
        title: cleanTitle,
        description: cleanDesc,
        category: input.category,
        localityId: locality.id,
        localityName: locality.name,
        wardNumber: locality.wardNumber,
        prabhag: locality.prabhag,
        streetAddress: cleanStreet,
        lat: resolvedLat,
        lng: resolvedLng,
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
        assignedOfficer: `Ward ${locality.wardNumber} Duty Officer (${locality.prabhag})`.slice(
          0,
          BLUEPRINT_LIMITS.officerMaxLength
        ),
        escalationOfficer: 'Deputy Municipal Commissioner (Civic Works)'.slice(
          0,
          BLUEPRINT_LIMITS.officerMaxLength
        ),
        auditTrail: [
          {
            stage: 'Logged',
            timestampIso: new Date(createdAtMs).toISOString(),
            actor: input.phone ? `Citizen SMS Verified (${input.phone.slice(-4)})` : 'Citizen Geo-Report',
            note: `EXIF coordinates (${resolvedLat.toFixed(4)}, ${resolvedLng.toFixed(4)}) locked.`,
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

      if (activeUid) {
        const safeTicketId = sanitizeFirestoreId(newId);
        const ticketRef = doc(db, 'tickets', safeTicketId);
        // Strip PII (SMS phone) & undefined fields; match firestore.rules exact schema
        const firestoreAuditTrail = newTicket.auditTrail
          .slice(0, BLUEPRINT_LIMITS.auditTrailMaxItems)
          .map((ev, index) =>
            index === 0
              ? {
                  ...ev,
                  actor: 'Citizen Signed-In Report',
                }
              : ev
          );

        const firestorePayload: Record<string, unknown> = {
          id: safeTicketId,
          authorUid: activeUid,
          title: newTicket.title,
          description: newTicket.description,
          category: newTicket.category,
          localityId: sanitizeFirestoreId(newTicket.localityId),
          localityName: newTicket.localityName.slice(0, 120),
          wardNumber: Math.round(newTicket.wardNumber),
          prabhag: newTicket.prabhag,
          streetAddress: newTicket.streetAddress,
          lat: newTicket.lat,
          lng: newTicket.lng,
          mapX: newTicket.mapX,
          mapY: newTicket.mapY,
          status: 'open',
          createdAtMs: newTicket.createdAtMs,
          slaHours: newTicket.slaHours,
          inspectionWindowHours: newTicket.inspectionWindowHours,
          nearCriticalZone: Boolean(newTicket.nearCriticalZone),
          confirmations: 1,
          duplicatesMerged: 0,
          assignedOfficer: newTicket.assignedOfficer,
          escalationOfficer: newTicket.escalationOfficer,
          auditTrail: firestoreAuditTrail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (newTicket.criticalZoneNote && newTicket.criticalZoneNote.trim().length > 0) {
          firestorePayload.criticalZoneNote = newTicket.criticalZoneNote
            .trim()
            .slice(0, BLUEPRINT_LIMITS.criticalZoneNoteMaxLength);
        }

        void setDoc(ticketRef, firestorePayload).catch((error) => {
          const notice = formatFirestoreQuotaNotice(
            error instanceof Error ? error.message : String(error)
          );
          if (notice !== (error instanceof Error ? error.message : String(error))) {
            setSyncNotice(notice);
            return;
          }
          handleFirestoreError(error, OperationType.CREATE, `tickets/${safeTicketId}`);
        });
      }

      return newTicket;
    },
    [activeUid, tickets]
  );

  const voteAuditCase = useCallback(
    (ticketId: string, vote: 'verify' | 'reopen') => {
      const previousVote = auditVotes[ticketId];
      if (previousVote === vote) return;

      const targetTicket = tickets.find((t) => t.id === ticketId);

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

      if (activeUid) {
        const safeTicketId = sanitizeFirestoreId(ticketId);
        const voteId = sanitizeFirestoreId(`${activeUid}_${safeTicketId}`);
        const voteRef = doc(db, 'auditVotes', voteId);

        const persistVote = syncedVoteIdsRef.current.has(voteId)
          ? updateDoc(voteRef, {
              vote,
              updatedAt: serverTimestamp(),
            })
          : setDoc(voteRef, {
              id: voteId,
              userId: activeUid,
              ticketId: safeTicketId,
              vote,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

        void persistVote
          .then(() => {
            syncedVoteIdsRef.current.add(voteId);
          })
          .catch((error) => {
            const notice = formatFirestoreQuotaNotice(
              error instanceof Error ? error.message : String(error)
            );
            if (notice !== (error instanceof Error ? error.message : String(error))) {
              setSyncNotice(notice);
              return;
            }
            handleFirestoreError(error, OperationType.WRITE, `auditVotes/${voteId}`);
          });

        if (
          vote === 'reopen' &&
          targetTicket &&
          targetTicket.authorUid === activeUid &&
          targetTicket.status !== 'verified'
        ) {
          const ticketRef = doc(db, 'tickets', safeTicketId);
          void updateDoc(ticketRef, {
            status: 'escalated',
            updatedAt: serverTimestamp(),
          }).catch((error) => {
            handleFirestoreError(error, OperationType.UPDATE, `tickets/${safeTicketId}`);
          });
        }
      }
    },
    [activeUid, auditVotes, tickets]
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
    syncNotice,
    clearSyncNotice: () => setSyncNotice(null),
    isCloudSynced: Boolean(activeUid),
  };
}
