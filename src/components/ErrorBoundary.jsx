import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--bg)] p-6 text-center z-[200]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-[var(--fg)]">Yah, ada yang error nih! 😭</h2>
          <p className="mb-4 text-sm text-[var(--muted)] max-w-md">
            Mungkin fitur ini (Database/Penyimpanan Lokal) sedang diblokir oleh browser ponselmu, atau ada bug lain.
          </p>
          <div className="w-full max-w-md overflow-auto rounded-lg bg-[var(--panel-strong)] p-4 text-left text-xs text-red-400 font-mono shadow-inner border border-red-500/20">
            <p className="font-bold mb-2 break-all">
              {typeof this.state.error === 'object' && this.state.error !== null
                ? this.state.error.message || JSON.stringify(this.state.error)
                : String(this.state.error || 'Unknown error')}
            </p>
            <p className="whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 rounded-full bg-[var(--fg)] px-6 py-2.5 text-sm font-bold text-[var(--bg)] shadow-md active:scale-95 transition"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}
