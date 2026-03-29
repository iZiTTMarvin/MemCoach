const API_BASE = "/api";

export const ANALYSIS_STATUS = {
  QUEUED: "queued",
  FETCHING: "fetching",
  FILTERING: "filtering",
  ANALYZING: "analyzing",
  FAILED: "failed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
};

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function authFetch(url, options = {}) {
  const headers = authHeaders(options.headers);
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return res;
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

export async function resolveRepository(repoUrl) {
  const res = await authFetch(`${API_BASE}/project-analysis/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: repoUrl }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createProjectAnalysis({
  repoUrl,
  branch,
  roleSummary,
  ownedScopes,
}) {
  const res = await authFetch(`${API_BASE}/project-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repo_url: repoUrl,
      branch,
      role_summary: roleSummary,
      owned_scopes: ownedScopes,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getProjectAnalysisStatus(analysisId) {
  const res = await authFetch(`${API_BASE}/project-analysis/${analysisId}/status`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getProjectAnalysis(analysisId) {
  const res = await authFetch(`${API_BASE}/project-analysis/${analysisId}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function getProjectAnalysisResult(analysisId) {
  const res = await authFetch(`${API_BASE}/project-analysis/${analysisId}/result`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function cancelProjectAnalysis(analysisId) {
  const res = await authFetch(`${API_BASE}/project-analysis/${analysisId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function startProjectAnalysisPractice(analysisId) {
  const res = await authFetch(`${API_BASE}/project-analysis/${analysisId}/practice`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
