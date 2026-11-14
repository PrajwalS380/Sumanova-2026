import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[sumanova] UI error', error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-full place-items-center bg-noir p-6 text-center">
        <div className="glass max-w-sm rounded-4xl p-8">
          <p className="font-display text-lg">Something glitched</p>
          <p className="mt-2 text-sm text-ink-mute">The screen hit an unexpected error. Your data is safe.</p>
          <button
            className="mt-6 h-12 w-full rounded-2xl bg-ember-gradient text-noir font-semibold"
            onClick={() => {
              this.setState({ error: null });
              location.reload();
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
