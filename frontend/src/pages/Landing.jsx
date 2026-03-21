import { useNavigate } from "react-router-dom";
import { Sun, Moon, ArrowRight, Brain, Target, Mic, BarChart3, Repeat, BookOpen } from "lucide-react";
import { useState, useEffect } from "react";

export default function Landing() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* ── Nav ── */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="TechSpar" className="w-8 h-8 rounded-lg object-contain" />
          <span className="text-lg font-display font-bold text-text">TechSpar</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="w-9 h-9 rounded-lg bg-hover border border-border flex items-center justify-center transition-all"
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => navigate("/login")}
            className="px-5 py-2 rounded-lg bg-hover border border-border text-sm text-text font-medium
                       hover:bg-accent hover:text-black hover:border-accent transition-all"
          >
            登录
          </button>
        </div>
      </header>

      {/* ── Hero — left text + right terminal ── */}
      <section className="px-6 md:px-10 pt-10 md:pt-16 pb-12 md:pb-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px]
                        bg-gradient-to-b from-accent/10 to-transparent rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-14 relative z-10">
          {/* Left — copy */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20
                            text-accent text-xs font-medium mb-5">
              <Brain size={14} />
              AI-Powered Mock Interview
            </div>

            <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight mb-4">
              <span className="bg-gradient-to-r from-accent-light via-accent to-orange bg-clip-text text-transparent">
                越练越懂你的
              </span>
              <br />
              <span className="text-text">AI 面试教练</span>
            </h1>

            <p className="text-sm md:text-base text-dim leading-relaxed mb-7 max-w-md">
              追踪你的成长轨迹，精准命中薄弱点。基于间隔重复与语义记忆，每一次练习都比上一次更有针对性。
            </p>

            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl
                         bg-gradient-to-r from-accent to-orange text-black font-semibold text-sm
                         hover:shadow-[0_0_24px_rgba(245,158,11,0.25)] transition-all"
            >
              立即开始
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Right — terminal preview */}
          <div className="flex-1 w-full max-w-md">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <div className="w-2.5 h-2.5 rounded-full bg-red/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-accent/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green/80" />
                <span className="text-[11px] text-dim ml-2 font-mono">interview session</span>
              </div>
              <div className="px-4 py-3.5 font-mono text-[13px] space-y-2">
                <div>
                  <span className="text-accent">面试官</span>
                  <span className="text-dim"> &gt; </span>
                  <span className="text-text">请介绍一下你在 RAG 项目中的架构设计</span>
                </div>
                <div>
                  <span className="text-teal">候选人</span>
                  <span className="text-dim"> &gt; </span>
                  <span className="text-dim">我们采用了两阶段检索架构...</span>
                </div>
                <div>
                  <span className="text-accent">评估</span>
                  <span className="text-dim"> &gt; </span>
                  <span className="text-green">7.5/10</span>
                  <span className="text-dim"> — 架构描述清晰，建议补充性能指标</span>
                </div>
                <div className="text-accent animate-pulse-dot inline-block">_</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 md:px-10 pb-12 md:pb-16">
        <div className="max-w-5xl mx-auto">
          {/* Feature pills first */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {[
              { icon: <BarChart3 size={14} />, text: "个性化画像" },
              { icon: <Repeat size={14} />, text: "间隔重复" },
              { icon: <Brain size={14} />, text: "语义记忆" },
            ].map((p) => (
              <div
                key={p.text}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-card border border-border text-[13px] text-dim"
              >
                {p.icon}
                {p.text}
              </div>
            ))}
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <Target size={20} />,
                color: "text-accent bg-accent/12",
                title: "简历模拟面试",
                desc: "AI 读取简历，模拟真实面试官。从自我介绍到项目深挖，完整走一遍。",
              },
              {
                icon: <BookOpen size={20} />,
                color: "text-green bg-green/12",
                title: "专项强化训练",
                desc: "选一个领域集中刷题，AI 根据回答动态调整难度，精准定位薄弱点。",
              },
              {
                icon: <Mic size={20} />,
                color: "text-teal bg-teal/12",
                title: "录音复盘",
                desc: "上传面试录音或粘贴文字，AI 自动转写分析，复盘每一场真实面试。",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-card border border-border rounded-xl px-5 py-5
                           hover:border-accent/30 transition-all"
              >
                <div className={`w-9 h-9 rounded-lg ${f.color} flex items-center justify-center mb-3`}>
                  {f.icon}
                </div>
                <h3 className="text-[15px] font-semibold text-text mb-1.5">{f.title}</h3>
                <p className="text-sm text-dim leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border py-5 text-center text-xs text-dim">
        TechSpar — AI Mock Interview Coach
      </footer>
    </div>
  );
}
