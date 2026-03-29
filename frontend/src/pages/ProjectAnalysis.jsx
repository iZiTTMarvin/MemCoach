import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, GitBranch, LoaderCircle, CircleCheckBig } from "lucide-react";
import {
  ANALYSIS_STATUS,
  cancelProjectAnalysis,
  createProjectAnalysis,
  getProjectAnalysisStatus,
  resolveRepository,
} from "../api/projectAnalysis";

const STEP = {
  INPUT: 1,
  SCOPE: 2,
  PROGRESS: 3,
  DONE: 4,
};

const ONGOING_STATUS = new Set([
  ANALYSIS_STATUS.QUEUED,
  ANALYSIS_STATUS.FETCHING,
  ANALYSIS_STATUS.FILTERING,
  ANALYSIS_STATUS.ANALYZING,
]);

function parseBranches(payload) {
  const raw = payload?.branches || [];
  const branches = raw
    .map((item) => {
      if (typeof item === "string") return { name: item, is_default: false };
      return {
        name: item?.name || "",
        is_default: Boolean(item?.is_default),
      };
    })
    .filter((item) => item.name);
  return branches;
}

function parseResolvedRepository(payload) {
  const repo = payload?.repo || payload?.repository || {};
  const branches = parseBranches(payload);
  const defaultBranch =
    repo?.default_branch ||
    payload?.default_branch ||
    branches.find((item) => item.is_default)?.name ||
    branches[0]?.name ||
    "";
  return {
    repoName: repo?.full_name || repo?.name || "Unknown Repository",
    defaultBranch,
    branches,
  };
}

function toOwnedScopes(text) {
  return text
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusLabel(status) {
  if (!status) return "empty";
  return status;
}

export default function ProjectAnalysis() {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP.INPUT);
  const [repoUrl, setRepoUrl] = useState("");
  const [validating, setValidating] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [resolvedRepo, setResolvedRepo] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [roleSummary, setRoleSummary] = useState("");
  const [ownedScopesText, setOwnedScopesText] = useState("");
  const [creating, setCreating] = useState(false);
  const [analysisId, setAnalysisId] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const isScopeValid = useMemo(
    () => roleSummary.trim().length > 0 && toOwnedScopes(ownedScopesText).length > 0,
    [roleSummary, ownedScopesText],
  );

  const isRunning = ONGOING_STATUS.has(analysisStatus);

  useEffect(() => {
    if (!analysisId || !isRunning) return undefined;

    let timer = null;
    let cancelled = false;

    const poll = async () => {
      try {
        const payload = await getProjectAnalysisStatus(analysisId);
        if (cancelled) return;

        const nextStatus = payload?.status || "";
        setAnalysisStatus(nextStatus);
        setAnalysisMessage(payload?.message || payload?.progress_message || "");
        setAnalysisError(payload?.error_message || "");

        if (nextStatus === ANALYSIS_STATUS.COMPLETED) {
          setStep(STEP.DONE);
        }
      } catch (error) {
        if (!cancelled) {
          setAnalysisStatus(ANALYSIS_STATUS.FAILED);
          setAnalysisError(error.message || "状态轮询失败");
        }
      }
    };

    poll();
    timer = setInterval(poll, 2500);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [analysisId, isRunning]);

  async function handleValidateRepo() {
    if (!repoUrl.trim()) return;

    setValidating(true);
    setResolveError("");
    setAnalysisError("");

    try {
      const payload = await resolveRepository(repoUrl.trim());
      const parsed = parseResolvedRepository(payload);
      if (!parsed.defaultBranch) throw new Error("未获取到可用分支");

      setResolvedRepo(parsed);
      setSelectedBranch(parsed.defaultBranch);
      setStep(STEP.SCOPE);
    } catch (error) {
      setResolveError(error.message || "仓库解析失败");
    } finally {
      setValidating(false);
    }
  }

  async function handleCreateAnalysis() {
    if (!resolvedRepo || !isScopeValid || !selectedBranch) return;
    setCreating(true);
    setAnalysisError("");
    setAnalysisMessage("");

    try {
      const payload = await createProjectAnalysis({
        repoUrl: repoUrl.trim(),
        branch: selectedBranch,
        roleSummary: roleSummary.trim(),
        ownedScopes: toOwnedScopes(ownedScopesText),
      });

      const createdId = payload?.analysis_id || payload?.id || "";
      if (!createdId) throw new Error("未返回 analysis_id");

      setAnalysisId(createdId);
      const createdStatus = payload?.status || ANALYSIS_STATUS.QUEUED;
      setAnalysisStatus(createdStatus);
      setAnalysisMessage(payload?.message || "任务已创建，等待分析");
      setStep(STEP.PROGRESS);
    } catch (error) {
      setAnalysisError(error.message || "分析任务创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleCancelAnalysis() {
    if (!analysisId || !isRunning) return;
    setCancelling(true);
    try {
      await cancelProjectAnalysis(analysisId);
      setAnalysisStatus(ANALYSIS_STATUS.CANCELLED);
      setAnalysisMessage("任务已取消");
    } catch (error) {
      setAnalysisError(error.message || "取消任务失败");
    } finally {
      setCancelling(false);
    }
  }

  function handleRestartFromScope() {
    setStep(STEP.SCOPE);
    setAnalysisId("");
    setAnalysisStatus("");
    setAnalysisMessage("");
    setAnalysisError("");
  }

  function handleOpenResultWorkspace() {
    if (!analysisId) return;
    navigate(`/project-analysis/${analysisId}/result`, {
      state: { analysisId },
    });
  }

  function handleResetAll() {
    setStep(STEP.INPUT);
    setRepoUrl("");
    setResolveError("");
    setResolvedRepo(null);
    setSelectedBranch("");
    setRoleSummary("");
    setOwnedScopesText("");
    setAnalysisId("");
    setAnalysisStatus("");
    setAnalysisMessage("");
    setAnalysisError("");
  }

  return (
    <div className="flex-1 w-full min-h-full p-6 md:p-10 lg:p-14 max-w-7xl mx-auto relative z-10 font-mono flex flex-col gap-7 text-text">
      <div className="flex flex-col gap-3 border-b border-primary/20 pb-6">
        <div className="inline-flex items-center gap-2 text-xs tracking-widest uppercase px-3 py-1 border border-primary/40 bg-primary/10 text-primary w-fit">
          <Terminal size={14} />
          GitHub 项目分析官
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent">
          导入向导
        </h1>
        <p className="text-sm md:text-base text-dim font-sans">
          4 步流程：仓库输入 → 分支与范围 → 分析进度 → 完成确认
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: STEP.INPUT, label: "Step 1 / 输入" },
          { key: STEP.SCOPE, label: "Step 2 / 范围" },
          { key: STEP.PROGRESS, label: "Step 3 / 进度" },
          { key: STEP.DONE, label: "Step 4 / 完成" },
        ].map((item) => (
          <div
            key={item.key}
            className={`border px-3 py-3 text-xs tracking-widest uppercase ${
              step === item.key
                ? "border-primary bg-primary/15 text-primary"
                : step > item.key
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border/60 bg-bg-subtle text-dim"
            }`}
          >
            {item.label}
          </div>
        ))}
      </div>

      {step === STEP.INPUT && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 1：仓库输入</h2>
          <p className="text-sm text-dim font-sans">
            仅支持公开 GitHub 仓库 URL。示例：`https://github.com/owner/repo`
          </p>

          <div className="flex flex-col gap-3">
            <label className="text-xs text-dim tracking-widest uppercase">仓库地址</label>
            <input
              className="w-full border border-border bg-bg px-4 py-3 text-sm outline-none focus:border-primary"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </div>

          {resolveError && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">
              解析失败：{resolveError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              className={`px-6 py-3 text-sm font-bold tracking-widest uppercase border ${
                !repoUrl.trim() || validating
                  ? "border-border/60 text-dim bg-bg cursor-not-allowed"
                  : "border-primary text-primary bg-primary/10 hover:bg-primary hover:text-bg"
              }`}
              disabled={!repoUrl.trim() || validating}
              onClick={handleValidateRepo}
            >
              {validating ? "validating" : "验证仓库"}
            </button>
          </div>

          <div className="border border-border/60 bg-bg p-3 text-xs text-dim tracking-wide">
            当前状态：{validating ? "validating" : "empty"}
          </div>
        </section>
      )}

      {step === STEP.SCOPE && resolvedRepo && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 2：分支与范围</h2>

          <div className="border border-border/70 bg-bg p-4 flex items-start gap-3">
            <GitBranch size={18} className="text-primary mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-text font-semibold">{resolvedRepo.repoName}</span>
              <span className="text-xs text-dim">
                默认分支已预选：{resolvedRepo.defaultBranch}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-dim tracking-widest uppercase">分析分支</label>
              <select
                className="border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-primary"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                {resolvedRepo.branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}{branch.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-dim tracking-widest uppercase">项目角色（必填）</label>
              <input
                className="border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-primary"
                value={roleSummary}
                onChange={(e) => setRoleSummary(e.target.value)}
                placeholder="例如：后端负责人，主导检索与状态机设计"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-dim tracking-widest uppercase">负责模块 / 目录（必填）</label>
            <textarea
              className="border border-border bg-bg px-3 py-3 text-sm min-h-[120px] outline-none focus:border-primary"
              value={ownedScopesText}
              onChange={(e) => setOwnedScopesText(e.target.value)}
              placeholder={"示例：\nbackend/graphs\nbackend/indexer.py\nfrontend/src/pages/Home.jsx"}
            />
            <span className="text-xs text-dim">支持换行或逗号分隔。至少填写 1 项。</span>
          </div>

          {analysisError && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">
              提交失败：{analysisError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="px-6 py-3 text-sm font-bold tracking-widest uppercase border border-border text-dim bg-bg hover:text-text"
              onClick={handleResetAll}
            >
              返回输入
            </button>
            <button
              className={`px-6 py-3 text-sm font-bold tracking-widest uppercase border ${
                !isScopeValid || creating
                  ? "border-border/60 text-dim bg-bg cursor-not-allowed"
                  : "border-primary text-primary bg-primary/10 hover:bg-primary hover:text-bg"
              }`}
              disabled={!isScopeValid || creating}
              onClick={handleCreateAnalysis}
            >
              {creating ? "creating" : "开始分析"}
            </button>
          </div>
        </section>
      )}

      {step === STEP.PROGRESS && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 3：分析进度</h2>

          <div className="border border-border/70 bg-bg p-4 flex flex-col gap-3">
            <div className="text-xs tracking-widest uppercase text-dim">
              analysis_id: <span className="text-primary">{analysisId || "-"}</span>
            </div>
            <div className="text-sm text-text">
              当前状态：<span className="font-bold text-primary">{statusLabel(analysisStatus)}</span>
            </div>
            {analysisMessage && <div className="text-sm text-dim">{analysisMessage}</div>}
          </div>

          {isRunning && (
            <div className="border border-primary/30 bg-primary/10 px-4 py-3 text-primary text-sm flex items-center gap-2">
              <LoaderCircle size={16} className="animate-spin" />
              状态轮询中：queued / running
            </div>
          )}

          {(analysisStatus === ANALYSIS_STATUS.FAILED || analysisStatus === ANALYSIS_STATUS.CANCELLED) && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">
              {analysisStatus === ANALYSIS_STATUS.CANCELLED ? "任务已取消。" : "任务失败。"}
              {analysisError ? ` ${analysisError}` : ""}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {isRunning && (
              <button
                className={`px-6 py-3 text-sm font-bold tracking-widest uppercase border ${
                  cancelling
                    ? "border-border/60 text-dim bg-bg cursor-not-allowed"
                    : "border-red-500/60 text-red-300 bg-red-500/10 hover:bg-red-500/20"
                }`}
                disabled={cancelling}
                onClick={handleCancelAnalysis}
              >
                {cancelling ? "cancelling" : "取消任务"}
              </button>
            )}

            {(analysisStatus === ANALYSIS_STATUS.FAILED || analysisStatus === ANALYSIS_STATUS.CANCELLED) && (
              <button
                className="px-6 py-3 text-sm font-bold tracking-widest uppercase border border-primary text-primary bg-primary/10 hover:bg-primary hover:text-bg"
                onClick={handleRestartFromScope}
              >
                返回上一步重试
              </button>
            )}
          </div>
        </section>
      )}

      {step === STEP.DONE && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 4：完成确认</h2>
          <div className="border border-accent/40 bg-accent/10 text-accent px-4 py-3 text-sm flex items-center gap-2">
            <CircleCheckBig size={16} />
            分析已完成（completed）
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-border bg-bg p-4">
              <div className="text-xs text-dim tracking-widest uppercase mb-2">任务 ID</div>
              <div className="text-primary break-all">{analysisId}</div>
            </div>
            <div className="border border-border bg-bg p-4">
              <div className="text-xs text-dim tracking-widest uppercase mb-2">完成状态</div>
              <div className="text-primary">{analysisStatus}</div>
            </div>
          </div>

          <div className="border border-border/60 bg-bg p-4 text-sm text-dim font-sans">
            分析任务已经完成。你现在可以进入结果工作区查看问题、拆解报告和项目经历草稿。
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="px-6 py-3 text-sm font-bold tracking-widest uppercase border border-accent text-accent bg-accent/10 hover:bg-accent hover:text-bg inline-flex items-center gap-2"
              onClick={handleOpenResultWorkspace}
            >
              <CircleCheckBig size={14} />
              打开结果工作区
            </button>
            <button
              className="px-6 py-3 text-sm font-bold tracking-widest uppercase border border-primary text-primary bg-primary/10 hover:bg-primary hover:text-bg"
              onClick={handleResetAll}
            >
              继续导入新项目
            </button>
          </div>
        </section>
      )}

      <div className="border border-border/70 bg-bg px-4 py-3 text-xs text-dim tracking-wide">
        全局状态快照：{validating ? "validating" : statusLabel(analysisStatus || "empty")}
      </div>
    </div>
  );
}
