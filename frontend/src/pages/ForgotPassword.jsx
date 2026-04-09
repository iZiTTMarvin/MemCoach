import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, ShieldAlert } from "lucide-react";
import AuthLayout from "../components/AuthLayout";

/**
 * 忘记密码占位页 — /forgot-password
 *
 * 本次版本不接入真实的密码重置邮件链路，
 * 但提供可进入的占位页，包含状态说明和返回路径。
 * 后续可在此基础上接入真实的邮件发送逻辑。
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // 占位行为：仅展示确认状态，不发送真实邮件
    if (email.trim()) {
      setSubmitted(true);
    }
  }

  return (
    <AuthLayout title="找回密码" subtitle="重置你的账号密码">
      {!submitted ? (
        <>
          {/* 说明 */}
          <div className="flex items-start gap-3 px-3 py-3 rounded-none bg-primary/5 border border-primary/20 mb-6">
            <ShieldAlert size={18} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-dim leading-relaxed">
              此功能正在建设中。输入邮箱后系统将模拟发送流程，但<span className="text-primary font-medium">当前不会发送真实邮件</span>。
              如需重置密码，请联系管理员。
            </p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-dim mb-1.5 font-mono">注册邮箱</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-none bg-card border border-border text-text text-sm
                           focus:outline-none focus:border-primary focus:shadow-[0_0_8px_rgba(16,185,129,0.15)]
                           transition-all placeholder:text-dim/40 font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-none bg-primary/80 text-bg font-mono font-bold text-sm tracking-wider
                         hover:bg-primary hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all
                         relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Mail size={16} />
                发送重置链接
              </span>
            </button>
          </form>
        </>
      ) : (
        /* 提交后的确认状态 */
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Mail size={28} className="text-primary" />
          </div>
          <h2 className="text-lg font-display font-semibold text-text mb-2">
            请求已记录
          </h2>
          <p className="text-sm text-dim leading-relaxed mb-2">
            如果 <span className="text-text font-mono text-xs">{email}</span> 已注册，
            系统将在功能上线后发送重置链接。
          </p>
          <p className="text-xs text-dim/60 mb-6">
            当前版本暂不支持自助密码重置，如需帮助请联系管理员。
          </p>
        </div>
      )}

      {/* 返回登录 */}
      <div className="mt-6 pt-5 border-t border-border/30">
        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors font-mono"
        >
          <ArrowLeft size={14} />
          返回登录
        </Link>
      </div>
    </AuthLayout>
  );
}
