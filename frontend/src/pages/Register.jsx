import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthLayout from "../components/AuthLayout";

/**
 * 注册页 — /register
 *
 * 使用共享 AuthLayout 布局，支持邮箱密码注册。
 * 当注册关闭时自动重定向到登录页，不暴露无效流程。
 * 包含 Google 登录预留（禁用）和登录跳转链接。
 */
export default function Register() {
  const [allowReg, setAllowReg] = useState(null); // null = 加载中
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d) => {
        setAllowReg(d.allow_registration);
        // 注册关闭时优雅重定向到登录页
        if (!d.allow_registration) {
          navigate("/login", { replace: true });
        }
      })
      .catch(() => {
        // 网络错误时不重定向，允许用户看到注册页（提交时自然会报错）
        setAllowReg(true);
      });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("密码至少 6 个字符");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "注册失败，请稍后重试");
      }
      const data = await res.json();
      login(data.token, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // 仅后端明确关闭注册时不渲染（加载中或网络不可达时正常展示）
  if (allowReg === false) return null;

  return (
    <AuthLayout title="创建账号" subtitle="注册后开始你的面试训练">
      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 昵称 */}
        <div>
          <label className="block text-sm text-dim mb-1.5 font-mono">昵称</label>
          <input
            type="text"
            placeholder="你的称呼（选填）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full px-3.5 py-2.5 rounded-none bg-card border border-border text-text text-sm
                       focus:outline-none focus:border-primary focus:shadow-[0_0_8px_rgba(16,185,129,0.15)]
                       transition-all placeholder:text-dim/40 font-mono"
          />
        </div>

        {/* 邮箱 */}
        <div>
          <label className="block text-sm text-dim mb-1.5 font-mono">邮箱</label>
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

        {/* 密码 */}
        <div>
          <label className="block text-sm text-dim mb-1.5 font-mono">密码</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="至少 6 个字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 pr-10 rounded-none bg-card border border-border text-text text-sm
                         focus:outline-none focus:border-primary focus:shadow-[0_0_8px_rgba(16,185,129,0.15)]
                         transition-all placeholder:text-dim/40 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-text transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* 密码强度提示 */}
          {password.length > 0 && password.length < 6 && (
            <p className="mt-1 text-xs text-accent/70 font-mono">
              还需要 {6 - password.length} 个字符
            </p>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="px-3 py-2.5 rounded-none bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* 注册按钮 */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-none bg-primary text-bg font-mono font-bold text-sm tracking-wider
                     hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50
                     relative overflow-hidden group mt-2"
        >
          <span className="absolute inset-0 bg-accent/20 -translate-x-full group-hover:animate-[shimmer_1s_forwards]" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "创建中..." : "建立身份"}
          </span>
        </button>
      </form>

      {/* 分隔线 + Google 预留 */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-xs text-dim/50 font-mono">其他方式</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* Google 登录预留 — 禁用状态 */}
        <button
          disabled
          className="w-full py-2.5 rounded-none bg-card/50 border border-border/50 text-dim/60 text-sm font-mono
                     flex items-center justify-center gap-2 cursor-not-allowed relative"
        >
          <svg className="w-4 h-4 opacity-40" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google 注册
          <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary/60 border border-primary/20">
            即将支持
          </span>
        </button>
      </div>

      {/* 登录链接 */}
      <div className="mt-6 pt-5 border-t border-border/30 text-center">
        <span className="text-sm text-dim">已有账号？</span>
        <Link
          to="/login"
          className="text-sm text-primary font-medium ml-1.5 hover:text-primary-hover transition-colors font-mono"
        >
          去登录
        </Link>
      </div>
    </AuthLayout>
  );
}
