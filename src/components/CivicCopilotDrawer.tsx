import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ExternalLink,
  Globe,
  Loader2,
  LogIn,
  Mic,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  X,
  Zap,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  OperationType,
  db,
  formatFirestoreQuotaNotice,
  handleFirestoreError,
  sanitizeFirestoreId,
} from '../firebase';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import type {
  CivicTicket,
  CopilotMessage,
  CopilotMode,
  GroundingSource,
  LanguageCode,
} from '../types/civic';
import { evaluateTicketSla, getTicketCps } from '../utils/ledgerEngine';

interface CivicCopilotDrawerProps {
  open: boolean;
  language: LanguageCode;
  tickets: CivicTicket[];
  nowMs: number;
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  onClose: () => void;
  onSignInWithGoogle: () => void;
}

const MODE_OPTIONS: Array<{
  id: CopilotMode;
  label: string;
  hint: string;
}> = [
  { id: 'fast', label: 'Fast', hint: 'gemini-3.1-flash-lite' },
  { id: 'search', label: 'Web Search', hint: 'gemini-4-hydrogen + Google Search' },
  { id: 'deep', label: 'Deep SLA', hint: 'gemini-4-hydrogen High Thinking' },
];

const STARTER_PROMPTS = [
  'Which Mira-Bhayandar wards currently have overdue SLA breaches?',
  'Latest Mira-Bhayandar Municipal Corporation (MBMC) civic updates and monsoon advisories',
  'How is Civic Priority Score (CPS) calculated for a school zone water leak?',
  'What are MBMC official helpline numbers and DMC escalation steps?',
];

function createLocalId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

function isSafeHttpUrl(uri: string): boolean {
  return uri.startsWith('https://') || uri.startsWith('http://');
}

function renderFormattedInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={idx} className="mono" style={{ fontSize: '0.85em' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function buildLedgerContextSummary(tickets: CivicTicket[], nowMs: number): string {
  const active = tickets
    .map((ticket) => ({
      ticket,
      cps: getTicketCps(ticket, nowMs).totalScore,
      sla: evaluateTicketSla(ticket, nowMs),
    }))
    .sort((a, b) => b.cps - a.cps);

  const openCount = active.filter(
    (item) =>
      item.sla.effectiveStatus !== 'verified' &&
      item.sla.effectiveStatus !== 'awaiting_audit'
  ).length;
  const escalatedCount = active.filter(
    (item) => item.sla.effectiveStatus === 'escalated'
  ).length;

  const topLines = active.slice(0, 6).map(
    ({ ticket, cps, sla }) =>
      `- ${ticket.id} | Ward ${ticket.wardNumber} (${ticket.localityName}) | ${ticket.category} | CPS ${cps}/100 | ${sla.effectiveStatus} (${sla.formattedCountdown}): ${ticket.title}`
  );

  return [
    `Tracked Tickets: ${tickets.length} | Active Open: ${openCount} | DMC Escalated: ${escalatedCount}`,
    ...topLines,
  ].join('\n');
}

export function CivicCopilotDrawer({
  open,
  language,
  tickets,
  nowMs,
  user,
  authReady,
  signingIn,
  onClose,
  onSignInWithGoogle,
}: CivicCopilotDrawerProps) {
  const [mode, setMode] = useState<CopilotMode>('fast');
  const [sessionId, setSessionId] = useState<string>(() => createLocalId('sess'));
  const [sessionCommitted, setSessionCommitted] = useState<boolean>(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [draft, setDraft] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const isCloudUser = Boolean(authReady && user && user.emailVerified);
  const activeUid = isCloudUser && user ? sanitizeFirestoreId(user.uid) : null;

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
  }, []);

  const voice = useVoiceRecorder({
    language,
    purpose: 'chat',
    onTranscript: handleVoiceTranscript,
  });

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

  useEffect(() => {
    if (!open) return;
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending, open]);

  // Load latest persisted chat session & messages when signed in
  useEffect(() => {
    if (!activeUid) {
      setSessionCommitted(false);
      return;
    }

    let cancelled = false;

    const loadLatestSession = async () => {
      setLoadingHistory(true);
      setChatError(null);
      try {
        const sessionsQ = query(
          collection(db, 'chatSessions'),
          where('ownerUid', '==', activeUid)
        );
        const sessionsSnap = await getDocs(sessionsQ);
        if (cancelled || sessionsSnap.empty) {
          setLoadingHistory(false);
          return;
        }

        const parsedSessions = sessionsSnap.docs.map((docSnap) => {
          const data = docSnap.data() as {
            id?: string;
            mode?: CopilotMode;
            updatedAt?: { toMillis?: () => number };
          };
          return {
            id: docSnap.id,
            mode:
              data.mode === 'fast' || data.mode === 'deep' ? data.mode : ('search' as CopilotMode),
            updatedMs: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0,
          };
        });
        parsedSessions.sort((a, b) => b.updatedMs - a.updatedMs);
        const latest = parsedSessions[0];

        const msgsQ = query(
          collection(db, 'chatSessions', latest.id, 'messages'),
          where('ownerUid', '==', activeUid)
        );
        const msgsSnap = await getDocs(msgsQ);
        if (cancelled) return;

        const loadedMsgs: CopilotMessage[] = msgsSnap.docs.map((docSnap) => {
          const data = docSnap.data() as {
            id?: string;
            role?: 'user' | 'model';
            text?: string;
            modelUsed?: string;
            groundingSources?: GroundingSource[];
            createdAt?: { toMillis?: () => number };
          };
          return {
            id: String(data.id ?? docSnap.id),
            role: data.role === 'model' ? 'model' : 'user',
            text: String(data.text ?? ''),
            modelUsed: typeof data.modelUsed === 'string' ? data.modelUsed : undefined,
            groundingSources: Array.isArray(data.groundingSources)
              ? data.groundingSources.filter(
                  (s) =>
                    Boolean(s) &&
                    typeof s.uri === 'string' &&
                    isSafeHttpUrl(s.uri)
                )
              : undefined,
            createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
          };
        });
        loadedMsgs.sort((a, b) => a.createdAtMs - b.createdAtMs);

        setSessionId(latest.id);
        setMode(latest.mode);
        setSessionCommitted(true);
        if (loadedMsgs.length > 0) {
          setMessages(loadedMsgs);
        }
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : String(error);
        const notice = formatFirestoreQuotaNotice(msg);
        if (notice !== msg) {
          setChatError(notice);
        } else {
          handleFirestoreError(error, OperationType.LIST, 'chatSessions');
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    void loadLatestSession();
    return () => {
      cancelled = true;
    };
  }, [activeUid]);

  const ledgerContext = useMemo(
    () => buildLedgerContextSummary(tickets, nowMs),
    [tickets, nowMs]
  );

  const startNewChat = () => {
    setSessionId(createLocalId('sess'));
    setSessionCommitted(false);
    setMessages([]);
    setChatError(null);
  };

  const persistMessageToFirestore = async (
    targetSessionId: string,
    sessionTitle: string,
    selectedMode: CopilotMode,
    msg: CopilotMessage,
    alreadyCommitted: boolean
  ): Promise<boolean> => {
    if (!activeUid) return false;
    const safeSessionId = sanitizeFirestoreId(targetSessionId);
    const safeMsgId = sanitizeFirestoreId(msg.id);
    const sessionRef = doc(db, 'chatSessions', safeSessionId);
    const msgRef = doc(db, 'chatSessions', safeSessionId, 'messages', safeMsgId);

    // Ensure parent chatSessions document exists BEFORE message creation (Master Gate rule)
    if (!alreadyCommitted) {
      try {
        await setDoc(sessionRef, {
          id: safeSessionId,
          ownerUid: activeUid,
          title: (sessionTitle.trim() || 'Civic Inquiry').slice(0, BLUEPRINT_LIMITS.chatTitleMaxLength),
          mode: selectedMode,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const notice = formatFirestoreQuotaNotice(raw);
        if (notice !== raw) {
          setChatError(notice);
          return false;
        }
        handleFirestoreError(error, OperationType.CREATE, `chatSessions/${safeSessionId}`);
      }
    } else {
      try {
        await updateDoc(sessionRef, {
          mode: selectedMode,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const notice = formatFirestoreQuotaNotice(raw);
        if (notice !== raw) {
          setChatError(notice);
          return true;
        }
        handleFirestoreError(error, OperationType.UPDATE, `chatSessions/${safeSessionId}`);
      }
    }

    const cleanSources = (msg.groundingSources ?? [])
      .filter((s) => Boolean(s?.uri) && isSafeHttpUrl(s.uri))
      .slice(0, BLUEPRINT_LIMITS.groundingSourcesMaxItems)
      .map((s) => ({
        title: String(s.title || s.uri).slice(0, 160),
        uri: String(s.uri).slice(0, 512),
      }));

    const msgPayload: Record<string, unknown> = {
      id: safeMsgId,
      sessionId: safeSessionId,
      ownerUid: activeUid,
      role: msg.role,
      text: msg.text.slice(0, BLUEPRINT_LIMITS.chatMessageMaxLength),
      createdAt: serverTimestamp(),
    };

    if (msg.modelUsed) {
      msgPayload.modelUsed = msg.modelUsed.slice(0, BLUEPRINT_LIMITS.modelUsedMaxLength);
    }
    if (cleanSources.length > 0) {
      msgPayload.groundingSources = cleanSources;
    }

    try {
      await setDoc(msgRef, msgPayload);
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const notice = formatFirestoreQuotaNotice(raw);
      if (notice !== raw) {
        setChatError(notice);
        return true;
      }
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `chatSessions/${safeSessionId}/messages/${safeMsgId}`
      );
    }

    return true;
  };

  const sendMessage = async (textOverride?: string) => {
    const content = (textOverride ?? draft).trim();
    if (!content || sending) return;

    setChatError(null);
    voice.clearError();
    if (!textOverride) setDraft('');

    const userMsg: CopilotMessage = {
      id: createLocalId('u'),
      role: 'user',
      text: content.slice(0, BLUEPRINT_LIMITS.chatMessageMaxLength),
      createdAtMs: Date.now(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setSending(true);

    let committed = sessionCommitted;
    if (activeUid) {
      const ok = await persistMessageToFirestore(
        sessionId,
        content,
        mode,
        userMsg,
        committed
      );
      if (ok) {
        committed = true;
        setSessionCommitted(true);
      }
    }

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map((m) => ({ role: m.role, text: m.text })),
          mode,
          language,
          contextSummary: ledgerContext,
        }),
      });

      const payload = (await response.json()) as {
        reply?: string;
        modelUsed?: string;
        groundingSources?: GroundingSource[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to reach NagrikSeva Civic Copilot.');
      }

      const modelMsg: CopilotMessage = {
        id: createLocalId('m'),
        role: 'model',
        text: (payload.reply || '').trim() || 'No answer returned. Please rephrase your question.',
        modelUsed: payload.modelUsed,
        groundingSources: Array.isArray(payload.groundingSources)
          ? payload.groundingSources.filter((s) => Boolean(s?.uri) && isSafeHttpUrl(s.uri))
          : [],
        createdAtMs: Date.now(),
      };

      setMessages((prev) => [...prev, modelMsg]);

      if (activeUid) {
        await persistMessageToFirestore(
          sessionId,
          content,
          mode,
          modelMsg,
          committed
        );
      }
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : 'Network error communicating with Civic Copilot.'
      );
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="drawer-panel copilot-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-drawer-title"
      >
        <div className="drawer-header">
          <div>
            <span
              className="mono"
              style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}
            >
              MIRA-BHAYANDAR CIVIC INTELLIGENCE · LIVE LEDGER + WEB SEARCH
            </span>
            <h2 id="copilot-drawer-title" style={{ fontSize: '1.2rem', marginTop: '0.15rem' }}>
              NagrikSeva Civic Copilot
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {messages.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={startNewChat}
                disabled={sending}
              >
                <Plus size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>New Chat</span>
              </button>
            )}
            <button
              ref={closeBtnRef}
              type="button"
              className="drawer-close-btn"
              aria-label="Close Civic Copilot drawer"
              onClick={onClose}
            >
              <X size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mode Selector & Cloud Sync Strip */}
        <div className="copilot-toolbar">
          <div className="copilot-modes" role="group" aria-label="Copilot response mode">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="copilot-mode-btn"
                aria-pressed={mode === opt.id}
                title={opt.hint}
                onClick={() => setMode(opt.id)}
              >
                {opt.id === 'search' && <Globe size={13} strokeWidth={1.6} aria-hidden="true" />}
                {opt.id === 'fast' && <Zap size={13} strokeWidth={1.6} aria-hidden="true" />}
                {opt.id === 'deep' && <Sparkles size={13} strokeWidth={1.6} aria-hidden="true" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {isCloudUser ? (
            <span className="copilot-sync-pill is-synced">
              <ShieldCheck size={13} strokeWidth={1.7} aria-hidden="true" />
              <span>Synced to Cloud</span>
            </span>
          ) : (
            <button
              type="button"
              className="copilot-sync-pill"
              onClick={onSignInWithGoogle}
              disabled={signingIn}
            >
              <LogIn size={13} strokeWidth={1.7} aria-hidden="true" />
              <span>{signingIn ? 'Signing in...' : 'Sign in to sync chats'}</span>
            </button>
          )}
        </div>

        {/* Scrollable Multi-turn Message Thread */}
        <div className="copilot-thread" aria-live="polite">
          {loadingHistory ? (
            <div className="copilot-empty-state">
              <Loader2 size={20} className="spin-icon" aria-hidden="true" />
              <p className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Loading saved session from Firestore...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="copilot-empty-state">
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Ask about Ward 1–24 SLA clocks, CPS priority scoring, or live MBMC civic news.
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Web Search mode grounds answers with live Google Search citations. Tap the
                microphone below to dictate in English, Marathi, or Hindi.
              </p>

              <div className="copilot-starters">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="copilot-starter-btn"
                    onClick={() => void sendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`copilot-msg ${msg.role === 'user' ? 'copilot-msg--user' : 'copilot-msg--model'}`}
              >
                <div className="copilot-msg__meta">
                  <span className="mono">
                    {msg.role === 'user' ? 'CITIZEN QUERY' : 'NAGRIKSEVA COPILOT'}
                  </span>
                  {msg.modelUsed && (
                    <span className="mono copilot-model-tag">{msg.modelUsed}</span>
                  )}
                </div>

                <div className="copilot-msg__body">{renderFormattedInline(msg.text)}</div>

                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="grounding-sources" aria-label="Verified web sources">
                    <div className="grounding-sources__label mono">
                      <Globe size={12} strokeWidth={1.6} aria-hidden="true" />
                      <span>GOOGLE SEARCH GROUNDING SOURCES</span>
                    </div>
                    <ul className="grounding-sources__list">
                      {msg.groundingSources.map((src) => (
                        <li key={src.uri}>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="grounding-source-link"
                          >
                            <span>{src.title || src.uri}</span>
                            <ExternalLink size={12} strokeWidth={1.6} aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="copilot-msg copilot-msg--model">
              <div className="copilot-msg__meta">
                <span className="mono">NAGRIKSEVA COPILOT</span>
              </div>
              <div
                className="mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                <Loader2 size={15} className="spin-icon" aria-hidden="true" />
                <span>
                  {mode === 'search'
                    ? 'Searching civic web sources & analyzing ledger...'
                    : mode === 'deep'
                      ? 'Running deep SLA & CPS reasoning...'
                      : 'Drafting quick response...'}
                </span>
              </div>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* Inline Error Alerts */}
        {(chatError || voice.error) && (
          <div className="copilot-error-banner" role="alert">
            <span>{voice.error || chatError}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              {chatError && mode === 'search' && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setMode('fast');
                    setChatError(null);
                  }}
                >
                  Use Fast Mode
                </button>
              )}
              <button
                type="button"
                className="copilot-error-dismiss"
                aria-label="Dismiss error"
                onClick={() => {
                  setChatError(null);
                  voice.clearError();
                }}
              >
                <X size={14} strokeWidth={1.7} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Composer with Voice Dictation */}
        <form
          className="copilot-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <button
            type="button"
            className={`voice-mic-btn ${voice.isRecording ? 'is-recording' : ''}`}
            onClick={voice.toggleRecording}
            disabled={voice.isTranscribing || sending}
            aria-label={
              voice.isRecording
                ? 'Stop voice recording'
                : voice.isTranscribing
                  ? 'Transcribing audio'
                  : 'Dictate civic question with microphone'
            }
            title={
              voice.isRecording
                ? 'Tap to stop & transcribe'
                : 'Speak in English, Marathi, or Hindi'
            }
          >
            {voice.isTranscribing ? (
              <Loader2 size={17} className="spin-icon" aria-hidden="true" />
            ) : voice.isRecording ? (
              <Square size={15} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Mic size={17} strokeWidth={1.7} aria-hidden="true" />
            )}
          </button>

          <textarea
            className="copilot-input"
            rows={2}
            placeholder={
              voice.isRecording
                ? 'Listening... tap stop when finished speaking'
                : voice.isTranscribing
                  ? 'Transcribing voice via Gemini...'
                  : 'Ask about ward SLAs, CPS, or local MBMC civic updates...'
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />

          <button
            type="submit"
            className="btn btn--primary copilot-send-btn"
            disabled={!draft.trim() || sending || voice.isRecording}
            aria-label="Send message to Civic Copilot"
          >
            <Send size={16} strokeWidth={1.7} aria-hidden="true" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
