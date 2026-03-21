import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, Terminal, Activity, Crosshair, Zap, Award } from "lucide-react";
import { getReview, getReferenceAnswer } from "../api/interview";

function getScoreColor(score) {
  if (score >= 8) return { bg: "var(--primary)", color: "var(--bg)", text: "var(--primary)", border: "var(--primary)" };
  if (score >= 6) return { bg: "var(--accent)", color: "var(--bg)", text: "var(--accent)", border: "var(--accent)" };
  if (score >= 4) return { bg: "#e2b93b", color: "var(--bg)", text: "#e2b93b", border: "#e2b93b" };
  return { bg: "transparent", color: "var(--red)", text: "var(--red)", border: "var(--red)" };
}

const DIMENSION_LABELS = {
  technical_depth: "技术深度",
  project_articulation: "项目表达",
  communication: "表达能力",
  problem_solving: "问题解决",
};

function DimensionScores({ dimensionScores, avgScore }) {
  if (!dimensionScores) return null;
  const entries = Object.entries(DIMENSION_LABELS).filter(([k]) => dimensionScores[k] != null);
  if (!entries.length) return null;

  return (
    <div className="bg-bg-subtle border border-primary/30 p-6 md:p-8 mb-8 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary" />
      <div className="absolute top-0 right-0 w-32 h-[1px] bg-gradient-to-l from-primary to-transparent" />

      <div className="flex items-center justify-between mb-8 border-b border-primary/20 pb-4">
        <h2 className="text-sm font-bold tracking-widest uppercase text-primary flex items-center gap-2">
          <Activity size={16} /> 维度解析
        </h2>
        {avgScore != null && (
          <div className="text-xs font-mono text-dim tracking-widest flex items-center gap-2">
            综合评级 <span className="font-bold text-accent px-2 py-0.5 border border-accent/30">{avgScore}/10</span>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        {entries.map(([key, label]) => {
          const score = dimensionScores[key];
          const sc = getScoreColor(score);
          return (
            <div key={key} className="flex items-center gap-4">
              <div className="w-[120px] md:w-[150px] text-[11px] text-dim text-right shrink-0 tracking-widest uppercase">{label}</div>
              <div className="flex-1 h-1.5 bg-card border border-border/50 overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-white/20 z-10 animate-[scanline_2s_linear_infinite]" />
                <div className="h-full transition-[width] duration-1000 ease-out" style={{ width: `${score * 10}%`, background: sc.text }} />
              </div>
              <div className="w-10 text-xs font-bold font-mono text-right shrink-0" style={{ color: sc.text }}>{score}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SoloRecordingReview({ topicsCovered, overall }) {
  const avgScore = overall?.avg_score || "-";
  const sc = typeof avgScore === "number" ? getScoreColor(avgScore) : { text: "var(--text)" };
  
  return (
    <div className="space-y-8 font-mono">
      {/* Overall summary */}
      <div className="bg-card border border-primary/20 p-6 md:p-8 relative">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-transparent" />
        <h2 className="text-xs text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Activity size={14} /> 总体评估
        </h2>
        <div className="flex items-end gap-3 mb-6">
          <span className="text-5xl font-black leading-none" style={{ color: sc.text }}>
            {avgScore}
          </span>
          <span className="text-sm text-dim tracking-widest pb-1">/10 评分</span>
        </div>
        {overall?.summary && (
          <div className="text-sm leading-relaxed text-text font-sans p-4 bg-bg-subtle border border-border/50 border-l-primary/30 border-l-2">{overall.summary}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weak points */}
        {overall?.new_weak_points?.length > 0 && (
          <div className="bg-bg-subtle border border-red-500/30 p-6 relative">
            <h3 className="text-xs text-red-400 font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Crosshair size={14} /> 关键漏洞
            </h3>
            <div className="flex flex-col gap-2">
              {overall.new_weak_points.map((wp, i) => (
                <div key={i} className="px-4 py-3 text-xs text-dim bg-card/50 border-l-2 border-red-500 hover:text-text transition-colors leading-relaxed font-sans">
                  {typeof wp === "string" ? wp : wp.point || JSON.stringify(wp)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strong points */}
        {overall?.new_strong_points?.length > 0 && (
          <div className="bg-bg-subtle border border-primary/30 p-6 relative">
            <h3 className="text-xs text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Award size={14} /> 验证优势
            </h3>
            <div className="flex flex-col gap-2">
              {overall.new_strong_points.map((sp, i) => (
                <div key={i} className="px-4 py-3 text-xs text-dim bg-card/50 border-l-2 border-primary hover:text-text transition-colors leading-relaxed font-sans">
                  {typeof sp === "string" ? sp : sp.point || JSON.stringify(sp)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Topics covered */}
      {topicsCovered?.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs text-dim font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
            <Database size={14} /> 触及领域
          </h3>
          <div className="space-y-4">
            {topicsCovered.map((t, i) => {
              const score = t.score;
              const tsc = typeof score === "number" ? getScoreColor(score) : { border: "var(--border)", text: "var(--text-dim)" };
              return (
                <div key={i} className="bg-card border p-5 md:p-6 transition-all hover:shadow-[0_0_15px_rgba(0,0,0,0.3)] relative overflow-hidden" style={{ borderColor: tsc.border }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: tsc.text, opacity: 0.5 }} />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                    <span className="text-sm font-bold tracking-wider uppercase">{t.topic || "未知领域"}</span>
                    <span className="text-xs font-bold px-3 py-1 border" style={{ borderColor: tsc.border, color: tsc.text }}>
                      得分: {score ?? "-"}/10
                    </span>
                  </div>
                  
                  {t.assessment && <div className="text-sm leading-relaxed text-text mb-4 font-sans">{t.assessment}</div>}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/50 pt-4 mt-2">
                    {t.understanding && (
                      <div className="text-[11px] text-dim flex flex-col gap-1">
                        <span className="uppercase tracking-widest text-primary/70">理解水平</span>
                        <span className="text-text font-sans">{t.understanding}</span>
                      </div>
                    )}
                    {t.errors?.length > 0 && (
                      <div className="text-[11px] text-red-400 flex flex-col gap-1">
                        <span className="uppercase tracking-widest opacity-70">检测到错误</span>
                        <span className="font-sans leading-relaxed">{t.errors.join(" | ")}</span>
                      </div>
                    )}
                    {t.missing?.length > 0 && (
                      <div className="text-[11px] text-dim flex flex-col gap-1 sm:col-span-2">
                        <span className="uppercase tracking-widest opacity-70">遗漏要点</span>
                        <span className="font-sans leading-relaxed">{t.missing.join(" | ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DrillReview({ scores, overall, questions, answers, topic }) {
  const answerMap = {};
  for (const a of (answers || [])) answerMap[a.question_id] = a.answer;
  const scoreMap = {};
  for (const s of (scores || [])) scoreMap[s.question_id] = s;
  const [refAnswers, setRefAnswers] = useState({});
  const [refLoading, setRefLoading] = useState({});

  const handleRefAnswer = async (qId, questionText) => {
    if (refAnswers[qId]) return;
    setRefLoading((p) => ({ ...p, [qId]: true }));
    try {
      const data = await getReferenceAnswer(topic, questionText);
      setRefAnswers((p) => ({ ...p, [qId]: data.reference_answer }));
    } catch (e) {
      setRefAnswers((p) => ({ ...p, [qId]: "生成失败: " + e.message }));
    }
    setRefLoading((p) => ({ ...p, [qId]: false }));
  };

  const avgScore = overall?.avg_score || "-";
  const sc = typeof avgScore === "number" ? getScoreColor(avgScore) : { text: "var(--text)" };

  return (
    <div className="space-y-8 font-mono">
      {/* Overall summary */}
      <div className="bg-bg-subtle border border-primary/20 p-6 md:p-8 relative">
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <h2 className="text-xs text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
          <Activity size={14} /> 演练评估
        </h2>
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-6">
          <div className="flex items-end gap-3">
            <span className="text-5xl font-black leading-none" style={{ color: sc.text }}>
              {avgScore}
            </span>
            <span className="text-sm text-dim tracking-widest pb-1">/10 均分</span>
          </div>
          <div className="flex gap-4 border border-border/50 bg-card p-2">
            <div className="flex flex-col px-3 border-r border-border/50">
              <span className="text-[10px] text-dim tracking-widest">总节点数</span>
              <span className="text-lg font-bold text-text">{questions?.length || 0}</span>
            </div>
            <div className="flex flex-col px-3">
              <span className="text-[10px] text-dim tracking-widest">已解析</span>
              <span className="text-lg font-bold text-accent">{answers?.filter((a) => a.answer).length || 0}</span>
            </div>
          </div>
        </div>
        
        {overall?.summary && (
          <div className="text-sm leading-relaxed text-text font-sans p-4 bg-card/50 border-l-2 border-primary/50">{overall.summary}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weak points */}
        {overall?.new_weak_points?.length > 0 && (
          <div className="bg-bg-subtle border border-red-500/30 p-6 relative">
            <h3 className="text-xs text-red-400 font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Crosshair size={14} /> 发现漏洞
            </h3>
            <div className="flex flex-col gap-2">
              {overall.new_weak_points.map((wp, i) => (
                <div key={i} className="px-4 py-3 text-xs text-dim bg-card/50 border-l-2 border-red-500 hover:text-text transition-colors leading-relaxed font-sans">
                  {typeof wp === "string" ? wp : wp.point || JSON.stringify(wp)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strong points */}
        {overall?.new_strong_points?.length > 0 && (
          <div className="bg-bg-subtle border border-primary/30 p-6 relative">
            <h3 className="text-xs text-primary font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Award size={14} /> 验证优势
            </h3>
            <div className="flex flex-col gap-2">
              {overall.new_strong_points.map((sp, i) => (
                <div key={i} className="px-4 py-3 text-xs text-dim bg-card/50 border-l-2 border-primary hover:text-text transition-colors leading-relaxed font-sans">
                  {typeof sp === "string" ? sp : sp.point || JSON.stringify(sp)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Per-question cards */}
      <div className="mt-8">
        <h3 className="text-xs text-dim font-bold tracking-widest uppercase mb-6 flex items-center gap-2 border-b border-border/50 pb-3">
          <Terminal size={14} /> 逐节点分析
        </h3>
        <div className="space-y-6">
          {(questions || []).map((q) => {
            const s = scoreMap[q.id] || {};
            const answer = answerMap[q.id];
            const isSkipped = !answer;
            const score = s.score;
            const qsc = typeof score === "number" ? getScoreColor(score) : { border: "var(--border)", text: "var(--text-dim)" };

            if (isSkipped) {
              return (
                <div key={q.id} className="bg-card/40 border border-dashed border-border/50 p-5 opacity-60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-opacity hover:opacity-100">
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="text-[10px] font-bold text-accent border border-accent/30 px-2 py-0.5 shrink-0">节点_{q.id}</span>
                    <span className="text-xs text-dim font-sans">{q.question.slice(0, 80)}{q.question.length > 80 ? "..." : ""}</span>
                  </div>
                  <span className="text-[10px] tracking-widest uppercase text-red-500/70 border border-red-500/20 px-2 py-1 shrink-0 bg-red-500/5">未解决</span>
                </div>
              );
            }

            return (
              <div key={q.id} className="bg-bg-subtle border p-6 relative group transition-all hover:shadow-[0_0_20px_rgba(0,0,0,0.4)]" style={{ borderColor: qsc.border }}>
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: qsc.text, opacity: 0.5 }} />
                
                {/* Q Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-4 border-b border-border/50">
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-primary border border-primary/30 bg-primary/10 px-2 py-0.5">节点_{q.id}</span>
                      {q.focus_area && <span className="text-[10px] text-dim tracking-widest uppercase bg-card border border-border px-2 py-0.5">{q.focus_area}</span>}
                    </div>
                    <div className="text-sm font-medium leading-relaxed text-text font-sans mt-2">{q.question}</div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] text-dim tracking-widest uppercase mb-1">评分</span>
                    <span className="text-lg font-bold px-3 py-1 border bg-card" style={{ borderColor: qsc.border, color: qsc.text }}>
                      {score ?? "-"}/10
                    </span>
                  </div>
                </div>

                {/* Candidate Answer */}
                <div className="mb-6 relative">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-dim/30" />
                  <div className="pl-4">
                    <div className="text-[10px] font-bold tracking-widest text-dim uppercase mb-2">捕获响应</div>
                    <div className="text-xs leading-relaxed text-dim font-sans whitespace-pre-wrap">{answer}</div>
                  </div>
                </div>

                {/* Evaluation Details */}
                <div className="bg-card border border-border/50 p-5 space-y-4">
                  {s.assessment && s.assessment !== "未作答" && (
                    <div>
                      <div className="text-[10px] tracking-widest uppercase text-primary/70 mb-1">系统评估</div>
                      <div className="text-xs leading-relaxed text-text font-sans">{s.assessment}</div>
                    </div>
                  )}

                  {s.improvement && (
                    <div className="bg-accent/5 border border-accent/20 p-3 mt-2">
                      <div className="text-[10px] tracking-widest uppercase text-accent mb-1 flex items-center gap-1.5"><Zap size={10}/> 优化建议</div>
                      <div className="text-xs leading-relaxed text-accent-light font-sans">{s.improvement}</div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-border/50 mt-4">
                    {s.understanding && s.understanding !== "未作答" && (
                       <div className="flex-1">
                        <div className="text-[10px] tracking-widest uppercase text-dim mb-1">理解程度</div>
                        <div className="text-xs text-text font-sans italic">{s.understanding}</div>
                      </div>
                    )}
                    {s.key_missing?.length > 0 && (
                      <div className="flex-1">
                        <div className="text-[10px] tracking-widest uppercase text-red-400 mb-1">缺失关键点</div>
                        <div className="text-xs text-red-300 font-sans leading-relaxed">{s.key_missing.join(" | ")}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reference Answer */}
                {topic && (
                  <div className="mt-6">
                    {refAnswers[q.id] ? (
                      <div className="border border-primary/30 bg-bg p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full pointer-events-none" />
                        <div className="text-[10px] font-bold tracking-widest text-primary mb-3 flex items-center gap-2">
                          <BookOpen size={12} /> 参考数据
                        </div>
                        <div className="md-content text-xs font-sans text-dim">
                          <ReactMarkdown>{refAnswers[q.id]}</ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="w-full py-3 border border-border/50 bg-card hover:border-primary/50 hover:text-primary transition-colors text-[10px] font-bold tracking-widest uppercase text-dim flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:border-border/50 disabled:hover:text-dim"
                        onClick={() => handleRefAnswer(q.id, q.question)}
                        disabled={refLoading[q.id]}
                      >
                        <Terminal size={14} />
                        {refLoading[q.id] ? "正在查询数据库..." : "请求参考数据"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Review() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = location.state || {};
  const isDrill = stateData.mode === "topic_drill";
  const isRecording = stateData.mode === "recording";
  const isRecordingDual = isRecording && stateData.recording_mode === "dual";

  const [review, setReview] = useState(stateData.review || null);
  const [scores, setScores] = useState(stateData.scores || null);
  const [overall, setOverall] = useState(stateData.overall || null);
  const [questions, setQuestions] = useState(stateData.questions || []);
  const [answers, setAnswers] = useState(stateData.answers || []);
  const [messages, setMessages] = useState(stateData.messages || []);
  const [mode, setMode] = useState(stateData.mode || null);
  const [topic, setTopic] = useState(stateData.topic || null);
  // eslint-disable-next-line no-unused-vars
  const [topicsCovered, setTopicsCovered] = useState(stateData.topics_covered || []);
  const [showTranscript, setShowTranscript] = useState(false);
  const [loading, setLoading] = useState(!review && !scores);

  useEffect(() => {
    if (!review && !scores) {
      setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
      getReview(sessionId)
        .then((data) => {
          setReview(data.review);
          if (data.scores) setScores(data.scores);
          if (data.questions) setQuestions(data.questions);
          if (data.transcript) {
            setMessages(data.transcript);
            if (data.mode === "topic_drill" && data.questions) {
              const ans = data.questions.map((q) => {
                const qIdx = data.transcript.findIndex(m => m.role === "assistant" && m.content === q.question);
                const next = qIdx >= 0 ? data.transcript[qIdx + 1] : null;
                return { question_id: q.id, answer: next?.role === "user" ? next.content : "" };
              });
              setAnswers(ans);
            }
          }
          if (data.mode) setMode(data.mode);
          if (data.topic) setTopic(data.topic);
          if (data.overall && Object.keys(data.overall).length) {
            setOverall(data.overall);
          } else if (data.weak_points) {
            const wp = Array.isArray(data.weak_points) ? data.weak_points : [];
            if (wp.length) setOverall((prev) => ({ ...prev, new_weak_points: wp }));
          }
        })
        .catch((err) => setReview("加载失败: " + err.message))
        .finally(() => setLoading(false));
    }
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center font-mono text-primary h-full">
        <Activity size={32} className="animate-pulse mb-4" />
        <div className="tracking-widest text-sm">正在编译评估矩阵...</div>
      </div>
    );
  }

  const showDrill = isDrill || isRecordingDual || (mode === "topic_drill" && (scores || questions.length > 0)) || (mode === "recording" && stateData.recording_mode === "dual");

  return (
    <div className="flex-1 p-6 md:p-10 lg:p-14 w-full relative z-10 text-text font-mono selection:bg-primary/30">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-primary/20 pb-6 mb-10 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary text-[10px] tracking-widest mb-3 uppercase">
              <Terminal size={12} /> {isRecording ? "音频评估" : showDrill ? "演练评估" : "简历评估"}
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text via-slate-300 to-dim">
              任务报告
            </h1>
          </div>
          <div className="text-right flex flex-col md:items-end">
            <div className="text-[10px] text-dim mb-1 tracking-widest">会话_ID</div>
            <div className="text-xs font-bold text-primary px-2 py-1 border border-primary/30 bg-primary/5">{sessionId}</div>
          </div>
        </div>

        {/* Content based on mode */}
        {isRecording && !isRecordingDual ? (
          <SoloRecordingReview topicsCovered={topicsCovered} overall={overall} />
        ) : showDrill ? (
          <DrillReview scores={scores} overall={overall} questions={questions} answers={answers} topic={topic} />
        ) : (
          <div className="space-y-8">
            <DimensionScores
              dimensionScores={stateData.dimension_scores || overall?.dimension_scores}
              avgScore={stateData.avg_score ?? overall?.avg_score}
            />
            
            <div className="bg-bg-subtle border border-border/50 p-6 md:p-8 relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-transparent opacity-50" />
              <h2 className="text-xs text-primary font-bold tracking-widest uppercase mb-6 flex items-center gap-2">
                <FileText size={14}/> 详细分析
              </h2>
              <div className="text-sm leading-relaxed text-dim font-sans md-content">
                <ReactMarkdown>{review || "暂无可用数据"}</ReactMarkdown>
              </div>
            </div>

            {messages.length > 0 && (
              <div className="mt-8">
                <button
                  className="w-full py-4 border border-border/50 bg-card hover:border-primary/50 transition-colors text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 group"
                  onClick={() => setShowTranscript(!showTranscript)}
                >
                  <Activity size={14} className="text-dim group-hover:text-primary transition-colors" />
                  <span className="text-dim group-hover:text-text transition-colors">
                    {showTranscript ? "折叠日志面板" : "展开日志面板"}
                  </span>
                </button>
                
                {showTranscript && (
                  <div className="mt-4 bg-bg border border-primary/30 p-4 md:p-6 max-h-[600px] overflow-y-auto custom-scrollbar shadow-inner relative">
                    <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                      <Terminal size={100} />
                    </div>
                    <div className="space-y-4 relative z-10">
                      {messages.map((msg, i) => (
                        <div key={i} className="flex flex-col gap-1 pb-4 border-b border-border/30 last:border-0 last:pb-0">
                          <span className="text-[10px] tracking-widest font-bold uppercase" style={{ color: msg.role === "user" ? "var(--accent)" : "var(--primary)" }}>
                            {msg.role === "user" ? "候选人节点" : "面试官节点"}:
                          </span>
                          <span className="text-xs font-sans leading-relaxed text-text">
                            {msg.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer / Back */}
        <div className="mt-12 text-center border-t border-border/50 pt-8">
          <button
            className="px-8 py-3 bg-transparent border border-primary/30 text-primary text-[10px] font-bold tracking-widest uppercase hover:bg-primary hover:text-bg transition-colors relative overflow-hidden group"
            onClick={() => navigate("/")}
          >
            <span className="absolute inset-0 bg-primary/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
            已阅 // 返回主站
          </button>
        </div>
      </div>
    </div>
  );
}
