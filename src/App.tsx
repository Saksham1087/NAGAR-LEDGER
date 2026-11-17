import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CitizenAuditSection } from './components/CitizenAuditSection';
import { FaqAndCtaSection } from './components/FaqAndCtaSection';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HeroDispatchMap } from './components/HeroDispatchMap';
import { NotFoundView } from './components/NotFoundView';
import { PriorityEngineSection } from './components/PriorityEngineSection';
import { PublicIssueLedger } from './components/PublicIssueLedger';
import { ReportDrawer } from './components/ReportDrawer';
import { TicketInspectorModal } from './components/TicketInspectorModal';
import { UtilityBar } from './components/UtilityBar';
import { WardScorecardSection } from './components/WardScorecardSection';
import { TRANSLATIONS } from './data/translations';
import { useLedgerStore } from './hooks/useLedgerStore';
import { evaluateTicketSla, getTicketCps } from './utils/ledgerEngine';

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname || '/';
}

export function App() {
  const store = useLedgerStore();
  const t = TRANSLATIONS[store.language];

  const [pathname, setPathname] = useState<string>(() =>
    normalizePath(window.location.pathname)
  );
  const [reportOpen, setReportOpen] = useState<boolean>(
    () => normalizePath(window.location.pathname) === '/report'
  );
  const [reportInitialLocality, setReportInitialLocality] = useState<string | undefined>(
    undefined
  );
  const [inspectedTicketId, setInspectedTicketId] = useState<string | null>(() => {
    const match = normalizePath(window.location.pathname).match(/^\/ticket\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  });
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const onPopState = () => {
      const next = normalizePath(window.location.pathname);
      setPathname(next);
      setReportOpen(next === '/report');
      const match = next.match(/^\/ticket\/([^/]+)$/);
      setInspectedTicketId(match ? decodeURIComponent(match[1]) : null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) {
        setScrollProgress(0);
      } else {
        setScrollProgress(Math.min(1, Math.max(0, window.scrollY / maxScroll)));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const navigate = useCallback((nextPath: string, anchorId?: string) => {
    const clean = normalizePath(nextPath);
    if (window.location.pathname !== clean) {
      window.history.pushState({}, '', clean);
    }
    setPathname(clean);
    setReportOpen(clean === '/report');
    const match = clean.match(/^\/ticket\/([^/]+)$/);
    setInspectedTicketId(match ? decodeURIComponent(match[1]) : null);

    if (anchorId) {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(anchorId);
        el?.scrollIntoView();
      });
    } else if (clean !== '/report' && !match) {
      window.scrollTo({ top: 0 });
    }
  }, []);

  const openReport = useCallback((preselectedLocalityId?: string) => {
    setReportInitialLocality(preselectedLocalityId);
    setInspectedTicketId(null);
    setReportOpen(true);
    if (window.location.pathname !== '/report') {
      window.history.pushState({}, '', '/report');
    }
    setPathname('/report');
  }, []);

  const closeReport = useCallback(() => {
    setReportOpen(false);
    if (window.location.pathname === '/report') {
      window.history.pushState({}, '', '/');
      setPathname('/');
    }
  }, []);

  const openInspector = useCallback((ticketId: string) => {
    setReportOpen(false);
    setInspectedTicketId(ticketId);
    const nextPath = `/ticket/${encodeURIComponent(ticketId)}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPathname(nextPath);
  }, []);

  const closeInspector = useCallback(() => {
    setInspectedTicketId(null);
    if (window.location.pathname.startsWith('/ticket/')) {
      window.history.pushState({}, '', '/');
      setPathname('/');
    }
  }, []);

  const handleConfirmTicket = useCallback(
    (ticketId: string, mergeDuplicate = false) => {
      const added = store.confirmTicket(ticketId, mergeDuplicate);
      if (added) {
        setToastMessage(
          `Confirmed ${ticketId}. Civic Priority Score updated (+3 cluster pts).`
        );
      }
    },
    [store]
  );

  const handleVoteAudit = useCallback(
    (ticketId: string, vote: 'verify' | 'reopen') => {
      store.voteAuditCase(ticketId, vote);
      setToastMessage(
        vote === 'verify'
          ? `Recorded Citizen Verification for ${ticketId}.`
          : `Re-open flag recorded for ${ticketId}. Escalated to Ward Officer.`
      );
    },
    [store]
  );

  const handleExportAllJson = useCallback(() => {
    const payload = store.tickets.map((ticket) => ({
      ...ticket,
      computedCps: getTicketCps(ticket, store.nowMs).totalScore,
      computedSla: evaluateTicketSla(ticket, store.nowMs),
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mbmc-nagar-ledger-all-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [store.tickets, store.nowMs]);

  const inspectedTicket = inspectedTicketId
    ? store.tickets.find((item) => item.id === inspectedTicketId) ?? null
    : null;

  const isTicketRouteMissing =
    pathname.startsWith('/ticket/') && inspectedTicket === null;

  const isKnownRoute =
    pathname === '/' ||
    pathname === '/report' ||
    pathname === '/wards' ||
    (pathname.startsWith('/ticket/') && inspectedTicket !== null);

  useEffect(() => {
    if (pathname === '/wards') {
      document.title = 'Ward Scorecard — NAGAR-LEDGER Mira-Bhayandar';
    } else if (pathname === '/report') {
      document.title = 'Log Issue (30s) — NAGAR-LEDGER Mira-Bhayandar';
    } else if (inspectedTicket) {
      document.title = `${inspectedTicket.id} — NAGAR-LEDGER Mira-Bhayandar`;
    } else if (!isKnownRoute) {
      document.title = '404 Missing Record — NAGAR-LEDGER';
    } else {
      document.title = 'NAGAR-LEDGER — Mira-Bhayandar Civic Issue & SLA Ledger';
    }
  }, [pathname, inspectedTicket, isKnownRoute]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main ledger content
      </a>

      <Header
        t={t}
        currentPath={pathname}
        scrollProgress={scrollProgress}
        onNavigate={navigate}
        onOpenReport={() => openReport()}
      />

      <UtilityBar
        language={store.language}
        onChangeLanguage={store.setLanguage}
        theme={store.theme}
        onToggleTheme={store.toggleTheme}
        nowMs={store.nowMs}
      />

      <main id="main-content" tabIndex={-1}>
        {!isKnownRoute || isTicketRouteMissing ? (
          <NotFoundView
            attemptedPath={pathname}
            onBackHome={() => navigate('/')}
            onOpenReport={() => openReport()}
          />
        ) : pathname === '/wards' ? (
          <>
            <section className="section section--compact">
              <div className="container">
                <span className="hero-kicker">MBMC PRABHAG PERFORMANCE REGISTER</span>
                <h1 style={{ marginTop: '0.4rem' }}>
                  Mira-Bhayandar Ward Accountability Scorecard
                </h1>
                <p className="hero-lead" style={{ marginTop: '0.65rem' }}>
                  Live Mean Time to Resolve (MTTR), statutory SLA compliance rates, and
                  unacknowledged DMC escalations across Wards 1–24.
                </p>
              </div>
            </section>
            <WardScorecardSection tickets={store.tickets} nowMs={store.nowMs} />
            <PublicIssueLedger
              t={t}
              tickets={store.tickets}
              confirmedTicketIds={store.confirmedTicketIds}
              nowMs={store.nowMs}
              onConfirmTicket={(id) => handleConfirmTicket(id)}
              onInspectTicket={openInspector}
              onOpenReport={() => openReport()}
            />
          </>
        ) : (
          <>
            <HeroDispatchMap
              t={t}
              tickets={store.tickets}
              nowMs={store.nowMs}
              onOpenReport={() => openReport()}
              onJumpToLedger={() => navigate('/', 'live-ledger')}
              onInspectTicket={openInspector}
            />

            <PublicIssueLedger
              t={t}
              tickets={store.tickets}
              confirmedTicketIds={store.confirmedTicketIds}
              nowMs={store.nowMs}
              onConfirmTicket={(id) => handleConfirmTicket(id)}
              onInspectTicket={openInspector}
              onOpenReport={() => openReport()}
            />

            <PriorityEngineSection t={t} />

            <CitizenAuditSection
              auditCases={store.auditCases}
              auditVotes={store.auditVotes}
              onVoteAudit={handleVoteAudit}
            />

            <WardScorecardSection tickets={store.tickets} nowMs={store.nowMs} />

            <FaqAndCtaSection
              t={t}
              onOpenReport={(locId) => openReport(locId)}
            />
          </>
        )}
      </main>

      <Footer
        t={t}
        onNavigate={navigate}
        onExportAllJson={handleExportAllJson}
      />

      <ReportDrawer
        open={reportOpen}
        t={t}
        tickets={store.tickets}
        confirmedTicketIds={store.confirmedTicketIds}
        nowMs={store.nowMs}
        initialLocalityId={reportInitialLocality}
        onClose={closeReport}
        onConfirmDuplicate={(id) => handleConfirmTicket(id, true)}
        onCreateTicket={(input) => {
          const created = store.createTicket(input);
          setToastMessage(`Logged ${created.id} into Ward ${created.wardNumber} queue.`);
          return created;
        }}
        onInspectTicket={openInspector}
      />

      <TicketInspectorModal
        ticket={inspectedTicket}
        t={t}
        nowMs={store.nowMs}
        isConfirmed={
          inspectedTicket
            ? store.confirmedTicketIds.includes(inspectedTicket.id)
            : false
        }
        onClose={closeInspector}
        onConfirmTicket={(id) => handleConfirmTicket(id)}
      />

      {toastMessage && (
        <div className="toast-banner" role="status" aria-live="polite">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            style={{
              background: 'none',
              border: 0,
              color: 'inherit',
              padding: '0.25rem',
              display: 'inline-flex',
            }}
          >
            <X size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}

export default App;
