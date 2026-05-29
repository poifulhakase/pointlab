import { Component, type ReactNode, type ErrorInfo } from 'react'
import * as Sentry from '@sentry/react'

type Props = { children: ReactNode; label?: string }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack ?? '', label: this.props.label } })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const label = this.props.label ?? 'このセクション'
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, gap: 12, color: 'var(--text-sub)', textAlign: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,120,100,0.6)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span style={{ fontSize: 13 }}>{label}で問題が発生しました</span>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            padding: '5px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'var(--bg-medium)', border: '1px solid var(--glass-border)',
            color: 'var(--text)', cursor: 'pointer',
          }}
        >
          再試行
        </button>
      </div>
    )
  }
}
