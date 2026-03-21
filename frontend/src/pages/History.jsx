import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Activity, Filter, Clock } from "lucide-react";
import { getHistory, deleteSession, getInterviewTopics } from "../api/interview";

const PAGE_SIZE = 15;

function getScoreColor(score) {
  if (score >= 8) return { bg: "var(--primary)", color: "var(--bg)", border: "var(--primary)" };
  if (score >= 6) return { bg: "var(--accent)", color: "var(--bg)", border: "var(--accent)" };
  if (score >= 4) return { bg: "#e2b93b", color: "var(--bg)", border: "#e2b93b" };
  return { bg: "transparent", color: "var(--red)", border: "var(--red)" };
}

const MODE_BADGES = {
  resume: { text: "简历节点", cls: "text-accent border-accent" },
  topic_drill: { text: "专项节点", cls: "text-primary border-primary" },
  recording: { text: "音频节点", cls: "text-teal-400 border-teal-400" },
};

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modeFilter, setModeFilter] = useState("all");
  const [topicFilter, setTopicFilter] = useState("all");
  const [topics, setTopics] = useState([]);

  useEffect(() => { getInterviewTopics().then(setTopics).catch(() => {}); }, []);

  const fetchSessions = useCallback((reset) => {
    const offset = reset ? 0 : sessions.length;
    const setter = reset ? setLoading : setLoadingMore;
    setter(true);
    const mode = modeFilter === "all" ? null : modeFilter;
    const topic = topicFilter === "all" ? null : topicFilter;
    getHistory(PAGE_SIZE, offset, mode, topic)
      .then((data) => {
        setSessions((prev) => (reset ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setter(false));
  }, [modeFilter, topicFilter, sessions.length]);

  useEffect(() => { fetchSessions(true); }, [modeFilter, topicFilter]); // eslint-disable-line

  const handleModeChange = (mode) => {
    if (mode === "resume") setTopicFilter("all");
    setModeFilter(mode);
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm("确认删除此节点记录？该操作不可逆。")) return;
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert("删除失败: " + err.message);
    }
  };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center font-mono text-primary h-full">
      <Activity size={32} className="animate-pulse mb-4" />
      <div className="tracking-widest text-sm">正在检索历史日志...</div>
    </div>
  );

  const hasFilters = modeFilter !== "all" || topicFilter !== "all";

  return (
    <div className="flex-1 p-6 md:p-10 lg:p-14 w-full relative z-10 text-text font-mono selection:bg-primary/30">
      <div className="max-w-4xl mx-auto">
        
        {/* Title row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-primary/20 pb-6 mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary text-[10px] tracking-widest mb-2 uppercase">
              <Clock size={12} /> 归档数据
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text via-slate-300 to-dim">
              战斗日志
            </h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-dim mb-1 tracking-widest">总记录数</div>
            <div className="text-lg font-bold text-primary">{total}</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8 bg-bg-subtle/80 backdrop-blur-sm border border-border/50 p-4">
          <div className="flex items-center gap-2 text-xs text-dim tracking-widest uppercase">
            <Filter size={14} /> 筛选维度:
          </div>
          
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {[
              { key: "all", label: "全部记录" },
              { key: "resume", label: "简历节点" },
              { key: "topic_drill", label: "专项节点" },
              { key: "recording", label: "音频节点" },
            ].map((m) => (
              <button
                key={m.key}
                className={`px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase border transition-all cursor-pointer
                  ${modeFilter === m.key ? "bg-primary/20 text-primary border-primary" : "bg-transparent text-dim border-border/50 hover:border-primary/50 hover:text-text"}`}
                onClick={() => handleModeChange(m.key)}
              >
                {m.label}
              </button>
            ))}

            {modeFilter !== "resume" && topics.length > 0 && (
              <>
                <div className="hidden sm:block w-px h-5 bg-border mx-2" />
                <select
                  className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase bg-card text-primary border border-border/50 outline-none cursor-pointer focus:border-primary transition-colors"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                >
                  <option value="all">全领域</option>
                  {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Session list */}
        {sessions.length === 0 ? (
          <div className="bg-card/40 border border-dashed border-border/50 py-20 text-center text-dim flex flex-col items-center">
            <Activity size={32} className="mb-4 opacity-30" />
            <div className="text-sm tracking-widest uppercase">
              {hasFilters ? "未找到匹配记录" : "数据库为空 // 请启动序列"}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const badge = MODE_BADGES[s.mode] || MODE_BADGES.resume;
              const hasScore = s.avg_score != null;
              const sc = hasScore ? getScoreColor(s.avg_score) : null;

              return (
                <div
                  key={s.session_id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-bg-subtle border border-border/50 cursor-pointer transition-all hover:border-primary/50 relative overflow-hidden"
                  onClick={() => navigate(`/review/${s.session_id}`)}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 group-hover:bg-primary/50 transition-colors" />
                  
                  <div className="flex items-center gap-4 mb-3 sm:mb-0">
                    <span className={`px-2 py-0.5 border text-[10px] font-bold tracking-widest uppercase bg-transparent ${badge.cls}`}>
                      {badge.text}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-text truncate max-w-[200px] sm:max-w-[300px] uppercase tracking-wider">{s.topic || "全局上下文"}</span>
                      <span className="text-[10px] text-dim tracking-widest uppercase">ID_{s.session_id.substring(0,8)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 w-full sm:w-auto border-t sm:border-t-0 border-border/30 pt-3 sm:pt-0">
                    <span className="text-xs text-dim whitespace-nowrap hidden sm:block tracking-widest uppercase">{s.created_at?.slice(0, 16)}</span>
                    
                    <div className="flex items-center gap-4">
                      {hasScore ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-dim tracking-widest uppercase">评级</span>
                          <span className="px-2 py-0.5 border text-xs font-bold font-mono min-w-[48px] text-center" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                            {s.avg_score}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-dim tracking-widest uppercase">评级</span>
                          <span className="px-2 py-0.5 border border-border/50 text-xs text-dim bg-card min-w-[48px] text-center">
                            --
                          </span>
                        </div>
                      )}
                      
                      <button
                        className="p-1.5 bg-transparent border border-transparent text-dim hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete Record"
                        onClick={(e) => handleDelete(e, s.session_id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {sessions.length < total && (
              <button
                className="w-full py-4 mt-6 bg-card/50 border border-primary/20 text-primary hover:bg-primary/10 hover:border-primary text-xs font-bold tracking-widest uppercase transition-all"
                onClick={() => fetchSessions(false)}
                disabled={loadingMore}
              >
                {loadingMore ? "数据获取中..." : `加载更多记录 (${sessions.length}/${total})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
