import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  confirmReset: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    confirmReset: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, confirmReset: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetData = () => {
    try {
      localStorage.clear();
    } catch (e) {}
    window.location.hash = '';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 antialiased selection:bg-emerald-500 selection:text-white">
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg font-black text-white">
                Rất tiếc, đã có sự cố hiển thị!
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ứng dụng gặp lỗi tạm thời trong quá trình xử lý dữ liệu. Bạn có thể bấm nút bên dưới để khôi phục lại tức thì.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-left text-[11px] font-mono text-rose-300 max-h-28 overflow-y-auto custom-scrollbar leading-tight break-all">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tải lại ứng dụng</span>
              </button>

              {this.state.confirmReset ? (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 space-y-2">
                  <p className="text-xs font-semibold text-rose-200">
                    Xác nhận đặt lại tất cả dữ liệu ứng dụng?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={this.handleResetData}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Đồng ý đặt lại
                    </button>
                    <button
                      onClick={() => this.setState({ confirmReset: false })}
                      className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => this.setState({ confirmReset: true })}
                  className="w-full py-3 rounded-2xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600/50 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Khôi phục dữ liệu mặc định</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
