import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileCode2,
  FolderTree,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
} from "lucide-react";
import {
  getProjectAnalysisResult,
  getProjectAnalysisStatus,
  startProjectAnalysisPractice,
} from "../api/projectAnalysis";

function normalizeQuestions(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr.map((q, idx) => {
    const answerPoints =
      q.reference_answer_points || q.answer_points || q.reference_points || q.key_points || q.answerPoints || [];
    const followUps = q.follow_up_directions || q.follow_ups || q.followups || q.followUps || [];
    const evidence = q.evidence || q.sources || [];
    return {
      id: q.id || q.question_id || idx + 1,
      question: q.question || q.title || "未提供问题文本",
      answerPoints: Array.isArray(answerPoints)
        ? answerPoints
        : typeof answerPoints === "string"
          ? [answerPoints]
          : [],
      followUps: Array.isArray(followUps)
        ? followUps
        : typeof followUps === "string"
          ? [followUps]
          : [],
      evidence: Array.isArray(evidence) ? evidence : [],
    };
  });
}

function normalizeBreakdown(input) {
  const b = input || {};
  return {
    summary: b.summary || b.overview || "",
    coreFeatures: b.core_features || b.features || [],
    modules: b.key_modules || b.modules || b.module_map || [],
    techStack: b.tech_stack || b.stack || [],
    highlights: b.highlights || b.strengths || [],
    risks: b.risks || b.weaknesses || [],
  };
}

function normalizeScopeSnapshot(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((item) => ({
      path: item?.path || "",
      type: item?.type || "directory",
    }))
    .filter((item) => item.path);
}

function normalizeResult(payload) {
  const p = payload || {};
  const meta = p.metadata || p.meta || {};
  const result = p.result || p;
  const repoSource = p.repo_source || meta.repo_source || {};

  return {
    analysisId: p.analysis_id || p.id || meta.analysis_id || "",
    status: p.status || meta.status || "",
    repoName: repoSource.full_name || p.repo_name || meta.repo_name || "",
    repoUrl: repoSource.html_url || p.repo_url || meta.repo_url || "",
    repoSource,
    branch: p.branch || meta.branch || "",
    commitSha: p.commit_sha || meta.commit_sha || "",
    analysisTime:
      p.analysis_time || p.updated_at || p.completed_at || meta.analysis_time || "",
    errorCode: p.error_code || "",
    errorMessage: p.error_message || "",
    selectedScopeSnapshot: normalizeScopeSnapshot(
      p.selected_scope_snapshot || meta.selected_scope_snapshot || [],
    ),
    questions: normalizeQuestions(result.questions),
    breakdown: normalizeBreakdown(result.breakdown),
    resumeDraft:
      result.resume_draft ||
      result.project_experience ||
      result.resume ||
      "（暂无项目经历草稿）",
  };
}

function formatTime(timeString) {
  if (!timeString) return "未知";
  const dt = new Date(timeString);
  if (Number.isNaN(dt.getTime())) return timeString;
  return dt.toLocaleString();
}

function statusLabel(status) {
  const map = {
    queued: "排队中",
    fetching: "拉取仓库中",
    filtering: "过滤文件中",
    analyzing: "分析中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return map[status] || status || "未知";
}

function SectionHeader({ icon, title, right }) {
  return (
    <div className="flex items-center justify-between mb-5 border-b border-primary/20 pb-3">
      <h2 className="text-xs font-bold tracking-widest uppercase text-primary flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {right}
    </div>
  );
}

function EvidenceItem({ item, index }) {
  const file = item?.file || item?.path || item?.source || `evidence_${index + 1}`;
  const reason = item?.reason || item?.why || "";
  const snippet = item?.snippet || item?.content || "";
  const lines = item?.lines || item?.line_range || "";
  return (
    <div className="p-4 border border-border/60 bg-card/50">
      <div className="text-[11px] text-accent font-bold tracking-widest uppercase mb-2">
        来源文件: {file}
      </div>
      {reason && (
        <div className="text-xs text-dim font-sans leading-relaxed mb-2">{reason}</div>
      )}
      {lines && (
        <div className="text-[11px] text-dim tracking-widest uppercase mb-2">
          行范围: {String(lines)}
        </div>
      )}
      {snippet && (
        <pre className="text-xs text-text leading-relaxed bg-bg p-3 border border-border/50 overflow-x-auto whitespace-pre-wrap">
          {snippet}
        </pre>
      )}
    </div>
  );
}

export default function ProjectAnalysisResult() {
  const { analysisId: routeAnalysisId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [tab, setTab] = useState("questions");
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [startingPractice, setStartingPractice] = useState(false);
  const [rawPayload, setRawPayload] = useState(location.state?.result || null);
  const [expandedEvidence, setExpandedEvidence] = useState({});

  const queryId = new URLSearchParams(location.search).get("analysis_id");
  const stateId = location.state?.analysisId || location.state?.analysis_id;
  const analysisId = routeAnalysisId || stateId || queryId || "";

  const data = useMemo(() => normalizeResult(rawPayload || {}), [rawPayload]);
  const isRunning = ["queued", "fetching", "filtering", "analyzing"].includes(data.status);
  const isCompleted = data.status === "completed";

  const fetchResult = async (silent = false) => {
    if (!analysisId) return;
    if (!silent) setLoading(true);
    setRequestError("");
    try {
      const statusPayload = await getProjectAnalysisStatus(analysisId);
      const payload =
        statusPayload?.status === "completed"
          ? await getProjectAnalysisResult(analysisId)
          : statusPayload;
      setRawPayload(payload);
    } catch (err) {
      setRequestError(err.message || "加载失败");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!rawPayload && analysisId) fetchResult();
  }, [analysisId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!analysisId || !isRunning) return undefined;
    const timer = setInterval(() => fetchResult(true), 3000);
    return () => clearInterval(timer);
  }, [analysisId, isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartPractice = async () => {
    if (!analysisId) {
      navigate("/");
      return;
    }

    setStartingPractice(true);
    try {
      const payload = await startProjectAnalysisPractice(analysisId);
      const sid = payload.session_id || payload.sessionId;
      if (!sid) throw new Error("后端未返回 session_id");
      navigate(`/interview/${sid}`, { state: payload });
    } catch (err) {
      alert(`启动训练失败: ${err.message}\n已为你跳转到训练首页。`);
      navigate("/");
    } finally {
      setStartingPractice(false);
    }
  };

  if (!analysisId && !rawPayload) {
    return (
      <div className="flex-1 min-h-0 p-8 md:p-12 max-w-5xl mx-auto w-full text-text font-mono">
        <div className="bg-bg-subtle border border-red-500/40 p-8">
          <SectionHeader icon={<AlertTriangle size={14} />} title="结果加载失败" />
          <p className="text-sm leading-relaxed text-dim font-sans">
            未找到 `analysis_id`，请从项目分析流程重新进入结果页。
          </p>
          <button
            className="mt-6 px-5 py-2 border border-primary text-primary text-xs font-bold tracking-widest uppercase hover:bg-primary hover:text-bg transition-colors"
            onClick={() => navigate("/")}
          >
            返回主页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 p-6 md:p-10 max-w-6xl mx-auto w-full text-text font-mono space-y-6">
      <div className="bg-bg-subtle border border-primary/30 p-6 md:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_65%)] pointer-events-none" />
        <SectionHeader
          icon={<FileCode2 size={14} />}
          title="项目分析结果工作区"
          right={
            <span className="text-[10px] px-2 py-1 border border-primary/30 text-primary tracking-widest uppercase">
              {statusLabel(data.status)}
            </span>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-card border border-border/50 p-4">
            <div className="text-dim tracking-widest uppercase mb-2">Repo</div>
            <div className="text-text break-all">{data.repoName || data.repoUrl || "-"}</div>
            {data.repoUrl && (
              <a
                className="block mt-2 text-primary break-all hover:underline"
                href={data.repoUrl}
                target="_blank"
                rel="noreferrer"
              >
                {data.repoUrl}
              </a>
            )}
          </div>
          <div className="bg-card border border-border/50 p-4">
            <div className="text-dim tracking-widest uppercase mb-2">Branch</div>
            <div className="text-text">{data.branch || "-"}</div>
          </div>
          <div className="bg-card border border-border/50 p-4">
            <div className="text-dim tracking-widest uppercase mb-2">Commit</div>
            <div className="text-text break-all">{data.commitSha || "-"}</div>
          </div>
          <div className="bg-card border border-border/50 p-4">
            <div className="text-dim tracking-widest uppercase mb-2">Analysis Time</div>
            <div className="text-text">{formatTime(data.analysisTime)}</div>
          </div>
          <div className="bg-card border border-border/50 p-4 md:col-span-2">
            <div className="text-dim tracking-widest uppercase mb-2">Confirmed Scope</div>
            {data.selectedScopeSnapshot.length ? (
              <div className="flex flex-wrap gap-2">
                {data.selectedScopeSnapshot.map((item, index) => (
                  <span
                    key={`${item.path}-${index}`}
                    className={`inline-flex items-center gap-2 px-2 py-1 border text-[11px] ${
                      item.type === "file"
                        ? "border-border/60 text-dim bg-bg"
                        : "border-primary/40 text-primary bg-primary/10"
                    }`}
                  >
                    {item.type === "file" ? <FileCode2 size={10} /> : <FolderTree size={10} />}
                    {item.path}
                    {item.type === "directory" ? "/" : ""}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-dim">未返回用户确认范围。</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            className={`px-4 py-2 border text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-2 ${
              loading ? "border-dim text-dim" : "border-primary text-primary hover:bg-primary hover:text-bg"
            }`}
            onClick={() => fetchResult()}
            disabled={loading}
          >
            {loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            刷新结果
          </button>
          <button
            className={`px-4 py-2 border text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-2 ${
              startingPractice
                ? "border-dim text-dim"
                : "border-accent text-accent hover:bg-accent hover:text-bg"
            }`}
            onClick={handleStartPractice}
            disabled={startingPractice || isRunning}
          >
            {startingPractice ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
            进入项目答题训练
          </button>
          {isRunning && (
            <span className="text-[11px] text-dim tracking-widest uppercase flex items-center gap-2">
              <Activity size={12} className="animate-pulse text-primary" />
              分析尚未完成，训练入口将在完成后可用
            </span>
          )}
        </div>

        {requestError && (
          <div className="mt-4 text-xs text-red-400 border border-red-500/40 bg-red-500/5 p-3">
            加载错误: {requestError}
          </div>
        )}
        {data.status === "failed" && (
          <div className="mt-4 text-xs text-red-400 border border-red-500/40 bg-red-500/5 p-3">
            分析失败
            {data.errorCode ? ` [${data.errorCode}]` : ""}:{" "}
            {data.errorMessage || "请重试或返回重新发起分析。"}
          </div>
        )}
        {data.status === "cancelled" && (
          <div className="mt-4 text-xs text-dim border border-border/60 bg-card/50 p-3">
            分析任务已取消。你可以返回导入页重新开始。
          </div>
        )}
      </div>

      <div className="bg-bg-subtle border border-primary/20 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab("questions")}
            className={`px-3 py-2 text-xs font-bold tracking-widest uppercase border transition-colors ${
              tab === "questions"
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-dim hover:text-text hover:border-primary/50"
            }`}
          >
            <ClipboardList size={12} className="inline mr-2" />
            Questions
          </button>
          <button
            onClick={() => setTab("breakdown")}
            className={`px-3 py-2 text-xs font-bold tracking-widest uppercase border transition-colors ${
              tab === "breakdown"
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-dim hover:text-text hover:border-primary/50"
            }`}
          >
            <FolderTree size={12} className="inline mr-2" />
            Breakdown
          </button>
          <button
            onClick={() => setTab("resume")}
            className={`px-3 py-2 text-xs font-bold tracking-widest uppercase border transition-colors ${
              tab === "resume"
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-dim hover:text-text hover:border-primary/50"
            }`}
          >
            <Sparkles size={12} className="inline mr-2" />
            Resume Draft
          </button>
        </div>
      </div>

      {tab === "questions" && (
        <div className="space-y-4">
          {isCompleted && data.questions.length === 0 && (
            <div className="bg-card border border-border/50 p-6 text-sm text-dim">
              当前结果中暂无 Questions 数据。
            </div>
          )}
          {data.questions.map((q) => {
            const key = String(q.id);
            const open = !!expandedEvidence[key];
            return (
              <div key={key} className="bg-bg-subtle border border-border/60 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[10px] text-primary tracking-widest uppercase mb-2">
                      Question #{q.id}
                    </div>
                    <div className="text-sm leading-relaxed text-text font-sans">{q.question}</div>
                  </div>
                  <button
                    className="px-3 py-1 border border-accent/50 text-accent text-[10px] font-bold tracking-widest uppercase hover:bg-accent hover:text-bg transition-colors"
                    onClick={() =>
                      setExpandedEvidence((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                  >
                    {open ? "收起证据" : `证据 ${q.evidence.length}`}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <div className="bg-card border border-border/50 p-4">
                    <div className="text-[10px] text-dim tracking-widest uppercase mb-2">
                      参考答题点
                    </div>
                    {q.answerPoints.length ? (
                      <ul className="list-disc list-inside text-xs text-text font-sans space-y-1">
                        {q.answerPoints.map((p, idx) => (
                          <li key={`${key}-a-${idx}`}>{p}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-dim">暂无</div>
                    )}
                  </div>
                  <div className="bg-card border border-border/50 p-4">
                    <div className="text-[10px] text-dim tracking-widest uppercase mb-2">
                      追问方向
                    </div>
                    {q.followUps.length ? (
                      <ul className="list-disc list-inside text-xs text-text font-sans space-y-1">
                        {q.followUps.map((f, idx) => (
                          <li key={`${key}-f-${idx}`}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-dim">暂无</div>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
                    {q.evidence.length ? (
                      q.evidence.map((ev, idx) => (
                        <EvidenceItem key={`${key}-e-${idx}`} item={ev} index={idx} />
                      ))
                    ) : (
                      <div className="text-xs text-dim">暂无可展示证据。</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "breakdown" && (
        <div className="bg-bg-subtle border border-border/60 p-6 space-y-6">
          <SectionHeader icon={<FolderTree size={14} />} title="项目拆解报告" />

          {data.breakdown.summary && (
            <div className="text-sm text-text font-sans leading-relaxed bg-card border border-border/50 p-4">
              {data.breakdown.summary}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              ["核心功能", data.breakdown.coreFeatures],
              ["关键模块", data.breakdown.modules],
              ["技术栈", data.breakdown.techStack],
              ["亮点", data.breakdown.highlights],
              ["潜在风险", data.breakdown.risks],
            ].map(([title, values]) => (
              <div key={title} className="bg-card border border-border/50 p-4">
                <div className="text-[10px] text-primary tracking-widest uppercase mb-2">{title}</div>
                {Array.isArray(values) && values.length ? (
                  <ul className="list-disc list-inside text-xs text-text font-sans space-y-1">
                    {values.map((v, idx) => (
                      <li key={`${title}-${idx}`}>
                        {typeof v === "string" ? v : v?.module_name || v?.name || JSON.stringify(v)}
                        {typeof v === "object" && v?.summary ? `：${v.summary}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-dim">暂无</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "resume" && (
        <div className="bg-bg-subtle border border-border/60 p-6">
          <SectionHeader
            icon={<Terminal size={14} />}
            title="项目经历草稿"
            right={
              <button
                className="px-3 py-1 border border-primary/50 text-primary text-[10px] font-bold tracking-widest uppercase hover:bg-primary hover:text-bg transition-colors"
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(
                      typeof data.resumeDraft === "string"
                        ? data.resumeDraft
                        : JSON.stringify(data.resumeDraft, null, 2),
                    )
                    .then(() => alert("已复制草稿"))
                    .catch(() => alert("复制失败，请手动复制"))
                }
              >
                复制草稿
              </button>
            }
          />
          <div className="bg-card border border-border/50 p-5 text-sm text-text font-sans leading-relaxed md-content">
            {typeof data.resumeDraft === "string" ? (
              <ReactMarkdown>{data.resumeDraft}</ReactMarkdown>
            ) : (
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(data.resumeDraft, null, 2)}
              </pre>
            )}
          </div>
          {!isCompleted && (
            <div className="mt-4 text-xs text-dim flex items-center gap-2">
              <LoaderCircle size={12} className="animate-spin" />
              结果尚未完成，草稿内容可能为空或不完整。
            </div>
          )}
        </div>
      )}

      <div className="pb-6">
        <button
          className={`w-full md:w-auto px-6 py-3 border text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-2 ${
            startingPractice
              ? "border-dim text-dim"
              : "border-accent text-accent hover:bg-accent hover:text-bg"
          }`}
          onClick={handleStartPractice}
          disabled={startingPractice || !isCompleted}
        >
          {startingPractice ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
          开始项目答题训练
        </button>
      </div>

      {!isCompleted && (
        <div className="text-[11px] text-dim border border-border/60 bg-card/50 p-3 flex items-center gap-2">
          {isRunning ? <Activity size={12} className="text-primary animate-pulse" /> : <AlertTriangle size={12} />}
          当前任务状态为 {statusLabel(data.status)}，建议待完成后再进入训练。
        </div>
      )}
      {isCompleted && (
        <div className="text-[11px] text-primary border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
          <CheckCircle2 size={12} />
          分析完成，可直接进入项目答题训练。
        </div>
      )}
    </div>
  );
}
