import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Erro na aplicação:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
          <div className="card p-8 max-w-md text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-lg font-bold text-white mb-2">Algo deu errado</h1>
            <p className="text-sm text-gray-400 mb-5 break-words">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="btn-primary"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
