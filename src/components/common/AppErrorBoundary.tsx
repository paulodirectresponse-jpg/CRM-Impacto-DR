import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by AppErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    window.location.reload();
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          id="app-error-boundary"
          className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans"
        >
          <div className="bg-slate-900 border border-slate-800 max-w-lg w-full rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {this.props.fallbackTitle || "Ocorreu um erro na interface"}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                A aplicação encontrou um estado inesperado. Os dados salvos no banco de dados Firestore permanecem seguros e intactos.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                id="btn-error-boundary-reload"
                onClick={this.handleReload}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition-all cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar Aplicativo</span>
              </button>

              <button
                type="button"
                onClick={this.toggleDetails}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
              >
                {this.state.showDetails ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>{this.state.showDetails ? "Ocultar Detalhes" : "Ver Detalhes Técnicos"}</span>
              </button>
            </div>

            {this.state.showDetails && (
              <div className="text-left bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto space-y-1">
                <div className="text-rose-400 font-bold">
                  {this.state.error?.name}: {this.state.error?.message}
                </div>
                {this.state.error?.stack && (
                  <pre className="text-slate-500 text-[10px] whitespace-pre-wrap overflow-x-auto">
                    {this.state.error.stack}
                  </pre>
                )}
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-slate-600 text-[10px] whitespace-pre-wrap mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
              CRM Impacto Direct Response • Release Candidate V2.1.2
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
