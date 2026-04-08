const API_BASE = "/api";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function rawAuthFetch(url, options = {}) {
  const headers = authHeaders(options.headers);
  return fetch(url, { ...options, headers });
}

async function parseError(res) {
  try {
    const payload = await res.json();
    if (payload?.detail) return String(payload.detail);
    return JSON.stringify(payload);
  } catch {
    return res.statusText || "Unknown error";
  }
}

/**
 * 查询 GitHub 连接状态
 * 503 → 未配置；409 → 未连接；401 → token 失效
 */
export async function getGitHubConnectionStatus() {
  const res = await rawAuthFetch(`${API_BASE}/github/connection/status`);
  if (res.status === 503) return { _httpStatus: 503, configured: false };
  if (res.status === 409) return { _httpStatus: 409, connected: false };
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  return { ...data, _httpStatus: 200 };
}

/**
 * 发起 GitHub OAuth 授权流程
 * 返回 { state, authorize_url }
 */
export async function startGitHubConnection(redirectPath = "/project-analysis") {
  const res = await rawAuthFetch(`${API_BASE}/github/connection/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_path: redirectPath }),
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/**
 * 断开 GitHub 连接
 */
export async function disconnectGitHub() {
  const res = await rawAuthFetch(`${API_BASE}/github/connection`, {
    method: "DELETE",
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/**
 * 获取已授权公开仓库列表
 */
export async function getRepositories({ query = "", page = 1, perPage = 20 } = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  params.set("page", String(page));
  params.set("per_page", String(perPage));

  const res = await rawAuthFetch(`${API_BASE}/github/repositories?${params}`);
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/**
 * 获取仓库分支列表
 */
export async function getRepoBranches(owner, repo) {
  const res = await rawAuthFetch(
    `${API_BASE}/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
  );
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/**
 * 获取范围候选（目录 + 重要文件 + 文件树）
 */
export async function getScopeCandidates(owner, repo, branch) {
  const params = new URLSearchParams({ branch });
  const res = await rawAuthFetch(
    `${API_BASE}/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/scope-candidates?${params}`,
  );
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
