import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { 
  Terminal, Cpu, Database, Shield, Zap, 
  Globe, Layers, Code, Server, Lock, 
  ArrowLeft, Copy, Check, ChevronRight,
  Activity, Target, Radio, Brain, CircuitBoard
} from "lucide-react";

export default function TechSpecs() {
  const navigate = useNavigate();
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [copied, setCopied] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const terminalRef = useRef(null);

  const welcomeText = "> 正在初始化 MemCoach 系统...\n> 正在加载技术规格数据...\n> 访问权限已授权\n> 欢迎操作员。";

  useEffect(() => {
    let index = 0;
    let timer;
    // 配合大门开启时机，延迟 2.8s 开始打字
    const startDelay = setTimeout(() => {
      timer = setInterval(() => {
        if (index < welcomeText.length) {
          setTypedText(welcomeText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(timer);
        }
      }, 30);
    }, 2800);

    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => {
      clearTimeout(startDelay);
      if (timer) clearInterval(timer);
      clearInterval(cursorTimer);
    };
  }, []);

  const techStack = [
    { name: "FastAPI", version: "0.115+", icon: Server, color: "from-emerald-400 to-teal-500", desc: "高性能异步 Web 框架" },
    { name: "React 19", version: "Latest", icon: Code, color: "from-cyan-400 to-blue-500", desc: "现代前端框架" },
    { name: "LangChain", version: "0.3+", icon: Brain, color: "from-purple-400 to-pink-500", desc: "LLM 应用开发框架" },
    { name: "LangGraph", version: "Latest", icon: CircuitBoard, color: "from-orange-400 to-red-500", desc: "有状态 AI 工作流" },
    { name: "LlamaIndex", version: "Latest", icon: Layers, color: "from-yellow-400 to-orange-500", desc: "数据索引与检索" },
    { name: "SQLite", version: "3.x", icon: Database, color: "from-blue-400 to-indigo-500", desc: "轻量级数据库" },
    { name: "bge-m3", version: "Latest", icon: Target, color: "from-green-400 to-emerald-500", desc: "多语言嵌入模型" },
    { name: "JWT", version: "Standard", icon: Lock, color: "from-red-400 to-pink-500", desc: "身份认证" },
  ];

  const coreFeatures = [
    { icon: Brain, title: "持久记忆", desc: "基于 Mem0 架构的用户画像系统，持续演进" },
    { icon: Target, title: "个性化出题", desc: "融合三层上下文，每道题都有针对性" },
    { icon: Activity, title: "智能评估", desc: "逐题评分 + 薄弱点提取 + 改进建议" },
    { icon: Zap, title: "间隔重复", desc: "SM-2 算法维护复习调度，到期优先出题" },
    { icon: Database, title: "知识库管理", desc: "按领域维护核心知识，RAG 检索提供依据" },
    { icon: Terminal, title: "简历模拟面试", desc: "LangGraph 状态机驱动完整面试流程" },
    { icon: Shield, title: "专项强化训练", desc: "选择领域集中刷题，精准定位薄弱点" },
    { icon: Radio, title: "录音复盘", desc: "上传面试录音，AI 自动转写分析" },
    { icon: Lock, title: "多用户隔离", desc: "JWT 认证，数据按用户完全隔离" },
  ];

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 2.8
      }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20
      }
    }
  };

  return (
    <>
      {/* Intro Sequence */}
      <AnimatePresence>
        {showIntro && (
          <IntroSequence onComplete={() => setShowIntro(false)} />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="min-h-screen bg-bg text-text font-mono relative overflow-hidden selection:bg-primary/30">
      {/* Dynamic Particle Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98108_1px,transparent_1px),linear-gradient(to_bottom,#10b98108_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,185,129,0.15),transparent_50%)] pointer-events-none" />
      
      {/* Floating Orbs */}
      <motion.div 
        animate={{ 
          x: [0, 100, 0],
          y: [0, -100, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div 
        animate={{ 
          x: [0, -100, 0],
          y: [0, 100, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-20 w-80 h-80 bg-accent/10 rounded-full blur-[120px] pointer-events-none"
      />

      {/* Header */}
      <header className="relative z-30 px-6 md:px-12 py-6 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 text-dim hover:text-primary transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm tracking-wider uppercase">返回控制台</span>
        </button>
        <div className="flex items-center gap-2 text-primary animate-pulse">
          <div className="w-2 h-2 bg-primary rounded-full" />
          <span className="text-xs tracking-widest uppercase">System Online</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-20 px-6 md:px-12 py-8 max-w-7xl mx-auto">
        
        {/* Team Leader Signature */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 2.6 }}
          className="mb-12 text-center"
        >
          <div className="inline-block relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-20 blur-xl" />
            <div className="relative bg-bg-subtle/80 backdrop-blur-xl border border-primary/30 px-8 py-4 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <Cpu size={20} className="text-bg" />
                </div>
                <div className="text-left">
                  <div className="text-xs text-dim uppercase tracking-widest mb-1">MemCoach Team</div>
                  <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                    总负责人：Harrison（xuhaochen）
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Terminal Welcome */}
        <motion.div 
          ref={terminalRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 2.7 }}
          className="mb-16 relative"
        >
          <div className="bg-bg-subtle/90 backdrop-blur-xl border border-primary/30 rounded-lg overflow-hidden shadow-2xl">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="text-xs text-primary/70 font-mono">memcoach-terminal</div>
              <div className="w-16" />
            </div>
            
            {/* Terminal Body */}
            <div className="p-6 font-mono text-sm min-h-[200px]">
              <pre className="text-primary leading-relaxed whitespace-pre-wrap">
                {typedText}
                <span className={`inline-block w-2 h-5 bg-primary ml-1 ${showCursor ? 'animate-pulse' : 'opacity-0'}`} />
              </pre>
            </div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent h-[20%] animate-[scanline_3s_linear_infinite] pointer-events-none" />
          </div>
        </motion.div>

        {/* Tech Stack Section */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-20"
        >
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-display font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent">
            技术栈矩阵
          </motion.h2>
          
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {techStack.map((tech, index) => {
              const Icon = tech.icon;
              return (
                <motion.div
                  key={tech.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 3.0 + index * 0.1 }}
                  whileHover={{ 
                    scale: 1.05, 
                    rotateX: 5,
                    rotateY: 5,
                    boxShadow: "0 20px 40px rgba(16, 185, 129, 0.3)"
                  }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative bg-bg-subtle/80 backdrop-blur-xl border border-primary/20 rounded-xl p-6 h-full">
                    <div className={`w-12 h-12 bg-gradient-to-br ${tech.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon size={24} className="text-bg" />
                    </div>
                    <h3 className="text-lg font-bold text-text mb-1">{tech.name}</h3>
                    <p className="text-xs text-primary font-mono mb-2">{tech.version}</p>
                    <p className="text-sm text-dim">{tech.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Core Features Section */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-20"
        >
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-display font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-accent via-emerald-300 to-primary">
            核心功能矩阵
          </motion.h2>
          
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 3.5 + index * 0.08 }}
                  whileHover={{ 
                    scale: 1.02,
                    borderColor: "rgba(16, 185, 129, 0.5)"
                  }}
                  className="relative bg-bg-subtle/60 backdrop-blur-xl border border-primary/20 rounded-xl p-6 group overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="w-10 h-10 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon size={20} className="text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-text mb-2">{feature.title}</h3>
                    <p className="text-sm text-dim leading-relaxed">{feature.desc}</p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* System Architecture */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-20"
        >
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-display font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent">
            系统架构
          </motion.h2>
          
          <motion.div variants={itemVariants} className="bg-bg-subtle/80 backdrop-blur-xl border border-primary/20 rounded-xl p-8 relative overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Frontend */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative bg-card/60 border border-primary/30 rounded-lg p-6"
              >
                <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />
                <Code size={32} className="text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Frontend</h3>
                <ul className="text-sm text-dim space-y-1">
                  <li>React 19</li>
                  <li>Vite</li>
                  <li>Tailwind CSS v4</li>
                  <li>Framer Motion</li>
                </ul>
              </motion.div>

              {/* Backend */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative bg-card/60 border border-accent/30 rounded-lg p-6"
              >
                <div className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full animate-pulse" />
                <Server size={32} className="text-accent mb-4" />
                <h3 className="text-xl font-bold mb-2">Backend</h3>
                <ul className="text-sm text-dim space-y-1">
                  <li>FastAPI</li>
                  <li>LangChain</li>
                  <li>LangGraph</li>
                  <li>LlamaIndex</li>
                </ul>
              </motion.div>

              {/* Storage */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="relative bg-card/60 border border-primary/30 rounded-lg p-6"
              >
                <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />
                <Database size={32} className="text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Storage</h3>
                <ul className="text-sm text-dim space-y-1">
                  <li>SQLite</li>
                  <li>bge-m3 Embeddings</li>
                  <li>Vector Memory</li>
                  <li>File Storage</li>
                </ul>
              </motion.div>
            </div>

            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#d9f99d" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
                </linearGradient>
              </defs>
              <motion.path
                d="M 200 150 Q 400 100 600 150"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, delay: 4.2 }}
              />
              <motion.path
                d="M 600 150 Q 800 200 1000 150"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, delay: 4.7 }}
              />
            </svg>
          </motion.div>
        </motion.div>

        {/* Deployment Info */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mb-12"
        >
          <motion.h2 variants={itemVariants} className="text-3xl md:text-4xl font-display font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-accent via-emerald-300 to-primary">
            部署配置
          </motion.h2>
          
          <motion.div variants={itemVariants} className="bg-bg-subtle/80 backdrop-blur-xl border border-primary/20 rounded-xl p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <Terminal className="text-primary shrink-0 mt-1" size={20} />
                <div className="flex-1">
                  <div className="text-sm text-dim mb-2">Docker Compose 启动命令</div>
                  <div className="relative bg-bg/80 border border-primary/30 rounded-lg p-4 font-mono text-sm">
                    <code className="text-primary">docker compose up --build</code>
                    <button
                      onClick={() => copyToClipboard("docker compose up --build", "docker")}
                      className="absolute top-2 right-2 p-2 text-dim hover:text-primary transition-colors"
                    >
                      {copied === "docker" ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Globe className="text-accent shrink-0 mt-1" size={20} />
                <div className="flex-1">
                  <div className="text-sm text-dim mb-2">环境变量配置</div>
                  <div className="relative bg-bg/80 border border-accent/30 rounded-lg p-4 font-mono text-sm">
                    <code className="text-accent">cp .env.example .env</code>
                    <button
                      onClick={() => copyToClipboard("cp .env.example .env", "env")}
                      className="absolute top-2 right-2 p-2 text-dim hover:text-accent transition-colors"
                    >
                      {copied === "env" ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 5 }}
          className="text-center py-8 border-t border-primary/20"
        >
          <div className="text-dim text-sm uppercase tracking-widest">
            MemCoach Technical Specifications // {new Date().getFullYear()}
          </div>
          <div className="text-primary/50 text-xs mt-2 font-mono">
            System Version 2.0 // Secure Encrypted Channel
          </div>
        </motion.div>
      </main>
    </div>
    </>
  );
}

// IntroSequence Component - 「协议覆写」高级机械加载动效
function IntroSequence({ onComplete }) {
  useEffect(() => {
    // 3.6s 后销毁动画层，完全露出底层页面
    const timer = setTimeout(() => onComplete(), 3600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // 极具阻尼感的贝塞尔曲线，强调重量和爆发力 (初速极大，后段极慢)
  const mechanicalEasing = [0.85, 0, 0.15, 1];
  // 锁扣回缩的顿挫感
  const lockEasing = [0.4, -0.4, 0.2, 1.5];

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex overflow-hidden">
      {/* 底层深渊背景，门拉开时立即消失，无缝透出底层真实页面 */}
      <motion.div 
        className="absolute inset-0 bg-[#0a0e12] z-[-1]" 
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2.4, duration: 0.1 }}
      />

      {/* 门缝背后的极强光源（开门时的爆光剪影效果） */}
      <motion.div 
        className="absolute inset-0 bg-[#00f0ff] z-0 mix-blend-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 0] }}
        transition={{ times: [0, 2.3/3.6, 2.5/3.6, 3.4/3.6], duration: 3.6 }}
      />

      {/* ================= 左半边门与系统背景 ================= */}
      <motion.div
        className="relative w-1/2 h-full bg-[#0a0e12] z-10 overflow-hidden flex justify-end items-center border-r border-[#00f0ff]/20 shadow-[20px_0_50px_rgba(0,0,0,0.8)]"
        initial={{ x: 0 }}
        animate={{ x: "-100%" }}
        transition={{ delay: 2.5, duration: 0.8, ease: mechanicalEasing }}
      >
        {/* PCB 底纹 (极暗呼吸) */}
        <motion.div 
          className="absolute inset-0 opacity-[0.03]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.08, 0.02, 0.06] }}
          transition={{ duration: 0.8, repeat: 3, repeatType: "reverse" }}
        >
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <pattern id="pcb" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 0 40 L 20 40 L 40 20 L 40 0 M 40 80 L 40 60 L 60 40 L 80 40" fill="none" stroke="#ffffff" strokeWidth="1"/>
              <circle cx="20" cy="40" r="2" fill="#ffffff" />
              <circle cx="60" cy="40" r="2" fill="#ffffff" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#pcb)" />
          </svg>
        </motion.div>

        {/* 能量传输线 (左侧 -> 中央) */}
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-90">
          <defs>
            <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="lineGradL" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="#00f0ff" />
              <stop offset="100%" stopColor="#fff" />
            </linearGradient>
          </defs>
          {/* 主干线 1 (上方) */}
          <motion.path
            d="M -100 200 L 400 200 L 500 350 L 1000 350"
            fill="none"
            stroke="url(#lineGradL)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            filter="url(#cyanGlow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
            transition={{ delay: 0.6, duration: 1.2, ease: "circIn" }}
          />
          {/* 主干线 2 (下方) */}
          <motion.path
            d="M -100 800 L 300 800 L 450 650 L 1000 650"
            fill="none"
            stroke="url(#lineGradL)"
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
            filter="url(#cyanGlow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
            transition={{ delay: 0.9, duration: 1.0, ease: "circIn" }}
          />
          {/* 细节点缀线群 */}
          <motion.path
            d="M 200 450 L 600 450 L 650 480 L 1000 480 M 0 550 L 800 550 L 850 520 L 1000 520"
            fill="none"
            stroke="#00f0ff"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 0.6, 0] }}
            transition={{ delay: 1.1, duration: 0.8, ease: "linear" }}
          />
        </svg>

        {/* 左半中央机械门体 (厚重质感) */}
        <div className="relative w-[380px] h-[65vh] bg-gradient-to-br from-[#1a212a] to-[#0d1117] border-y border-l border-[#3a4652] rounded-l-2xl shadow-[-40px_0_80px_rgba(0,0,0,0.95)_inset,_10px_0_30px_rgba(0,240,255,0.05)] flex flex-col justify-center items-end pr-2 overflow-hidden">
          {/* 表面装甲接缝与划痕纹理 */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(90deg,transparent_98%,#fff_98%),linear-gradient(0deg,transparent_98%,#fff_98%)] bg-[size:60px_60px]" />
          <div className="absolute top-0 right-12 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ffffff15] to-transparent" />
          
          {/* 装饰性散热口 */}
          <div className="absolute top-16 right-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-16 h-1.5 bg-[#05080a] rounded-full shadow-[0_1px_1px_rgba(255,255,255,0.15)]" />
            ))}
          </div>
          <div className="absolute bottom-16 right-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-16 h-1.5 bg-[#05080a] rounded-full shadow-[0_1px_1px_rgba(255,255,255,0.15)]" />
            ))}
          </div>

          {/* 左侧重型物理锁扣 */}
          <motion.div 
            className="z-20 w-16 h-56 bg-gradient-to-r from-[#0d1117] to-[#161d26] border border-[#3a4652] flex flex-col justify-between py-8 items-center rounded-sm shadow-[inset_0_0_25px_rgba(0,0,0,0.9),_5px_0_15px_rgba(0,0,0,0.6)] relative"
            initial={{ x: 0 }}
            animate={{ x: -28 }}
            transition={{ delay: 2.1, duration: 0.4, ease: lockEasing }}
          >
            {/* 锁舌结构 */}
            <div className="w-10 h-6 bg-[#1e2630] rounded-sm border border-[#4a5662] shadow-[0_3px_5px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.1)] flex items-center justify-center">
              <div className="w-6 h-1 bg-[#0a0e12] rounded-full" />
            </div>
            <div className="w-10 h-6 bg-[#1e2630] rounded-sm border border-[#4a5662] shadow-[0_3px_5px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.1)] flex items-center justify-center">
              <div className="w-6 h-1 bg-[#0a0e12] rounded-full" />
            </div>
          </motion.div>

          {/* 状态指示灯左半段 (从无到充能，最后变色) */}
          <div className="absolute top-1/2 right-0 w-32 h-2 -translate-y-1/2 bg-[#05080a] overflow-hidden z-10 border-y border-l border-[#2a3642]/50 rounded-l-sm shadow-[inset_0_0_8px_rgba(0,0,0,1)]">
             <motion.div 
               className="w-full h-full bg-[#00f0ff] shadow-[0_0_15px_#00f0ff]"
               initial={{ x: "-100%", backgroundColor: "#00f0ff" }}
               animate={{ 
                 x: ["-100%", "0%", "0%"],
                 backgroundColor: ["#00f0ff", "#00f0ff", "#ffb703"],
                 boxShadow: ["0 0 15px #00f0ff", "0 0 15px #00f0ff", "0 0 20px #ffb703"]
               }}
               transition={{ times: [0, 0.8, 1], delay: 1.8, duration: 0.6, ease: "easeOut" }}
             />
          </div>
        </div>
      </motion.div>

      {/* ================= 右半边门与系统背景 ================= */}
      <motion.div
        className="relative w-1/2 h-full bg-[#0a0e12] z-10 overflow-hidden flex justify-start items-center border-l border-[#00f0ff]/20 shadow-[-20px_0_50px_rgba(0,0,0,0.8)]"
        initial={{ x: 0 }}
        animate={{ x: "100%" }}
        transition={{ delay: 2.5, duration: 0.8, ease: mechanicalEasing }}
      >
        {/* PCB 底纹 (极暗呼吸) */}
        <motion.div 
          className="absolute inset-0 opacity-[0.03]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.08, 0.02, 0.06] }}
          transition={{ duration: 0.8, repeat: 3, repeatType: "reverse", delay: 0.2 }}
        >
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <pattern id="pcb2" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 40 L 60 40 L 40 20 L 40 0 M 40 80 L 40 60 L 20 40 L 0 40" fill="none" stroke="#ffffff" strokeWidth="1"/>
              <circle cx="60" cy="40" r="2" fill="#ffffff" />
              <circle cx="20" cy="40" r="2" fill="#ffffff" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#pcb2)" />
          </svg>
        </motion.div>

        {/* 能量传输线 (右侧 -> 中央) */}
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-90" style={{ transform: "scaleX(-1)" }}>
          <defs>
            <filter id="cyanGlow2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <motion.path
            d="M -100 250 L 350 250 L 450 400 L 1000 400"
            fill="none"
            stroke="url(#lineGradL)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            filter="url(#cyanGlow2)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
            transition={{ delay: 0.7, duration: 1.1, ease: "circIn" }}
          />
          <motion.path
            d="M -100 750 L 400 750 L 500 600 L 1000 600"
            fill="none"
            stroke="url(#lineGradL)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            filter="url(#cyanGlow2)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, 1, 0] }}
            transition={{ delay: 1.0, duration: 0.9, ease: "circIn" }}
          />
        </svg>

        {/* 右半中央机械门体 */}
        <div className="relative w-[380px] h-[65vh] bg-gradient-to-bl from-[#1a212a] to-[#0d1117] border-y border-r border-[#3a4652] rounded-r-2xl shadow-[40px_0_80px_rgba(0,0,0,0.95)_inset,_-10px_0_30px_rgba(0,240,255,0.05)] flex flex-col justify-center items-start pl-2 overflow-hidden">
          {/* 表面装甲接缝 */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(90deg,#fff_2%,transparent_2%),linear-gradient(0deg,transparent_98%,#fff_98%)] bg-[size:60px_60px]" />
          <div className="absolute top-0 left-12 w-[1px] h-full bg-gradient-to-b from-transparent via-[#ffffff15] to-transparent" />
          
          {/* 装饰性散热口 */}
          <div className="absolute top-16 left-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-16 h-1.5 bg-[#05080a] rounded-full shadow-[0_1px_1px_rgba(255,255,255,0.15)]" />
            ))}
          </div>
          <div className="absolute bottom-16 left-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-16 h-1.5 bg-[#05080a] rounded-full shadow-[0_1px_1px_rgba(255,255,255,0.15)]" />
            ))}
          </div>

          {/* 右侧重型物理锁扣 */}
          <motion.div 
            className="z-20 w-16 h-56 bg-gradient-to-l from-[#0d1117] to-[#161d26] border border-[#3a4652] flex flex-col justify-between py-8 items-center rounded-sm shadow-[inset_0_0_25px_rgba(0,0,0,0.9),_-5px_0_15px_rgba(0,0,0,0.6)] relative"
            initial={{ x: 0 }}
            animate={{ x: 28 }}
            transition={{ delay: 2.1, duration: 0.4, ease: lockEasing }}
          >
            <div className="w-10 h-6 bg-[#1e2630] rounded-sm border border-[#4a5662] shadow-[0_3px_5px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.1)] flex items-center justify-center">
              <div className="w-6 h-1 bg-[#0a0e12] rounded-full" />
            </div>
            <div className="w-10 h-6 bg-[#1e2630] rounded-sm border border-[#4a5662] shadow-[0_3px_5px_rgba(0,0,0,0.6),_inset_0_1px_1px_rgba(255,255,255,0.1)] flex items-center justify-center">
              <div className="w-6 h-1 bg-[#0a0e12] rounded-full" />
            </div>
          </motion.div>

          {/* 状态指示灯右半段 */}
          <div className="absolute top-1/2 left-0 w-32 h-2 -translate-y-1/2 bg-[#05080a] overflow-hidden z-10 border-y border-r border-[#2a3642]/50 rounded-r-sm shadow-[inset_0_0_8px_rgba(0,0,0,1)]">
             <motion.div 
               className="w-full h-full bg-[#00f0ff] shadow-[0_0_15px_#00f0ff]"
               initial={{ x: "100%", backgroundColor: "#00f0ff" }}
               animate={{ 
                 x: ["100%", "0%", "0%"],
                 backgroundColor: ["#00f0ff", "#00f0ff", "#ffb703"],
                 boxShadow: ["0 0 15px #00f0ff", "0 0 15px #00f0ff", "0 0 20px #ffb703"]
               }}
               transition={{ times: [0, 0.8, 1], delay: 1.8, duration: 0.6, ease: "easeOut" }}
             />
          </div>
        </div>

        {/* 锁止接通时的能量高频频闪爆点 (强化能量注入感) */}
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-64 bg-[#00f0ff] blur-2xl mix-blend-screen z-30 pointer-events-none"
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 1, 0.2, 1, 0], scaleY: [0, 1.2, 0.8, 1.5, 2] }}
          transition={{ times: [0, 0.2, 0.4, 0.6, 1], delay: 1.8, duration: 0.6, ease: "easeOut" }}
        />
      </motion.div>

      {/* 底部系统控制台字符，带 CRT 扫描线故障感 */}
      <motion.div 
        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 text-[#00f0ff] font-mono text-[11px] tracking-[1em] mix-blend-screen"
        initial={{ opacity: 0, filter: "blur(4px)" }}
        animate={{ opacity: [0, 0.8, 0], filter: ["blur(4px)", "blur(0px)", "blur(2px)"] }}
        transition={{ times: [0, 0.2, 1], delay: 0.5, duration: 2.5 }}
      >
        <div className="relative">
          PROTOCOL OVERRIDE INITIATED
          <div className="absolute inset-0 bg-[#00f0ff] mix-blend-overlay opacity-50 blur-[2px]" />
        </div>
      </motion.div>
    </div>
  );
}
