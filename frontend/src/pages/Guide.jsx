import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Terminal, Brain, Target, Mic, BookOpen, GitFork, BarChart3, FolderGit2, Fingerprint } from "lucide-react";
import BrandMark from "../components/BrandMark";

/**
 * 使用说明页面 — 项目核心功能介绍与使用指南
 *
 * 智能返回逻辑：
 * - 从 Landing 页进入（state.from === "landing"）→ 返回首页
 * - 从侧边栏进入（state.from === "sidebar"）→ navigate(-1) 返回原位置
 * - 无 state（直接访问）→ 返回首页
 */
export default function Guide() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    const from = location.state?.from;
    if (from === "sidebar") {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const features = [
    {
      icon: Brain,
      title: "持久记忆画像",
      desc: "基于 Mem0 架构，每次训练后自动提取你的薄弱点、强项和思维模式，形成持续演进的个人能力画像。",
      color: "primary",
    },
    {
      icon: Target,
      title: "个性化智能出题",
      desc: "融合全局画像、领域掌握度、知识库检索三层上下文，每道题都精准命中你的短板，拒绝无效刷题。",
      color: "primary",
    },
    {
      icon: Terminal,
      title: "简历模拟面试",
      desc: "AI 读取简历，基于 LangGraph 状态机驱动完整面试流程：自我介绍 → 技术提问 → 项目深挖 → 反问环节。",
      color: "accent",
    },
    {
      icon: BookOpen,
      title: "知识库管理",
      desc: "按领域维护核心知识文档和高频题库，支持 Markdown 编辑，RAG 检索为出题提供精准依据。",
      color: "primary",
    },
    {
      icon: Mic,
      title: "录音复盘分析",
      desc: "上传面试录音或粘贴文字，AI 自动转写分析，结构化 Q&A 逐题评分，精准定位表达与逻辑漏洞。",
      color: "accent",
    },
    {
      icon: GitFork,
      title: "知识图谱",
      desc: "可视化展示你的知识关联网络，直观了解各领域之间的联系与掌握程度分布。",
      color: "primary",
    },
    {
      icon: BarChart3,
      title: "间隔重复调度",
      desc: "SM-2 算法为每个薄弱点维护复习计划，到期知识点优先出题，科学安排复习节奏。",
      color: "accent",
    },
    {
      icon: FolderGit2,
      title: "项目分析",
      desc: "连接 GitHub 仓库，AI 深度分析项目代码架构，生成面试常见的项目相关问题与回答建议。",
      color: "primary",
    },
  ];

  const steps = [
    { num: "01", title: "注册登录", desc: "使用邮箱注册账号并登录系统，你的所有数据将按用户完全隔离。" },
    { num: "02", title: "上传简历", desc: "在「画像」页面上传 PDF 简历，AI 将解析你的经历脉络作为出题依据。" },
    { num: "03", title: "配置知识库", desc: "在「题库」中按领域上传核心知识文档和高频题，构建个人化 RAG 检索库。" },
    { num: "04", title: "开始训练", desc: "选择「简历面试」或「专项强化」模式，AI 根据画像动态生成针对性问题。" },
    { num: "05", title: "查看复盘", desc: "每次训练后自动生成评分与改进建议，薄弱点会被记录并优先安排复习。" },
    { num: "06", title: "持续迭代", desc: "随着训练次数增加，画像越来越精准，出题质量持续提升，形成正向循环。" },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden text-text selection:bg-primary/30">
      {/* 背景网格 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98110_1px,transparent_1px),linear-gradient(to_bottom,#10b98110_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-6 md:px-12 py-6 relative z-30">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-10 h-10 rounded-none border border-primary/40 bg-card/60 flex items-center justify-center relative overflow-hidden group-hover:border-primary transition-colors">
            <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <BrandMark className="w-5 h-5 relative z-10" />
          </div>
          <span className="text-xl font-mono font-bold tracking-widest text-text group-hover:text-primary transition-colors">
            MEMCOACH<span className="text-accent animate-pulse">_</span>
          </span>
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-none bg-primary/10 border border-primary/40 text-primary font-mono text-sm hover:bg-primary hover:text-bg transition-all tracking-wider"
        >
          <ArrowLeft size={16} />
          返回
        </button>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 relative z-20 px-6 md:px-12 pb-20">
        <div className="max-w-5xl mx-auto">

          {/* 页面标题 */}
          <section className="text-center py-12 md:py-16">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 border border-border/50 bg-card/30 backdrop-blur-md text-xs font-mono text-dim mb-6">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--color-accent)]" />
              使用说明 // DOCUMENTATION
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-black leading-tight mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent">
                MemCoach
              </span>
              {" "}使用指南
            </h1>
            <p className="text-lg text-dim max-w-2xl mx-auto">
              一个拥有持久记忆的 AI 面试教练——练得越多，它越了解你的弱点，出题越精准。
            </p>
          </section>

          {/* 项目介绍 */}
          <section className="mb-16">
            <h2 className="font-mono text-primary text-sm tracking-widest mb-3 uppercase">系统_概述</h2>
            <h3 className="text-2xl md:text-3xl font-display font-bold text-text mb-6">什么是 MemCoach？</h3>
            <div className="bg-card border border-border/50 p-6 md:p-8">
              <p className="text-dim leading-relaxed mb-4">
                传统面试工具是无状态的——每次练习都从零开始。<strong className="text-text">MemCoach</strong> 构建了
                <strong className="text-primary">持久化的候选人画像系统</strong>：
                每次训练后自动提取薄弱点、评估掌握度、记录思维模式。下一次出题时，AI 面试官基于画像精准命中短板。
              </p>
              <p className="text-dim leading-relaxed">
                系统融合了大语言模型、向量检索、间隔重复算法和 LangGraph 状态机，
                为你提供从简历模拟面试到专项强化训练的完整技术面试准备方案。
              </p>
            </div>
          </section>

          {/* 核心功能 */}
          <section className="mb-16">
            <h2 className="font-mono text-primary text-sm tracking-widest mb-3 uppercase">核心_功能模块</h2>
            <h3 className="text-2xl md:text-3xl font-display font-bold text-text mb-8">八大核心能力</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {features.map(({ icon: Icon, title, desc, color }) => (
                <div
                  key={title}
                  className="group bg-card border border-border/50 p-6 hover:border-primary/50 transition-colors relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-transparent group-hover:bg-primary transition-colors" />
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 shrink-0 ${color === "accent" ? "bg-accent/10 border-accent/30 text-accent" : "bg-primary/10 border-primary/30 text-primary"} border flex items-center justify-center`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h4 className="font-display font-semibold text-text mb-1">{title}</h4>
                      <p className="text-dim text-sm leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 使用流程 */}
          <section className="mb-16">
            <h2 className="font-mono text-primary text-sm tracking-widest mb-3 uppercase">操作_流程</h2>
            <h3 className="text-2xl md:text-3xl font-display font-bold text-text mb-8">快速上手指南</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {steps.map(({ num, title, desc }) => (
                <div
                  key={num}
                  className="bg-card border border-border/50 p-6 hover:border-primary/30 transition-colors group"
                >
                  <span className="text-3xl font-mono font-black text-primary/20 group-hover:text-primary/40 transition-colors">
                    {num}
                  </span>
                  <h4 className="font-display font-semibold text-text mt-2 mb-2">{title}</h4>
                  <p className="text-dim text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 技术提示 */}
          <section className="mb-12">
            <h2 className="font-mono text-primary text-sm tracking-widest mb-3 uppercase">注意_事项</h2>
            <h3 className="text-2xl md:text-3xl font-display font-bold text-text mb-6">使用提示</h3>
            <div className="bg-card border border-border/50 p-6 md:p-8 space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-mono">1</div>
                <p className="text-dim text-sm leading-relaxed">
                  <strong className="text-text">简历格式：</strong>请上传 PDF 格式的简历，系统会自动提取项目经历与技术栈信息。
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-mono">2</div>
                <p className="text-dim text-sm leading-relaxed">
                  <strong className="text-text">知识库维护：</strong>建议按领域（如 Java、Redis、系统设计等）分类上传知识文档，提升出题精准度。
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-mono">3</div>
                <p className="text-dim text-sm leading-relaxed">
                  <strong className="text-text">录音上传：</strong>支持常见音频格式，建议使用面试实录以获得最佳复盘效果。
                </p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-mono">4</div>
                <p className="text-dim text-sm leading-relaxed">
                  <strong className="text-text">持续训练：</strong>画像系统会随训练次数增加而愈发精准，建议定期使用以获得最佳效果。
                </p>
              </div>
            </div>
          </section>

          {/* 底部 CTA */}
          <section className="text-center py-8">
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-bg font-mono font-bold text-lg tracking-widest overflow-hidden border border-transparent hover:border-accent hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all relative group"
            >
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-no-repeat bg-[position:-100%_0,0_0] group-hover:transition-[background-position_0s_ease] group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1500ms]" />
              <Fingerprint size={22} className="relative z-10" />
              <span className="relative z-10">开始训练</span>
            </button>
          </section>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="relative z-10 border-t border-primary/20 bg-bg py-8 flex flex-col items-center">
        <div className="mb-2"><BrandMark className="w-6 h-6" /></div>
        <div className="font-mono text-xs text-dim uppercase tracking-widest">
          MemCoach 核心协议 // {new Date().getFullYear()} // 安全加密信道
        </div>
      </footer>
    </div>
  );
}
