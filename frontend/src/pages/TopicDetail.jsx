import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Target, Activity, FileText } from "lucide-react";
import { getTopicIcon } from "../utils/topicIcons";
import {
  getProfile,
  getTopics,
  getTopicRetrospective,
  getTopicHistory,
} from "../api/interview";

function getScoreColor(score) {
  if (score >= 8) return "var(--primary)";
  if (score >= 6) return "var(--accent)";
  if (score >= 4) return "#e2b93b";
  return "var(--red)";
}

export default function TopicDetail() {
  const { topic } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [topicInfo, setTopicInfo] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [retrospective, setRetrospective] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProfile(), getTopics(), getTopicHistory(topic)])
      .then(([prof, topics, hist]) => {
        setProfile(prof);
        setTopicInfo(topics[topic] || { name: topic, icon: "" });
        setSessions(hist);
        const cached = prof?.topic_mastery?.[topic]?.retrospective;
        if (cached) setRetrospective(cached);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topic]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await getTopicRetrospective(topic);
      setRetrospective(res.retrospective);
    } catch (err) {
      alert("生成失败: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center font-mono text-primary h-full">
      <Activity size={32} className="animate-pulse mb-4" />
      <div className="tracking-widest text-sm">正在获取节点数据...</div>
    </div>
  );

  const mastery = profile?.topic_mastery?.[topic] || {};

  return (
    <div className="flex-1 p-6 md:p-10 lg:p-14 w-full relative z-10 text-text font-mono selection:bg-primary/30">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation */}
        <button
          className="text-xs text-dim cursor-pointer mb-8 inline-flex items-center gap-2 hover:text-primary transition-colors tracking-widest uppercase"
          onClick={() => navigate("/profile")}
        >
          <ArrowLeft size={14} /> 返回战力画像
        </button>

        {/* Header */}
        <div className="flex items-start md:items-center gap-6 mb-10 pb-8 border-b border-primary/20">
          <div className="w-16 h-16 bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 relative overflow-hidden group">
             <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <div className="relative z-10">{getTopicIcon(topicInfo?.icon, 32)}</div>
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-primary/5 border border-primary/20 text-primary text-[11px] tracking-widest mb-2 uppercase">
              <Target size={10} /> 领域详情
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text via-slate-300 to-dim mb-2">
              {topicInfo?.name || topic}
            </h1>
            <div className="text-xs text-dim tracking-widest uppercase">
              {sessions.length} 次演练周期
              {mastery.last_assessed && <span className="mx-2 opacity-50">|</span>}
              {mastery.last_assessed && `上次同步: ${mastery.last_assessed.slice(0, 10)}`}
            </div>
          </div>
        </div>

        {/* Mastery bar */}
        {(mastery.score > 0 || mastery.level > 0) && (
          <div className="flex items-center gap-6 px-6 py-5 bg-bg-subtle border border-primary/30 mb-10 relative overflow-hidden group">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-col items-center shrink-0">
              <span className="text-3xl font-black text-primary leading-none">{mastery.score ?? (mastery.level ? mastery.level * 20 : 0)}</span>
              <span className="text-[11px] text-dim tracking-widest">/100</span>
            </div>
            <div className="flex-1">
              <div className="h-1.5 w-full bg-card border border-border/50 overflow-hidden mb-2">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${mastery.score ?? (mastery.level ? mastery.level * 20 : 0)}%` }}
                />
              </div>
              <div className="text-[11px] text-dim tracking-widest uppercase">掌握程度节点</div>
            </div>
            {mastery.notes && <div className="text-xs text-primary/80 border-l border-primary/30 pl-4 max-w-[250px] hidden md:block leading-relaxed">{mastery.notes}</div>}
          </div>
        )}

        {/* Retrospective */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xs text-primary font-bold tracking-widest uppercase flex items-center gap-2">
               <FileText size={14}/> 系统回顾评估
             </h2>
            {retrospective && (
              <button
                className="px-4 py-1.5 bg-primary/10 border border-primary text-primary text-[11px] font-bold tracking-widest uppercase cursor-pointer transition-all hover:bg-primary hover:text-bg disabled:opacity-50"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? "重新计算中..." : "刷新数据"}
              </button>
            )}
          </div>

          {retrospective ? (
            <div className="bg-bg-subtle border border-border/50 p-6 md:p-8 text-sm leading-relaxed font-sans relative">
              <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-primary/30" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-primary/30" />
              <div className="md-content">
                <ReactMarkdown>{retrospective}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-card/40 border border-dashed border-border/50 p-10 flex flex-col items-center justify-center text-center">
              <FileText size={32} className="text-dim mb-4 opacity-50" />
              <p className="text-sm text-dim tracking-widest uppercase mb-6">
                {sessions.length === 0 ? "无可用训练数据" : "尚未生成回顾报告"}
              </p>
              {sessions.length > 0 && (
                <button
                  className="px-6 py-3 bg-primary/20 border border-primary text-primary text-xs font-bold tracking-wider uppercase hover:bg-primary hover:text-bg transition-colors disabled:opacity-50"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? "分析日志中..." : "编译回顾报告"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Session history */}
        <div className="mb-10">
          <h2 className="text-xs text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
            <Activity size={14}/> 训练日志
          </h2>
          
          {sessions.length === 0 ? (
            <div className="bg-card/40 border border-dashed border-border/50 py-10 text-center text-dim text-sm tracking-widest uppercase">
              未找到记录
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[...sessions].reverse().map((s) => {
                const scores = s.scores || [];
                const validScores = scores.map((sc) => sc.score).filter((v) => typeof v === "number");
                const avg = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : null;

                return (
                  <div
                    key={s.session_id}
                    className="flex items-center justify-between p-4 bg-bg-subtle border border-border/50 cursor-pointer transition-all hover:border-primary/50 group relative overflow-hidden"
                    onClick={() => navigate(`/review/${s.session_id}`)}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 group-hover:bg-primary/50 transition-colors" />
                    
                    <div className="flex items-center gap-6">
                      <div className="text-sm font-bold tracking-wider">{s.created_at?.slice(0, 10)}</div>
                      {avg && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs tracking-widest text-dim uppercase">评分</span>
                          <span className="text-sm font-bold" style={{ color: getScoreColor(Number(avg)) }}>{avg}/10</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-dim tracking-widest uppercase hidden sm:block">ID_{s.session_id.substring(0,8)}</span>
                      <ArrowLeft size={16} className="text-primary rotate-180 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
