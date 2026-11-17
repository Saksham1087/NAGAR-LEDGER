import { Moon, Sun } from 'lucide-react';
import type { LanguageCode, ThemeMode } from '../types/civic';

interface UtilityBarProps {
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  nowMs: number;
}

export function UtilityBar({
  language,
  onChangeLanguage,
  theme,
  onToggleTheme,
  nowMs,
}: UtilityBarProps) {
  const istTime = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(nowMs));

  return (
    <div className="utility-bar" role="region" aria-label="Display and language controls">
      <div className="container utility-bar__inner">
        <div className="utility-bar__meta">
          <span>MBMC PUBLIC WORKS</span>
          <span aria-hidden="true">·</span>
          <span>WARDS 1–24</span>
          <span aria-hidden="true">·</span>
          <span className="tabular">{istTime} IST</span>
        </div>

        <div className="utility-bar__controls">
          <div className="segmented-control" role="group" aria-label="Interface language">
            <button
              type="button"
              className="segmented-control__btn"
              aria-pressed={language === 'en'}
              onClick={() => onChangeLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              className="segmented-control__btn"
              aria-pressed={language === 'mr'}
              onClick={() => onChangeLanguage('mr')}
            >
              मराठी
            </button>
            <button
              type="button"
              className="segmented-control__btn"
              aria-pressed={language === 'hi'}
              onClick={() => onChangeLanguage('hi')}
            >
              हिंदी
            </button>
          </div>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? (
              <Moon size={14} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Sun size={14} strokeWidth={1.5} aria-hidden="true" />
            )}
            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
