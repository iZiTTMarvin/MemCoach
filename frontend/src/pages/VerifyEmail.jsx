import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import AuthLayout from "../components/AuthLayout";

/**
 * 邮箱验证占位页 — /verify-email
 *
 * 本次版本不接入真实的邮箱验证闭环，
 * 但提供可进入的占位页，包含状态说明和返回路径。
 * 后续可在此基础上接入真实的邮箱验证逻辑（如 token 校验）。
 */
export default function VerifyEmail() {
  return (
    <AuthLayout title="邮箱验证" subtitle="确认你的邮箱地址">
      <div className="text-center py-6">
        {/* 图标 */}
        <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 border border-primary/30 flex items-center justify-center">
          <ShieldCheck size={28} className="text-primary" />
        </div>

        <h2 className="text-lg font-display font-semibold text-text mb-3">
          功能建设中
        </h2>

        {/* 状态说明 */}
        <div className="flex items-start gap-3 px-3 py-3 rounded-none bg-primary/5 border border-primary/20 mb-6 text-left">
          <ShieldAlert size={18} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-dim leading-relaxed">
            邮箱验证功能正在开发中。当前版本<span className="text-primary font-medium">无需验证邮箱</span>即可正常使用所有功能。
            待此功能上线后，你将收到验证邮件来确认账号安全。
          </p>
        </div>

        <p className="text-sm text-dim mb-2">
          你可以继续使用系统的全部功能。
        </p>
        <p className="text-xs text-dim/50 font-mono">
          邮箱验证能力将在后续版本中开放。
        </p>
      </div>

      {/* 返回登录 */}
      <div className="mt-6 pt-5 border-t border-border/30 flex flex-col items-center gap-3">
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition-colors font-mono"
        >
          <ArrowLeft size={14} />
          返回登录
        </Link>
        <Link
          to="/"
          className="text-xs text-dim hover:text-text transition-colors font-mono"
        >
          前往首页
        </Link>
      </div>
    </AuthLayout>
  );
}
