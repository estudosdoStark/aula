import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsedMessage = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        parsedMessage = `${parsed.error} (${parsed.operationType || 'operação'} em ${parsed.path || 'banco'})`;
      }
    } catch {
      // Keep original message
    }
    return {
      hasError: true,
      errorMessage: parsedMessage,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-xl border border-crimson-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-crimson-50 text-crimson-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="font-display font-extrabold text-xl text-navy-900">
              Ops! Ocorreu um erro de permissão ou conexão
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 break-words">
              {this.state.errorMessage || 'Não foi possível concluir a operação solicitada.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-bold transition"
            >
              <RotateCcw className="w-4 h-4 text-crimson-400" />
              Recarregar Mural
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
