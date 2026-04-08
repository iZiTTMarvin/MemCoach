import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  CircleCheckBig,
  FileCode2,
  FolderOpen,
  GitBranch,
  LoaderCircle,
  Search,
  Terminal,
  X,
} from "lucide-react";
import {
  ANALYSIS_STATUS,
  cancelProjectAnalysis,
  createProjectAnalysisV2,
  getProjectAnalysisStatus,
} from "../api/projectAnalysis";
import {
  disconnectGitHub,
  getGitHubConnectionStatus,
  getRepoBranches,
  getRepositories,
  getScopeCandidates,
  startGitHubConnection,
} from "../api/githubConnection";

const STEP = { CONNECT: 0, REPO: 1, SCOPE: 2, PROGRESS: 3, DONE: 4 };

const STEP_LABELS = [
  { key: STEP.CONNECT, label: "Step 1 / 连接" },
  { key: STEP.REPO, label: "Step 2 / 仓库" },
  { key: STEP.SCOPE, label: "Step 3 / 范围" },
  { key: STEP.PROGRESS, label: "Step 4 / 进度" },
  { key: STEP.DONE, label: "Step 5 / 完成" },
];

const ONGOING_STATUS = new Set([
  ANALYSIS_STATUS.QUEUED,
  ANALYSIS_STATUS.FETCHING,
  ANALYSIS_STATUS.FILTERING,
  ANALYSIS_STATUS.ANALYZING,
]);

function statusLabel(s) {
  return s || "empty";
}

function splitFullName(fn) {
  const p = (fn || "").split("/");
  return { owner: p[0] || "", repo: p[1] || "" };
}

function groupFilesByDirectory(tree, directories) {
  const nodes = Array.isArray(tree) ? tree : [];
  return directories.reduce((acc, dir) => {
    const prefix = `${dir.path}/`;
    acc[dir.path] = nodes.filter((node) => node.type === "blob" && node.path.startsWith(prefix));
    return acc;
  }, {});
}

export default function ProjectAnalysis() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState(STEP.CONNECT);

  // GitHub 连接
  const [connLoading, setConnLoading] = useState(true);
  const [connState, setConnState] = useState(null);
  const [ghUser, setGhUser] = useState(null);
  const [connError, setConnError] = useState("");
  const [cbMsg, setCbMsg] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // 仓库
  const [repos, setRepos] = useState([]);
  const [repoQuery, setRepoQuery] = useState("");
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoTotal, setRepoTotal] = useState(0);
  const [repoPage, setRepoPage] = useState(1);
  const [selectedRepo, setSelectedRepo] = useState(null);

  // 分支
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchLoading, setBranchLoading] = useState(false);

  // 范围
  const [scopeData, setScopeData] = useState(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [selectedDirs, setSelectedDirs] = useState(new Set());
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [roleSummary, setRoleSummary] = useState("");

  // 分析任务
  const [creating, setCreating] = useState(false);
  const [analysisId, setAnalysisId] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const isScopeValid = useMemo(
    () => selectedDirs.size + selectedFiles.size > 0 && roleSummary.trim().length > 0,
    [selectedDirs, selectedFiles, roleSummary],
  );
  const isRunning = ONGOING_STATUS.has(analysisStatus);
  const filesByDirectory = useMemo(
    () => groupFilesByDirectory(scopeData?.tree, scopeData?.recommended_directories || []),
    [scopeData],
  );

  // ── 初始化：callback 处理 + 连接检查 ──
  useEffect(() => {
    const ghConn = searchParams.get("github_connected");
    if (ghConn !== null) {
      if (ghConn === "1") {
        const login = searchParams.get("github_login") || "";
        setCbMsg({ type: "success", text: `GitHub 授权成功${login ? `（${login}）` : ""}` });
      } else {
        const code = searchParams.get("error_code") || "";
        const msg = searchParams.get("error_message") || "授权失败";
        setCbMsg({ type: "error", text: `GitHub 授权失败：${msg}${code ? ` (${code})` : ""}` });
      }
      setSearchParams({}, { replace: true });
    }
    checkConnection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkConnection() {
    setConnLoading(true);
    setConnError("");
    try {
      const d = await getGitHubConnectionStatus();
      if (d._httpStatus === 503 || d.configured === false) {
        setConnState("not_configured");
      } else if (d._httpStatus === 409 || !d.connected) {
        setConnState("not_connected");
      } else {
        setConnState("connected");
        setGhUser({
          login: d.github_login || "",
          name: d.github_name || "",
          avatar_url: d.github_avatar_url || "",
          installation_id: d.installation_id,
        });
        setStep(STEP.REPO);
      }
    } catch (err) {
      setConnError(err.message || "连接状态查询失败");
      setConnState("not_connected");
    } finally {
      setConnLoading(false);
    }
  }

  // ── 进入 REPO 时拉取仓库 ──
  useEffect(() => {
    if (step === STEP.REPO && connState === "connected") fetchRepos("", 1);
  }, [step, connState]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchRepos(query, page = 1) {
    setRepoLoading(true);
    setConnError("");
    try {
      const d = await getRepositories({ query: query ?? repoQuery, page, perPage: 20 });
      setRepos(d.items || []);
      setRepoTotal(d.total || 0);
      setRepoPage(d.page || 1);
    } catch (err) {
      setConnError(err.message || "仓库列表获取失败");
    } finally {
      setRepoLoading(false);
    }
  }

  // ── 分析状态轮询 ──
  useEffect(() => {
    if (!analysisId || !isRunning) return undefined;
    let timer = null;
    let cancelled = false;
    const poll = async () => {
      try {
        const p = await getProjectAnalysisStatus(analysisId);
        if (cancelled) return;
        const ns = p?.status || "";
        setAnalysisStatus(ns);
        setAnalysisMessage(p?.message || p?.progress_message || "");
        setAnalysisError(p?.error_message || "");
        if (ns === ANALYSIS_STATUS.COMPLETED) setStep(STEP.DONE);
      } catch (e) {
        if (!cancelled) {
          setAnalysisStatus(ANALYSIS_STATUS.FAILED);
          setAnalysisError(e.message || "状态轮询失败");
        }
      }
    };
    poll();
    timer = setInterval(poll, 2500);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [analysisId, isRunning]);

  // ── 操作函数 ──
  async function handleConnect() {
    setConnecting(true);
    setConnError("");
    try {
      const d = await startGitHubConnection("/project-analysis");
      if (d.authorize_url) window.location.href = d.authorize_url;
      else throw new Error("未获取到授权 URL");
    } catch (err) {
      setConnError(err.message || "发起连接失败");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await disconnectGitHub();
      setConnState("not_connected");
      setGhUser(null);
      setStep(STEP.CONNECT);
      setSelectedRepo(null);
      setBranches([]);
      setScopeData(null);
      setSelectedDirs(new Set());
      setSelectedFiles(new Set());
      setExpandedDirs(new Set());
    } catch (err) {
      setConnError(err.message || "断开连接失败");
    } finally {
      setDisconnecting(false);
    }
  }

  function handleSearchRepos(e) {
    e.preventDefault();
    fetchRepos(repoQuery, 1);
  }

  async function handleSelectRepo(repo) {
    setSelectedRepo(repo);
    setBranchLoading(true);
    setConnError("");
    setScopeData(null);
    setSelectedDirs(new Set());
    setSelectedFiles(new Set());
    setExpandedDirs(new Set());
    setAnalysisError("");
    const { owner, repo: rn } = splitFullName(repo.full_name);
    try {
      const d = await getRepoBranches(owner, rn);
      const bl = (d.branches || []).filter((b) => b.name);
      setBranches(bl);
      const def = d.default_branch || bl.find((b) => b.is_default)?.name || bl[0]?.name || "";
      setSelectedBranch(def);
      setStep(STEP.SCOPE);
      if (def) doFetchScope(owner, rn, def);
    } catch (err) {
      setConnError(err.message || "分支列表获取失败");
    } finally {
      setBranchLoading(false);
    }
  }

  async function handleBranchChange(nb) {
    setSelectedBranch(nb);
    setSelectedDirs(new Set());
    setSelectedFiles(new Set());
    setExpandedDirs(new Set());
    setScopeData(null);
    setAnalysisError("");
    if (!selectedRepo) return;
    const { owner, repo: rn } = splitFullName(selectedRepo.full_name);
    doFetchScope(owner, rn, nb);
  }

  async function doFetchScope(owner, rn, branch) {
    setScopeLoading(true);
    setAnalysisError("");
    try {
      setScopeData(await getScopeCandidates(owner, rn, branch));
    } catch (err) {
      setAnalysisError(err.message || "范围候选获取失败");
    } finally {
      setScopeLoading(false);
    }
  }

  function toggleDir(path) {
    setSelectedDirs((prev) => {
      const n = new Set(prev);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });
  }

  function toggleFile(path) {
    setSelectedFiles((prev) => {
      const n = new Set(prev);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });
  }

  function toggleExpandedDir(path) {
    setExpandedDirs((prev) => {
      const n = new Set(prev);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });
  }

  async function handleCreateAnalysis() {
    if (!selectedRepo || !isScopeValid || !selectedBranch) return;
    setCreating(true);
    setAnalysisError("");
    setAnalysisMessage("");
    const { owner, repo: rn } = splitFullName(selectedRepo.full_name);
    const snapshot = [
      ...[...selectedDirs].map((p) => ({ path: p, type: "directory" })),
      ...[...selectedFiles].map((p) => ({ path: p, type: "file" })),
    ];
    try {
      const d = await createProjectAnalysisV2({
        repoSnapshot: {
          provider: "github",
          owner,
          repo: rn,
          full_name: selectedRepo.full_name,
          html_url: selectedRepo.html_url,
          installation_id: selectedRepo.installation_id,
        },
        branch: selectedBranch,
        roleSummary: roleSummary.trim(),
        selectedScopeSnapshot: snapshot,
      });
      const cid = d?.analysis_id || d?.id || "";
      if (!cid) throw new Error("未返回 analysis_id");
      setAnalysisId(cid);
      setAnalysisStatus(d?.status || ANALYSIS_STATUS.QUEUED);
      setAnalysisMessage(d?.message || "任务已创建，等待分析");
      setStep(STEP.PROGRESS);
    } catch (err) {
      setAnalysisError(err.message || "分析任务创建失败");
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
    } catch (err) {
      setAnalysisError(err.message || "取消任务失败");
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
    navigate(`/project-analysis/${analysisId}/result`, { state: { analysisId } });
  }

  function handleResetAll() {
    setStep(connState === "connected" ? STEP.REPO : STEP.CONNECT);
    setRepoQuery("");
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranch("");
    setScopeData(null);
    setSelectedDirs(new Set());
    setSelectedFiles(new Set());
    setExpandedDirs(new Set());
    setRoleSummary("");
    setAnalysisId("");
    setAnalysisStatus("");
    setAnalysisMessage("");
    setAnalysisError("");
  }

  function handleBackToRepo() {
    setStep(STEP.REPO);
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranch("");
    setScopeData(null);
    setSelectedDirs(new Set());
    setSelectedFiles(new Set());
    setExpandedDirs(new Set());
    setAnalysisError("");
  }

  // ── 渲染 ──
  return (
    <div className="flex-1 w-full min-h-full p-6 md:p-10 lg:p-14 max-w-7xl mx-auto relative z-10 font-mono flex flex-col gap-7 text-text">
      {/* 页头 */}
      <div className="flex flex-col gap-3 border-b border-primary/20 pb-6">
        <div className="inline-flex items-center gap-2 text-sm tracking-widest uppercase px-3 py-1 border border-primary/40 bg-primary/10 text-primary w-fit">
          <Terminal size={14} />
          GitHub 项目分析官
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-300 to-accent">
          导入向导
        </h1>
        <p className="text-sm md:text-base text-dim font-sans">
          连接 GitHub → 选择仓库 → 配置范围 → 分析进度 → 完成确认
        </p>
      </div>

      {/* 步骤条 */}
      <div className="grid grid-cols-5 gap-2">
        {STEP_LABELS.map((item) => (
          <div
            key={item.key}
            className={`border px-2 py-2.5 text-xs md:text-sm tracking-widest uppercase text-center ${
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

      {/* Callback 消息 */}
      {cbMsg && (
        <div
          className={`border px-4 py-3 text-sm flex items-center justify-between gap-2 ${
            cbMsg.type === "success"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          <span>{cbMsg.text}</span>
          <button className="text-dim hover:text-text" onClick={() => setCbMsg(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══ Step 0: 连接 ═══ */}
      {step === STEP.CONNECT && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 1：GitHub 连接</h2>

          {connLoading && (
            <div className="flex items-center gap-3 text-sm text-dim py-8 justify-center">
              <LoaderCircle size={18} className="animate-spin text-primary" />
              正在检查 GitHub 连接状态…
            </div>
          )}

          {!connLoading && connState === "not_configured" && (
            <div className="border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 text-sm p-4 flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold mb-1">当前环境未配置 GitHub 连接</div>
                <div className="text-sm text-yellow-300/70">请联系管理员配置 GitHub App，或使用其他方式导入项目。</div>
              </div>
            </div>
          )}

          {!connLoading && connState === "not_connected" && (
            <>
              <p className="text-sm text-dim font-sans">
                连接你的 GitHub 账号以查看已授权的公开仓库并创建项目分析任务。
              </p>
              <div className="flex gap-3">
                <button
                  className={`px-6 py-3 text-sm font-bold tracking-widest uppercase border ${
                    connecting
                      ? "border-border/60 text-dim bg-bg cursor-not-allowed"
                      : "border-primary text-primary bg-primary/10 hover:bg-primary hover:text-bg"
                  }`}
                  disabled={connecting}
                  onClick={handleConnect}
                >
                  {connecting ? "跳转中…" : "连接 GitHub"}
                </button>
              </div>
            </>
          )}

          {connError && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">{connError}</div>
          )}
        </section>
      )}

      {/* ═══ Step 1: 仓库选择 ═══ */}
      {step === STEP.REPO && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 2：选择仓库</h2>
            {ghUser && (
              <div className="flex items-center gap-3">
                {ghUser.avatar_url && (
                  <img src={ghUser.avatar_url} alt="" className="w-7 h-7 rounded-full border border-border" />
                )}
                <span className="text-sm text-primary">{ghUser.login}</span>
                <button
                  className="text-sm text-dim hover:text-red-300 border border-border/60 px-2 py-1 uppercase tracking-widest"
                  disabled={disconnecting}
                  onClick={handleDisconnect}
                >
                  {disconnecting ? "…" : "断开"}
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSearchRepos} className="flex gap-2">
            <div className="flex-1 flex items-center border border-border bg-bg px-3">
              <Search size={14} className="text-dim" />
              <input
                className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                value={repoQuery}
                onChange={(e) => setRepoQuery(e.target.value)}
                placeholder="搜索仓库名称…"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-bold tracking-widest uppercase border border-primary text-primary bg-primary/10 hover:bg-primary hover:text-bg"
            >
              搜索
            </button>
          </form>

          {repoLoading ? (
            <div className="flex items-center gap-3 text-sm text-dim py-6 justify-center">
              <LoaderCircle size={16} className="animate-spin text-primary" />
              加载仓库列表…
            </div>
          ) : repos.length === 0 ? (
            <div className="text-sm text-dim text-center py-8">
              未找到已授权的公开仓库。请检查 GitHub App 安装配置。
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
              {repos.map((r) => (
                <button
                  key={r.id}
                  className="border border-border/70 bg-bg p-4 flex items-start gap-3 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => handleSelectRepo(r)}
                >
                  <GitBranch size={16} className="text-primary mt-1 shrink-0" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm text-text font-semibold truncate">{r.full_name}</span>
                    {r.description && <span className="text-sm text-dim truncate">{r.description}</span>}
                    <span className="text-xs text-dim">
                      默认分支: {r.default_branch} · 更新于 {new Date(r.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {repoTotal > 20 && (
            <div className="flex items-center justify-between text-sm text-dim">
              <span>共 {repoTotal} 个仓库，第 {repoPage} 页</span>
              <div className="flex gap-2">
                {repoPage > 1 && (
                  <button className="px-3 py-1 border border-border text-dim hover:text-text" onClick={() => fetchRepos(repoQuery, repoPage - 1)}>
                    上一页
                  </button>
                )}
                {repoPage * 20 < repoTotal && (
                  <button className="px-3 py-1 border border-border text-dim hover:text-text" onClick={() => fetchRepos(repoQuery, repoPage + 1)}>
                    下一页
                  </button>
                )}
              </div>
            </div>
          )}

          {branchLoading && (
            <div className="flex items-center gap-3 text-sm text-dim py-4 justify-center">
              <LoaderCircle size={16} className="animate-spin text-primary" />
              加载分支信息…
            </div>
          )}

          {connError && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">{connError}</div>
          )}
        </section>
      )}

      {/* ═══ Step 2: 范围配置 ═══ */}
      {step === STEP.SCOPE && selectedRepo && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 3：分支与范围</h2>

          <div className="border border-border/70 bg-bg p-4 flex items-start gap-3">
            <GitBranch size={18} className="text-primary mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-text font-semibold">{selectedRepo.full_name}</span>
              {selectedRepo.description && <span className="text-sm text-dim">{selectedRepo.description}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-dim tracking-widest uppercase">分析分支</label>
              <select
                className="border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-primary"
                value={selectedBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}{b.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-dim tracking-widest uppercase">项目角色（必填）</label>
              <input
                className="border border-border bg-bg px-3 py-3 text-sm outline-none focus:border-primary"
                value={roleSummary}
                onChange={(e) => setRoleSummary(e.target.value)}
                placeholder="例如：后端负责人，主导检索与状态机设计"
              />
            </div>
          </div>

          {scopeLoading ? (
            <div className="flex items-center gap-3 text-sm text-dim py-6 justify-center">
              <LoaderCircle size={16} className="animate-spin text-primary" />
              加载范围候选…
            </div>
          ) : scopeData ? (
            <div className="flex flex-col gap-4">
              {scopeData.recommended_directories?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-dim tracking-widest uppercase flex items-center gap-2">
                    <FolderOpen size={12} />
                    推荐目录（主选择）
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {scopeData.recommended_directories.map((dir) => {
                      const on = selectedDirs.has(dir.path);
                      const expanded = expandedDirs.has(dir.path);
                      const childFiles = filesByDirectory[dir.path] || [];
                      return (
                        <div
                          key={dir.path}
                          className={`border p-3 text-left transition-colors ${
                            on ? "border-primary/60 bg-primary/10" : "border-border/70 bg-bg hover:border-primary/30"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              className="flex items-start gap-3 flex-1 min-w-0"
                              onClick={() => toggleDir(dir.path)}
                            >
                              <div className={`w-4 h-4 mt-0.5 border shrink-0 flex items-center justify-center ${on ? "border-primary bg-primary text-bg" : "border-border"}`}>
                                {on && <Check size={10} />}
                              </div>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-sm text-text font-semibold">{dir.path}/</span>
                                <span className="text-xs text-dim">{dir.reason}</span>
                                <span className="text-xs text-primary">{dir.file_count} 个文件</span>
                              </div>
                            </button>
                            <button
                              type="button"
                              className="shrink-0 px-2 py-1 text-xs border border-border/60 text-dim hover:text-text"
                              onClick={() => toggleExpandedDir(dir.path)}
                            >
                              {expanded ? "收起文件" : `展开文件 ${childFiles.length}`}
                            </button>
                          </div>
                          {expanded && (
                            <div className="mt-3 pt-3 border-t border-border/40 flex flex-col gap-2">
                              {childFiles.length > 0 ? (
                                <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5">
                                  {childFiles.map((file) => {
                                    const fileSelected = selectedFiles.has(file.path);
                                    return (
                                      <button
                                        key={file.path}
                                        type="button"
                                        className={`border p-2 text-left flex items-center gap-3 transition-colors ${
                                          fileSelected
                                            ? "border-primary/60 bg-primary/10"
                                            : "border-border/60 bg-bg hover:border-primary/30"
                                        }`}
                                        onClick={() => toggleFile(file.path)}
                                      >
                                        <div className={`w-4 h-4 border shrink-0 flex items-center justify-center ${fileSelected ? "border-primary bg-primary text-bg" : "border-border"}`}>
                                          {fileSelected && <Check size={10} />}
                                        </div>
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                          <span className="text-sm text-text break-all">{file.path}</span>
                                          <span className="text-xs text-dim">从目录展开补充到文件粒度</span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-xs text-dim">该目录下暂无可直接补充选择的文本文件。</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {scopeData.important_files?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-dim tracking-widest uppercase flex items-center gap-2">
                    <FileCode2 size={12} />
                    重要文件（补充选择）
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {scopeData.important_files.map((f) => {
                      const on = selectedFiles.has(f.path);
                      return (
                        <button
                          key={f.path}
                          className={`border p-2.5 text-left flex items-center gap-3 transition-colors ${
                            on ? "border-primary/60 bg-primary/10" : "border-border/60 bg-bg hover:border-primary/30"
                          }`}
                          onClick={() => toggleFile(f.path)}
                        >
                          <div className={`w-4 h-4 border shrink-0 flex items-center justify-center ${on ? "border-primary bg-primary text-bg" : "border-border"}`}>
                            {on && <Check size={10} />}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-sm text-text">{f.path}</span>
                            <span className="text-xs text-dim">{f.reason}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(selectedDirs.size > 0 || selectedFiles.size > 0) && (
                <div className="border border-accent/30 bg-accent/5 p-3">
                  <div className="text-sm text-accent tracking-widest uppercase mb-2">已选范围</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...selectedDirs].map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-primary/40 bg-primary/10 text-primary">
                        <FolderOpen size={10} /> {p}/
                        <button className="ml-1 hover:text-red-300" onClick={() => toggleDir(p)}>×</button>
                      </span>
                    ))}
                    {[...selectedFiles].map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-border/60 bg-bg text-dim">
                        <FileCode2 size={10} /> {p}
                        <button className="ml-1 hover:text-red-300" onClick={() => toggleFile(p)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {scopeData.tree_summary && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-dim">
                    仓库树：{scopeData.tree_summary.directories} 个目录，{scopeData.tree_summary.files} 个文件
                  </div>
                  <div className="border border-border/60 bg-bg p-3 max-h-52 overflow-y-auto">
                    <div className="flex flex-col gap-1">
                      {(scopeData.tree || []).map((node) => (
                        <div
                          key={node.path}
                          className="text-xs text-dim break-all"
                          style={{ paddingLeft: `${Math.max((node.depth - 1) * 12, 0)}px` }}
                        >
                          {node.type === "tree" ? "📁" : "📄"} {node.path}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {analysisError && (
            <div className="border border-red-500/40 bg-red-500/10 text-red-300 text-sm p-3">{analysisError}</div>
          )}

          <div className="flex gap-3">
            <button
              className="px-6 py-3 text-sm font-bold tracking-widest uppercase border border-border text-dim bg-bg hover:text-text"
              onClick={handleBackToRepo}
            >
              返回仓库
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
              {creating ? "creating…" : "开始分析"}
            </button>
          </div>
        </section>
      )}

      {/* ═══ Step 3: 进度 ═══ */}
      {step === STEP.PROGRESS && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 4：分析进度</h2>
          <div className="border border-border/70 bg-bg p-4 flex flex-col gap-3">
            <div className="text-sm tracking-widest uppercase text-dim">
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
                {cancelling ? "cancelling…" : "取消任务"}
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

      {/* ═══ Step 4: 完成 ═══ */}
      {step === STEP.DONE && (
        <section className="border border-primary/20 bg-bg-subtle p-6 md:p-8 flex flex-col gap-5">
          <h2 className="text-xl font-display font-bold tracking-wide text-text">Step 5：完成确认</h2>
          <div className="border border-accent/40 bg-accent/10 text-accent px-4 py-3 text-sm flex items-center gap-2">
            <CircleCheckBig size={16} />
            分析已完成（completed）
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="border border-border bg-bg p-4">
              <div className="text-sm text-dim tracking-widest uppercase mb-2">任务 ID</div>
              <div className="text-primary break-all">{analysisId}</div>
            </div>
            <div className="border border-border bg-bg p-4">
              <div className="text-sm text-dim tracking-widest uppercase mb-2">完成状态</div>
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

      <div className="border border-border/70 bg-bg px-4 py-3 text-sm text-dim tracking-wide">
        全局状态快照：{connLoading ? "checking…" : statusLabel(analysisStatus || connState || "empty")}
      </div>
    </div>
  );
}
