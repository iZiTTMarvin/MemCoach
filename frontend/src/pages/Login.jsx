import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [allowReg, setAllowReg] = useState(null); // null = loading
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((d) => setAllowReg(d.allow_registration))
      .catch(() => setAllowReg(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (isRegister && password.length < 6) {
      setError("密码至少 6 个字符");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister ? { email, password, name } : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "操作失败");
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

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative">
      {/* Subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px]
                      bg-gradient-to-b from-accent/8 to-transparent rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Back to landing */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-dim hover:text-text transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          返回首页
        </button>

        {/* Logo & title */}
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="TechSpar" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="text-xl font-display font-bold text-text">
              {isRegister ? "创建账号" : "欢迎回来"}
            </h1>
            <p className="text-sm text-dim">
              {isRegister ? "注册后开始你的面试训练" : "登录继续你的面试训练"}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm text-dim mb-1.5">昵称</label>
              <input
                type="text"
                placeholder="你的称呼（选填）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-text text-sm
                           focus:outline-none focus:border-accent transition-colors placeholder:text-dim/50"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-dim mb-1.5">邮箱</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-text text-sm
                         focus:outline-none focus:border-accent transition-colors placeholder:text-dim/50"
            />
          </div>

          <div>
            <label className="block text-sm text-dim mb-1.5">密码</label>
            <input
              type="password"
              placeholder={isRegister ? "至少 6 个字符" : "输入密码"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-text text-sm
                         focus:outline-none focus:border-accent transition-colors placeholder:text-dim/50"
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red/10 border border-red/20 text-red text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-orange text-black
                       font-semibold text-sm hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]
                       transition-all disabled:opacity-50 mt-2"
          >
            {loading ? "处理中..." : isRegister ? "注册" : "登录"}
          </button>
        </form>

        {/* Toggle — only show if registration is allowed */}
        {allowReg && (
          <div className="mt-6 pt-5 border-t border-border text-center">
            <span className="text-sm text-dim">
              {isRegister ? "已有账号？" : "还没有账号？"}
            </span>
            <button
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-sm text-accent font-medium ml-1.5 hover:underline"
            >
              {isRegister ? "去登录" : "注册"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
