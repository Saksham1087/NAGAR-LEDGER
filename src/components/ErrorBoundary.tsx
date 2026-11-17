import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('NagrikSeva ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      let readableDetail = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error) {
          readableDetail = `${parsed.error}${parsed.path ? ` (${parsed.operationType ?? 'op'} on ${parsed.path})` : ''}`;
        }
      } catch {
        // plain text error message
      }

      return (
        <div
          className="container"
          style={{ paddingBlock: '3rem' }}
          role="alert"
        >
          <div
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '1.5rem',
              maxWidth: '42rem',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--danger)',
              }}
            >
              APPLICATION RECOVERY
            </span>
            <h1 style={{ fontSize: '1.35rem', marginTop: '0.4rem' }}>
              Something interrupted the civic ledger session
            </h1>
            <p
              className="mono"
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginTop: '0.75rem',
                wordBreak: 'break-word',
              }}
            >
              {readableDetail}
            </p>
            <button
              type="button"
              className="btn btn--primary"
              style={{ marginTop: '1.25rem' }}
              onClick={() => window.location.reload()}
            >
              Reload NagrikSeva
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
