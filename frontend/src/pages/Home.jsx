import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ChevronRight, Mic } from "lucide-react";
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

  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-8 pb-10 md:px-6 md:pt-15">
      {/* Hero */}
      <div className="text-center mb-10 md:mb-12 relative">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-gradient-to-b from-accent/10 via-accent/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <h1 className="text-3xl md:text-[44px] font-display font-bold mb-3 bg-gradient-to-r from-accent-light via-accent to-orange bg-clip-text text-transparent relative">
          TechSpar
        </h1>
        <p className="text-base text-dim max-w-[500px] relative">
          越练越懂你的 AI 面试教练——追踪你的成长轨迹，精准命中薄弱点
        </p>
      </div>

      {/* Mode cards */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-10 md:mb-12 w-full md:w-auto md:justify-center">
        <div
          className={`w-full md:w-80 px-6 py-7 rounded-2xl cursor-pointer transition-all text-left border-2 animate-fade-in
            ${mode === "resume" ? "border-accent bg-hover shadow-[0_0_24px_rgba(245,158,11,0.1)]" : "border-border bg-card hover:border-accent/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]"}`}
          onClick={() => { setMode("resume"); setSelectedTopic(null); }}
        >
          <div className="inline-block px-2.5 py-1 rounded-md text-xs font-medium mb-3 bg-accent/15 text-accent-light">
            全流程模拟
          </div>
          <div className="text-xl font-semibold mb-2">简历模拟面试</div>
          <div className="text-sm text-dim leading-relaxed">
            AI 读取你的简历，模拟真实面试官。从自我介绍到项目深挖，完整走一遍面试流程。
          </div>
        </div>

        <div
          className={`w-full md:w-80 px-6 py-7 rounded-2xl cursor-pointer transition-all text-left border-2 animate-fade-in [animation-delay:0.1s]
            ${mode === "topic_drill" ? "border-green bg-hover shadow-[0_0_24px_rgba(34,197,94,0.1)]" : "border-border bg-card hover:border-green/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.08)]"}`}
          onClick={() => setMode("topic_drill")}
        >
          <div className="inline-block px-2.5 py-1 rounded-md text-xs font-medium mb-3 bg-green/15 text-green">
            针对强化
          </div>
          <div className="text-xl font-semibold mb-2">专项强化训练</div>
          <div className="text-sm text-dim leading-relaxed">
            选一个领域集中刷题，AI 根据你的回答动态调整难度，精准定位薄弱点。
          </div>
        </div>

        <div
          className="w-full md:w-80 px-6 py-7 rounded-2xl cursor-pointer transition-all text-left border-2 animate-fade-in [animation-delay:0.2s] border-border bg-card hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]"
          onClick={() => navigate("/recording")}
        >
          <div className="inline-block px-2.5 py-1 rounded-md text-xs font-medium mb-3 bg-blue-500/15 text-blue-400">
            录音分析
          </div>
          <div className="text-xl font-semibold mb-2">录音复盘</div>
          <div className="text-sm text-dim leading-relaxed">
            上传面试录音或粘贴文字，AI 自动转写分析，帮你复盘每一场真实面试。
          </div>
        </div>
      </div>

      {/* Quick stats */}
      {profile?.stats?.total_sessions > 0 && !mode && (() => {
        const s = profile.stats;
        const lastEntry = (s.score_history || []).slice(-1)[0];
        const mastery = profile.topic_mastery || {};
        const topTopics = Object.entries(mastery)
          .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
          .slice(0, 3);
        return (
          <div className="w-full max-w-[700px] mb-10 bg-card border border-border rounded-xl px-5 py-5 md:px-6">
            <div className="flex justify-between items-center mb-3.5">
              <span className="text-[15px] font-semibold">训练概览</span>
              <span
                className="text-[13px] text-accent-light cursor-pointer"
                onClick={() => navigate("/profile")}
              >
                查看画像 <ChevronRight size={14} className="inline align-middle" />
              </span>
            </div>
            <div className="flex flex-wrap gap-4 md:gap-6">
              <div className="text-center min-w-[60px]">
                <div className="text-2xl font-bold text-accent-light">{s.total_sessions}</div>
                <div className="text-[11px] text-dim mt-0.5">总练习</div>
              </div>
              <div className="text-center min-w-[60px]">
                <div className="text-2xl font-bold text-green">{s.avg_score || "-"}</div>
                <div className="text-[11px] text-dim mt-0.5">综合平均</div>
              </div>
              {topTopics.length > 0 && (
                <div className="flex-1 min-w-[120px]">
                  <div className="text-[11px] text-dim mb-1.5">领域掌握</div>
                  {topTopics.map(([t, d]) => (
                    <div key={t} className="flex items-center gap-2 mb-1">
                      <span className="text-xs w-[70px] text-text">{t}</span>
                      <div className="flex-1 h-1 rounded-sm bg-border overflow-hidden">
                        <div className="h-full rounded-sm bg-accent-light" style={{ width: `${d.score || 0}%` }} />
                      </div>
                      <span className="text-[11px] text-dim w-7">{d.score || 0}</span>
                    </div>
                  ))}
                </div>
              )}
              {lastEntry && (
                <div className="text-center min-w-[80px]">
                  <div className={`text-2xl font-bold ${lastEntry.avg_score >= 6 ? "text-green" : "text-orange"}`}>
                    {lastEntry.avg_score}
                  </div>
                  <div className="text-[11px] text-dim mt-0.5">上次得分</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Resume upload */}
      {mode === "resume" && (
        <div className="w-full max-w-[700px] mb-8">
          {resumeFile ? (
            <div className="flex items-center justify-between px-4 py-4 md:px-5 bg-card border border-border rounded-xl">
              <div className="flex items-center gap-2.5 text-sm text-text">
                <FileText size={18} className="text-dim shrink-0" />
                <span className="font-medium">{resumeFile.filename}</span>
                <span className="text-xs text-dim">
                  ({(resumeFile.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <label className={`px-4 py-2 rounded-lg bg-accent/12 text-accent-light text-[13px] font-medium cursor-pointer transition-opacity ${uploading ? "opacity-40" : ""}`}>
                {uploading ? "上传中..." : "重新上传"}
                <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          ) : (
            <label className={`flex flex-col items-center gap-2 px-5 py-7 bg-card border-2 border-dashed border-border rounded-xl cursor-pointer transition-colors text-sm text-dim hover:border-accent/50 ${uploading ? "opacity-50" : ""}`}>
              <FileText size={28} className="text-dim" />
              <span>{uploading ? "正在上传..." : "点击上传简历（PDF）"}</span>
              <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>
      )}

      {/* Topic selection */}
      {mode === "topic_drill" && (
        <div className="w-full max-w-[700px]">
          <div className="text-lg font-semibold mb-4 text-left">选择训练领域</div>
          <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 mb-8">
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
        </div>
      )}

      {/* Start button */}
      {mode && (
        <div className="w-full max-w-[700px]">
          <button
            className={`w-full py-3.5 rounded-box bg-gradient-to-r from-accent to-orange text-white text-base font-semibold transition-all ${!canStart || loading ? "opacity-40 cursor-not-allowed" : "hover:shadow-[0_0_24px_rgba(245,158,11,0.2)]"}`}
            disabled={!canStart || loading}
            onClick={handleStart}
          >
            {loading ? "正在初始化面试..." : "开始面试"}
          </button>
        </div>
      )}
    </div>
  );
}
