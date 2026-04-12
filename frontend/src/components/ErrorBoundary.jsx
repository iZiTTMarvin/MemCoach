import { Component } from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-2xl bg-bg-subtle border border-primary/20 p-8 md:p-10 text-center relative z-10 overflow-hidden font-mono">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-transparent opacity-60" />
          <div className="inline-flex items-center px-3 py-1 border border-red-500/30 bg-red-500/10 text-red-300 text-[11px] tracking-widest uppercase mb-5">
            Frontend Runtime Error
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-text mb-3">页面渲染失败</h1>
          <p className="text-sm text-dim leading-relaxed max-w-xl mx-auto mb-6">
            当前页面触发了前端运行时异常。你可以先重试当前页面，若仍失败，返回首页或历史记录继续操作。
          </p>
          <div className="text-xs text-dim max-w-xl mx-auto text-left break-words border border-border/50 bg-card/50 px-4 py-4 mb-8 leading-relaxed">
            {this.state.error?.message || "未知错误"}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="px-8 py-3 bg-transparent border border-primary/30 text-primary text-[11px] font-bold tracking-widest uppercase hover:bg-primary hover:text-bg transition-colors"
              onClick={() => this.setState({ error: null })}
            >
              重试当前页面
            </button>
            <Link
              to="/history"
              className="px-8 py-3 bg-transparent border border-border/50 text-dim text-[11px] font-bold tracking-widest uppercase hover:border-primary/30 hover:text-text transition-colors"
            >
              查看历史记录
            </Link>
            <Link
              to="/"
              className="px-8 py-3 bg-accent/90 border border-accent text-bg text-[11px] font-bold tracking-widest uppercase hover:opacity-90 transition-opacity"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
