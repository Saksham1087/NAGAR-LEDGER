import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { TranslationBundle } from '../data/translations';

interface HeaderProps {
  t: TranslationBundle;
  currentPath: string;
  scrollProgress: number;
  onNavigate: (path: string, anchorId?: string) => void;
  onOpenReport: () => void;
}

export function Header({
  t,
  currentPath,
  scrollProgress,
  onNavigate,
  onOpenReport,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string, anchor?: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(path, anchor);
  };

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <a
            href="/"
            className="brand-wordmark"
            onClick={(e) => handleLinkClick(e, '/')}
          >
            NAGAR-LEDGER
          </a>

          <nav className="primary-nav" aria-label="Primary navigation">
            <a
              href="/#live-ledger"
              className={`nav-link ${currentPath === '/' ? 'is-active' : ''}`}
              aria-current={currentPath === '/' ? 'page' : undefined}
              onClick={(e) => handleLinkClick(e, '/', 'live-ledger')}
            >
              {t.nav.ledger}
            </a>
            <a
              href="/#priority-engine"
              className="nav-link"
              onClick={(e) => handleLinkClick(e, '/', 'priority-engine')}
            >
              {t.nav.priority}
            </a>
            <a
              href="/wards"
              className={`nav-link ${currentPath === '/wards' ? 'is-active' : ''}`}
              aria-current={currentPath === '/wards' ? 'page' : undefined}
              onClick={(e) => handleLinkClick(e, '/wards', 'ward-scorecard')}
            >
              {t.nav.wards}
            </a>
            <a
              href="/#citizen-audit"
              className="nav-link"
              onClick={(e) => handleLinkClick(e, '/', 'citizen-audit')}
            >
              {t.nav.audit}
            </a>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn--primary btn--sm header-cta"
              onClick={onOpenReport}
            >
              {t.nav.reportCta}
            </button>

            <button
              ref={menuBtnRef}
              type="button"
              className="menu-toggle"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="scroll-progress"
          style={{ width: `${Math.round(scrollProgress * 100)}%` }}
          aria-hidden="true"
        />
      </header>

      {mobileMenuOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMobileMenuOpen(false);
              menuBtnRef.current?.focus();
            }
          }}
        >
          <div
            id="mobile-nav-drawer"
            className="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                }}
              >
                <span className="brand-wordmark">NAGAR-LEDGER</span>
                <button
                  ref={closeBtnRef}
                  type="button"
                  className="drawer-close-btn"
                  aria-label="Close navigation menu"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    menuBtnRef.current?.focus();
                  }}
                >
                  <X size={20} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>

              <nav className="mobile-nav-links" aria-label="Mobile links">
                <a
                  href="/#live-ledger"
                  className="mobile-nav-link"
                  onClick={(e) => handleLinkClick(e, '/', 'live-ledger')}
                >
                  <span>{t.nav.ledger}</span>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    01
                  </span>
                </a>
                <a
                  href="/#priority-engine"
                  className="mobile-nav-link"
                  onClick={(e) => handleLinkClick(e, '/', 'priority-engine')}
                >
                  <span>{t.nav.priority}</span>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    02
                  </span>
                </a>
                <a
                  href="/#citizen-audit"
                  className="mobile-nav-link"
                  onClick={(e) => handleLinkClick(e, '/', 'citizen-audit')}
                >
                  <span>{t.nav.audit}</span>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    03
                  </span>
                </a>
                <a
                  href="/wards"
                  className="mobile-nav-link"
                  onClick={(e) => handleLinkClick(e, '/wards', 'ward-scorecard')}
                >
                  <span>{t.nav.wards}</span>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    04
                  </span>
                </a>
              </nav>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              style={{ width: '100%' }}
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenReport();
              }}
            >
              {t.nav.reportCta}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
