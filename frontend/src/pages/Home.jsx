import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ChevronRight, Mic, ShieldCheck, Zap, Terminal, Activity, Database, Crosshair } from "lucide-react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import TopicCard from "../components/TopicCard";
import { getTopics, startInterview, getResumeStatus, uploadResume, getProfile } from "../api/interview";

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [topics, setTopics] = useState({});
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    getTopics().then(setTopics).catch(() => {});
    getResumeStatus().then((s) => {
      if (s.has_resume) setResumeFile({ filename: s.filename, size: s.size });
    }).catch(() => {});
    getProfile().then(setProfile).catch(() => {});
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadResume(file);
      setResumeFile({ filename: data.filename, size: data.size });
    } catch (err) {
      alert("上传失败: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStart = async () => {
    if (!mode) return;
    if (mode === "topic_drill" && !selectedTopic) return;
    setLoading(true);
    try {
      const data = await startInterview(mode, selectedTopic);
      navigate(`/interview/${data.session_id}`, { state: data });
    } catch (err) {
      alert("启动失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const canStart = (mode === "resume" && resumeFile) || (mode === "topic_drill" && selectedTopic);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <div className="flex-1 w-full min-h-full p-6 md:p-10 lg:p-14 max-w-7xl mx-auto relative z-10 font-mono flex flex-col gap-8 text-text selection:bg-primary/30">
      
      {/* Header Area */}
      <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-primary/20 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/30 text-primary text-sm tracking-widest mb-3">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            控制台已就绪
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent">
            训练矩阵
          </h1>
        </div>
        <div className="text-right flex flex-col md:items-end">
          <div className="text-sm text-dim mb-1">系统状态</div>
          <div className="flex items-center gap-3 text-base">
             <span className="flex items-center gap-1.5"><Activity size={16} className="text-primary"/> 极佳</span>
             <span className="flex items-center gap-1.5 border-l border-primary/30 pl-3"><Database size={16} className="text-accent"/> 已同步</span>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Interface */}
        <motion.div 
          className="flex-1 flex flex-col gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Mode Selection */}
          <motion.div variants={itemVariants} className="bg-card border border-primary/20 p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
              <Crosshair size={100} />
            </div>
            
            <h2 className="text-xl font-display font-semibold mb-5 flex items-center gap-2 text-text">
              <Zap className="text-accent" size={20} />
              选择战斗序列
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              {/* Resume Mode */}
              <button
                className={`p-4 text-left transition-all duration-300 border relative overflow-hidden flex items-start gap-4
                  ${mode === "resume" 
                    ? "border-primary bg-primary/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]" 
                    : "border-border/50 bg-bg-subtle hover:bg-card hover:border-primary/50"}`}
                onClick={() => { setMode("resume"); setSelectedTopic(null); }}
              >
                <div className={`p-2 shrink-0 ${mode === "resume" ? "bg-primary/20 text-primary" : "bg-bg text-dim"}`}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className={`text-lg font-bold mb-1 font-display tracking-wide ${mode === "resume" ? "text-primary" : "text-text"}`}>简历模拟面试</h3>
                  <p className="text-sm text-dim leading-relaxed font-sans">基于上传的 PDF 简历进行全频段扫描与连环追问。</p>
                </div>
                {/* Corner accent */}
                {mode === "resume" && <div className="absolute top-0 right-0 w-3 h-3 bg-primary" />}
              </button>

              {/* Topic Drill Mode */}
              <button
                className={`p-4 text-left transition-all duration-300 border relative overflow-hidden flex items-start gap-4
                  ${mode === "topic_drill" 
                    ? "border-accent bg-accent/10 shadow-[inset_0_0_20px_rgba(217,249,157,0.1)]" 
                    : "border-border/50 bg-bg-subtle hover:bg-card hover:border-accent/50"}`}
                onClick={() => setMode("topic_drill")}
              >
                <div className={`p-2 shrink-0 ${mode === "topic_drill" ? "bg-accent/20 text-accent" : "bg-bg text-dim"}`}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className={`text-lg font-bold mb-1 font-display tracking-wide ${mode === "topic_drill" ? "text-accent" : "text-text"}`}>专项强化训练</h3>
                  <p className="text-sm text-dim leading-relaxed font-sans">针对特定领域进行高强度抗压测试与盲区扫荡。</p>
                </div>
                {/* Corner accent */}
                {mode === "topic_drill" && <div className="absolute top-0 right-0 w-3 h-3 bg-accent" />}
              </button>
            </div>
          </motion.div>

          {/* Configuration Area */}
          <AnimatePresence mode="wait">
            {mode === "resume" && (
              <motion.div
                key="resume-area"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-bg-subtle border border-primary/20 p-6 relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-transparent" />
                <h3 className="text-sm font-bold text-primary mb-4 tracking-widest uppercase">配置数据源</h3>
                {resumeFile ? (
                  <div className="flex items-center justify-between p-4 bg-card border border-primary/30">
                    <div className="flex items-center gap-3">
                      <Terminal size={20} className="text-primary" />
                      <div>
                        <div className="font-semibold text-text text-base">{resumeFile.filename}</div>
                        <div className="text-sm text-dim">状态: 解析就绪 // {(resumeFile.size / 1024).toFixed(0)} KB</div>
                      </div>
                    </div>
                    <label className="px-4 py-2 bg-primary/10 text-primary border border-primary/30 text-sm font-bold uppercase tracking-wider cursor-pointer hover:bg-primary/20 transition-colors">
                      {uploading ? "正在覆写..." : "重新上传"}
                      <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-8 border border-dashed border-primary/40 bg-card/30 cursor-pointer hover:bg-primary/5 transition-all group">
                    <FileText size={32} className="text-dim group-hover:text-primary transition-colors mb-3" />
                    <span className="font-bold text-text text-base mb-1">{uploading ? "正在上传至核心节点..." : "点击或拖拽上传 PDF 简历"}</span>
                    <span className="text-sm text-dim">最大负载体积: 10MB</span>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
                  </label>
                )}
              </motion.div>
            )}

            {mode === "topic_drill" && (
              <motion.div
                key="topic-area"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-bg-subtle border border-accent/20 p-6 relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-accent to-transparent" />
                <h3 className="text-sm font-bold text-accent mb-4 tracking-widest uppercase">选择目标领域</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(topics).map(([key, info]) => (
                    <TopicCard
                      key={key}
                      topicKey={key}
                      name={info.name || key}
                      icon={info.icon}
                      selected={selectedTopic === key}
                      onClick={() => setSelectedTopic(key)}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button */}
          <AnimatePresence>
            {mode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2"
              >
                <button
                  disabled={!canStart || loading}
                  onClick={handleStart}
                  className={`relative w-full py-5 font-display font-black text-xl tracking-widest uppercase overflow-hidden group
                    ${(!canStart || loading) 
                      ? "bg-bg-subtle text-dim cursor-not-allowed border border-border/50" 
                      : "bg-primary text-bg shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] border border-transparent"}`}
                >
                  {/* Glitch/Shimmer effect */}
                  {canStart && !loading && (
                     <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-no-repeat bg-[position:-100%_0,0_0] group-hover:transition-[background-position_0s_ease] group-hover:bg-[position:200%_0,0_0] group-hover:duration-[1000ms]" />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                        正在建立神经链接...
                      </>
                    ) : (
                      <>
                        <Terminal size={20} />
                        执行开始序列
                      </>
                    )}
                  </span>
                  {/* Decorative cutouts */}
                  <div className="absolute top-0 left-0 w-2 h-2 bg-bg" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-bg" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Side Panel: Intel / Stats */}
        <motion.div 
          className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col gap-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* Stats Widget */}
          <div className="bg-card border border-primary/20 p-5 relative">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-base tracking-widest text-primary uppercase">
                战斗情报
              </h3>
              <button 
                onClick={() => navigate("/profile")}
                className="text-sm text-dim hover:text-primary transition-colors flex items-center gap-1"
              >
                查看完整日志 <ChevronRight size={14} />
              </button>
            </div>

            {profile?.stats?.total_sessions > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg-subtle border border-border p-3">
                    <div className="text-xs text-dim mb-1">总演练次数</div>
                    <div className="text-3xl font-bold text-text">
                      {profile.stats.total_sessions}
                    </div>
                  </div>
                  <div className="bg-bg-subtle border border-border p-3">
                    <div className="text-xs text-dim mb-1">综合战力评级</div>
                    <div className="text-3xl font-bold text-accent">
                      {profile.stats.avg_score || "-"}
                    </div>
                  </div>
                </div>

                {profile.topic_mastery && Object.keys(profile.topic_mastery).length > 0 && (
                  <div>
                    <div className="text-xs text-dim mb-3">领域掌握度映射</div>
                    <div className="space-y-3">
                      {Object.entries(profile.topic_mastery)
                        .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
                        .slice(0, 3)
                        .map(([t, d], idx) => (
                          <div key={t} className="relative">
                            <div className="flex justify-between text-sm mb-1 font-sans">
                              <span className="text-text">{t}</span>
                              <span className="text-primary font-mono">{d.score || 0}</span>
                            </div>
                            <div className="h-1 w-full bg-bg border border-border overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${d.score || 0}%` }}
                                transition={{ duration: 1, delay: 0.5 + (idx * 0.1) }}
                                className="h-full bg-primary"
                              />
                            </div>
                          </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                 <Database size={32} className="mb-3 text-dim" />
                 <p className="text-sm text-dim text-center">暂无数据记录<br/>请完成首次演练以激活看板</p>
              </div>
            )}
          </div>

          {/* Quick Tool */}
          <div className="bg-bg-subtle border border-border/50 hover:border-teal-400/50 transition-colors p-1 group cursor-pointer" onClick={() => navigate("/recording")}>
            <div className="border border-border/50 border-dashed p-4 flex items-center justify-between text-base group-hover:bg-teal-400/5 transition-colors">
              <span className="font-semibold text-text group-hover:text-teal-400 transition-colors flex items-center gap-2">
                <Mic size={18} /> 外部录音转录与复盘
              </span>
              <ChevronRight size={18} className="text-dim group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
          
        </motion.div>
      </div>
    </div>
  );
}
