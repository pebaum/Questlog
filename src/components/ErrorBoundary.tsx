import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#1c1c1e',
          color: '#e0e0e0',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 32,
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
            Something went wrong
          </h2>
          <pre style={{
            background: '#222224',
            border: '1px solid #333336',
            borderRadius: 6,
            padding: '12px 16px',
            fontSize: 12,
            color: '#d47070',
            maxWidth: 480,
            width: '100%',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginBottom: 20,
          }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '6px 16px',
              background: '#28282a',
              border: '1px solid #4a7aab',
              borderRadius: 4,
              color: '#6ea8e0',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
