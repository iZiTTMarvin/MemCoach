import { useNavigate } from "react-router-dom";
import { ArrowLeft, Terminal } from "lucide-react";

/**
 * 认证页面共享布局
 *
 * 提供统一的深色科幻终端风格背景、Logo 区域和返回首页导航，
 * 供 Login / Register / ForgotPassword / VerifyEmail 等认证页面复用。
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - 页面主体内容
 * @param {string} [props.title] - 页面标题
 * @param {string} [props.subtitle] - 页面副标题
 */
export default function AuthLayout({ children, title, subtitle }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* 背景网格 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98108_1px,transparent_1px),linear-gradient(to_bottom,#10b98108_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* 顶部辉光 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px]
                      bg-gradient-to-b from-primary/10 to-transparent rounded-full blur-[100px] pointer-events-none" />

      {/* 底部辉光 */}
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px]
                      bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      {/* 扫描线动画 */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent h-[30%] animate-[scanline_4s_linear_infinite] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* 返回首页 */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-dim hover:text-primary transition-colors mb-8 font-mono"
        >
          <ArrowLeft size={16} />
          返回首页
        </button>

        {/* Logo 与标题 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-none border border-primary/40 bg-card/60 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/20" />
            <Terminal size={22} className="text-primary relative z-10" />
          </div>
          <div>
            {title && (
              <h1 className="text-xl font-display font-bold text-text tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-dim">{subtitle}</p>
            )}
          </div>
        </div>

        {/* 页面主体 */}
        {children}

        {/* 底部品牌 */}
        <div className="mt-10 pt-6 border-t border-border/30 text-center">
          <p className="text-xs font-mono text-dim/50 tracking-widest uppercase">
            MemCoach // 安全加密信道
          </p>
        </div>
      </div>
    </div>
  );
}
