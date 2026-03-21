import { useNavigate } from "react-router-dom";
import { Sun, Moon, ArrowRight, Terminal, Cpu, Radio, Activity, ShieldAlert, Fingerprint, Target } from "lucide-react";
import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";

export default function Landing() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 80, damping: 20 } }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden text-text selection:bg-primary/30">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98110_1px,transparent_1px),linear-gradient(to_bottom,#10b98110_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* ── Nav ── */}
      <header className="flex items-center justify-between px-6 md:px-12 py-6 relative z-30">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-10 h-10 rounded-none border border-primary/40 bg-card/60 flex items-center justify-center relative overflow-hidden group-hover:border-primary transition-colors">
            <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Terminal size={20} className="text-primary relative z-10" />
          </div>
          <span className="text-xl font-mono font-bold tracking-widest text-text group-hover:text-primary transition-colors">
            MEMCOACH<span className="text-accent animate-pulse">_</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="w-10 h-10 rounded-none bg-transparent border border-border flex items-center justify-center transition-all hover:bg-primary/10 hover:border-primary text-dim hover:text-primary"
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 rounded-none bg-primary/10 border border-primary text-primary font-mono text-sm hover:bg-primary hover:text-bg transition-all tracking-wider relative overflow-hidden group"
          >
            <span className="absolute inset-0 w-full h-full bg-accent/20 -translate-x-full group-hover:animate-[shimmer_1s_forwards]" />
            安全接入
          </button>
        </div>
      </header>

      {/* ── Hero Immersive ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 pt-10 pb-20 relative z-20 text-center">
        <motion.div 
          className="max-w-5xl mx-auto flex flex-col items-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Status Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center gap-3 px-4 py-1.5 border border-border/50 bg-card/30 backdrop-blur-md text-xs font-mono text-dim mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--color-accent)]" />
            系统在线 : 智能面试引擎 V2.0
          </motion.div>

          {/* Main Title */}
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl lg:text-[84px] font-display font-black leading-[1.05] tracking-tight mb-8">
            重构你的 <br />
            <span className="relative inline-block mt-2">
              <span className="absolute -inset-2 bg-primary/20 blur-2xl rounded-full" />
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent">
                实战能力
              </span>
            </span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-dim max-w-2xl font-light mb-12">
            摆脱刻板的题海战术。运用神经语义网络与动态知识图谱，精准扫描你的能力盲区，构建专属的抗压训练场。
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-6">
            <button
              onClick={() => navigate("/login")}
              className="relative group px-8 py-4 bg-primary text-bg font-mono font-bold text-lg tracking-widest overflow-hidden border border-transparent hover:border-accent hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all"
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-no-repeat bg-[position:-100%_0,0_0] group-hover:transition-[background-position_0s_ease] group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1500ms]" />
              <span className="relative z-10 flex items-center gap-3">
                <Fingerprint size={22} />
                建立神经连接
              </span>
              {/* Sci-fi corner cutouts */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-bg" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-bg" />
            </button>

            <button className="px-8 py-4 font-mono text-sm text-dim hover:text-primary transition-colors flex items-center gap-2 group">
              <Activity size={18} className="group-hover:animate-pulse" />
              查看技术规格
            </button>
          </motion.div>
        </motion.div>

        {/* Floating Sci-Fi Terminal Widget */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-16 w-full max-w-4xl relative"
        >
          {/* Decorative glow */}
          <div className="absolute inset-0 bg-primary/10 blur-[80px] rounded-[100%]" />
          
          <div className="relative border border-primary/30 bg-bg-subtle/80 backdrop-blur-xl shadow-2xl overflow-hidden group">
            <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 top-0" />
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-primary/20 bg-primary/5">
              <div className="flex items-center gap-4 text-xs font-mono text-primary/70">
                <span className="flex items-center gap-2"><Cpu size={14}/> 核心节点活动中</span>
                <span className="hidden sm:inline">延迟: 12ms</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-primary/40" />
                <div className="w-2 h-2 bg-primary/60" />
                <div className="w-2 h-2 bg-accent" />
              </div>
            </div>

            {/* Body */}
            <div className="p-6 md:p-8 font-mono text-sm text-left flex flex-col gap-4">
              <div className="flex gap-3">
                <span className="text-primary select-none">&gt;</span>
                <span className="text-dim">正在解析候选人画像... <span className="text-primary">100%</span></span>
              </div>
              <div className="flex gap-3">
                <span className="text-primary select-none">&gt;</span>
                <span className="text-dim">生成自适应抗压场景... <span className="text-accent">就绪</span></span>
              </div>
              <div className="flex gap-3 mt-4">
                <div className="w-10 h-10 shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <ShieldAlert size={20} />
                </div>
                <div className="bg-primary/5 border border-primary/20 p-4 flex-1 text-text leading-relaxed">
                  <span className="text-primary font-bold mb-1 block">面试官节点</span>
                  “我注意到你在项目中使用了 Redis 分布式锁。如果在获取锁后，主节点在同步到从节点之前崩溃，你会如何处理这种情况？”
                </div>
              </div>
            </div>

            {/* Scanning line animation */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-[20%] animate-[scanline_3s_linear_infinite]" />
          </div>
        </motion.div>
      </section>

      {/* ── Bento Grid Features ── */}
      <section className="px-6 md:px-12 py-24 relative z-20 bg-bg-subtle/50 border-t border-primary/10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="font-mono text-primary text-sm tracking-widest mb-3 uppercase">核心子系统</h2>
            <h3 className="text-3xl md:text-4xl font-display font-bold text-text">非对称攻防训练</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
            {/* Feature 1: Large Span */}
            <div className="md:col-span-8 group relative bg-card border border-border/50 p-8 overflow-hidden hover:border-primary/50 transition-colors">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Target size={120} />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-6">
                  <Terminal size={24} />
                </div>
                <h4 className="text-2xl font-display font-semibold mb-3">深度简历扫描引擎</h4>
                <p className="text-dim leading-relaxed max-w-lg mb-8">
                  利用大语言模型解构你的经历脉络。系统会自动生成针对项目难点、架构设计和业务指标的连环追问，打破浅层提问，直击核心技术栈。
                </p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-bg-subtle border border-border text-xs font-mono text-dim">#深度解析</span>
                  <span className="px-3 py-1 bg-bg-subtle border border-border text-xs font-mono text-dim">#上下文感知</span>
                </div>
              </div>
            </div>

            {/* Feature 2: Small Span */}
            <div className="md:col-span-4 group relative bg-card border border-border/50 p-8 overflow-hidden hover:border-accent/50 transition-colors">
              <div className="relative z-10 h-full flex flex-col">
                <div className="w-12 h-12 bg-accent/10 border border-accent/30 flex items-center justify-center text-accent mb-6">
                  <Cpu size={24} />
                </div>
                <h4 className="text-xl font-display font-semibold mb-3">自适应强化网络</h4>
                <p className="text-dim leading-relaxed flex-1">
                  每一次对话都在更新你的能力图谱。系统基于表现动态调节后续难度，拒绝无效刷题。
                </p>
              </div>
            </div>

            {/* Feature 3: Small Span */}
            <div className="md:col-span-5 group relative bg-card border border-border/50 p-8 overflow-hidden hover:border-teal-400/50 transition-colors">
               <div className="relative z-10 h-full flex flex-col">
                <div className="w-12 h-12 bg-teal-400/10 border border-teal-400/30 flex items-center justify-center text-teal-400 mb-6">
                  <Radio size={24} />
                </div>
                <h4 className="text-xl font-display font-semibold mb-3">全维录音复盘</h4>
                <p className="text-dim leading-relaxed flex-1">
                  上传真实面试录音，自动化转录与评估，精准指出逻辑漏洞与话术改进空间。
                </p>
              </div>
            </div>

            {/* Feature 4: Medium Span */}
            <div className="md:col-span-7 group relative bg-card border border-border/50 p-8 overflow-hidden hover:border-primary/50 transition-colors flex items-center">
              <div className="relative z-10 w-full flex flex-col sm:flex-row items-center gap-8">
                <div className="flex-1">
                  <h4 className="text-xl font-display font-semibold mb-3">多维数据看板</h4>
                  <p className="text-dim leading-relaxed mb-4">
                    战力雷达图实时监控。掌握你的每一次得分与弱项趋势。
                  </p>
                  <button onClick={() => navigate("/login")} className="text-primary text-sm font-mono hover:text-accent flex items-center gap-2 transition-colors">
                    进入控制台 <ArrowRight size={16} />
                  </button>
                </div>
                <div className="w-full sm:w-48 h-32 bg-bg-subtle border border-border flex items-end justify-between p-4 gap-2 relative overflow-hidden">
                   {/* Fake chart */}
                   {[40, 70, 45, 90, 60, 80].map((h, i) => (
                     <motion.div 
                       key={i} 
                       initial={{ height: 0 }}
                       whileInView={{ height: `${h}%` }}
                       transition={{ duration: 0.5, delay: i * 0.1 }}
                       className="w-full bg-primary/40 relative group-hover:bg-primary/60 transition-colors"
                     >
                       <div className="absolute top-0 inset-x-0 h-[2px] bg-accent" />
                     </motion.div>
                   ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
      
      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-primary/20 bg-bg py-8 flex flex-col items-center">
        <div className="text-primary mb-2"><Terminal size={24} /></div>
        <div className="font-mono text-xs text-dim uppercase tracking-widest">
          MemCoach 核心协议 // {new Date().getFullYear()} // 安全加密信道
        </div>
      </footer>
    </div>
  );
}
