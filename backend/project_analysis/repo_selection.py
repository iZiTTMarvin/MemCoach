"""GitHub 已授权仓库发现与范围候选服务。"""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from backend.github_connection import GitHubConnectionError, get_valid_github_access_token
from backend.project_analysis.github_source import (
    GITHUB_API_BASE,
    GitHubRepoRef,
    fetch_repo_info,
    resolve_branch_commit,
)
from backend.storage.github_connections import get_github_connection

IGNORED_PATH_SEGMENTS = {
    ".git",
    ".github",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    ".next",
    "vendor",
}
SOURCE_FILE_SUFFIXES = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".go",
    ".rs",
    ".rb",
    ".php",
}
IMPORTANT_FILE_PRIORITY = [
    "README.md",
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "Dockerfile",
    "docker-compose.yml",
]


def list_authorized_public_repositories(
    user_id: str,
    *,
    query: str = "",
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    """列出当前用户已授权可见的公开仓库。"""
    access_token = get_valid_github_access_token(user_id)
    connection = get_github_connection(user_id)
    if not connection:
        raise GitHubConnectionError("github_not_connected", "当前用户尚未连接 GitHub。")

    installations = connection.get("installations") or []
    if not installations and connection.get("installation_id"):
        installations = [{"id": connection["installation_id"]}]
    if not installations:
        return {"items": [], "total": 0, "page": page, "per_page": per_page}

    normalized_query = (query or "").strip().lower()
    repos: list[dict[str, Any]] = []
    for installation in installations:
        installation_id = int(installation.get("id") or 0)
        if installation_id <= 0:
            continue
        rows = list_installation_repositories(access_token, installation_id)
        for row in rows:
            if row.get("private"):
                continue
            text = " ".join(
                [
                    str(row.get("name") or ""),
                    str(row.get("full_name") or ""),
                    str(row.get("description") or ""),
                ]
            ).lower()
            if normalized_query and normalized_query not in text:
                continue
            repos.append(
                {
                    "id": row.get("id"),
                    "name": row.get("name"),
                    "full_name": row.get("full_name"),
                    "description": row.get("description") or "",
                    "html_url": row.get("html_url"),
                    "default_branch": row.get("default_branch") or "main",
                    "updated_at": row.get("updated_at"),
                    "installation_id": installation_id,
                }
            )

    repos.sort(key=lambda item: (item.get("updated_at") or "", item.get("full_name") or ""), reverse=True)
    start = max(page - 1, 0) * per_page
    end = start + per_page
    return {
        "items": repos[start:end],
        "total": len(repos),
        "page": page,
        "per_page": per_page,
    }


def get_repository_branches(user_id: str, *, owner: str, repo: str) -> dict[str, Any]:
    """获取仓库分支列表与默认分支。"""
    access_token = get_valid_github_access_token(user_id)
    repo_ref = GitHubRepoRef(owner=owner, repo=repo)
    repo_info = fetch_repo_info(repo_ref, token=access_token)
    return {
        "repo": {
            "name": repo_info.ref.repo,
            "full_name": repo_info.ref.full_name,
            "default_branch": repo_info.default_branch,
            "html_url": repo_info.html_url,
            "description": repo_info.description,
        },
        "default_branch": repo_info.default_branch,
        "branches": [
            {
                "name": branch.name,
                "commit_sha": branch.commit_sha,
                "is_default": branch.is_default,
            }
            for branch in repo_info.branches
        ],
    }


def build_scope_candidates(
    user_id: str,
    *,
    owner: str,
    repo: str,
    branch: str,
) -> dict[str, Any]:
    """基于仓库树生成目录优先、文件补充的范围候选。"""
    access_token = get_valid_github_access_token(user_id)
    repo_ref = GitHubRepoRef(owner=owner, repo=repo)
    commit_sha = resolve_branch_commit(repo_ref, branch, token=access_token)
    tree_entries = fetch_repository_tree(owner, repo, branch, access_token)
    filtered_tree = _filter_tree_entries(tree_entries)
    important_files = _collect_important_files(owner, repo, branch, access_token, filtered_tree)

    return {
        "repo": {
            "name": repo,
            "full_name": repo_ref.full_name,
        },
        "branch": branch,
        "commit_sha": commit_sha,
        "recommended_directories": _recommend_directories(filtered_tree),
        "important_files": important_files,
        "tree": _build_tree_nodes(filtered_tree),
        "tree_summary": _summarize_tree(filtered_tree),
    }


def list_installation_repositories(
    access_token: str,
    installation_id: int,
    *,
    api_base: str = GITHUB_API_BASE,
    timeout: int = 20,
) -> list[dict[str, Any]]:
    """读取某个 installation 下用户可访问的仓库列表。"""
    payload = _get_json(
        f"{api_base}/user/installations/{installation_id}/repositories?per_page=100",
        access_token,
        timeout=timeout,
    )
    if not isinstance(payload, dict):
        raise GitHubConnectionError("github_repositories_payload_invalid", "GitHub 仓库列表响应格式非法。")
    rows = payload.get("repositories") or []
    if not isinstance(rows, list):
        raise GitHubConnectionError("github_repositories_payload_invalid", "GitHub 仓库列表响应格式非法。")
    return [row for row in rows if isinstance(row, dict)]


def fetch_repository_tree(
    owner: str,
    repo: str,
    ref: str,
    access_token: str,
    *,
    api_base: str = GITHUB_API_BASE,
    timeout: int = 20,
) -> list[dict[str, Any]]:
    """获取仓库递归树。"""
    payload = _get_json(
        f"{api_base}/repos/{quote(owner)}/{quote(repo)}/git/trees/{quote(ref)}?recursive=1",
        access_token,
        timeout=timeout,
    )
    if not isinstance(payload, dict):
        raise GitHubConnectionError("github_tree_payload_invalid", "GitHub 仓库树响应格式非法。")
    rows = payload.get("tree") or []
    if not isinstance(rows, list):
        raise GitHubConnectionError("github_tree_payload_invalid", "GitHub 仓库树响应格式非法。")
    return [row for row in rows if isinstance(row, dict)]


def fetch_repository_file_text(
    owner: str,
    repo: str,
    path: str,
    ref: str,
    access_token: str,
    *,
    api_base: str = GITHUB_API_BASE,
    timeout: int = 20,
    max_bytes: int = 8000,
) -> str:
    """获取仓库文本文件内容（最多读取 max_bytes）。"""
    req = Request(
        f"{api_base}/repos/{quote(owner)}/{quote(repo)}/contents/{quote(path)}?ref={quote(ref)}",
        headers={
            "Accept": "application/vnd.github.raw+json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "MemCoach-Repo-Selection/1.0",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - 固定 GitHub API 域
            return resp.read(max_bytes).decode("utf-8", errors="replace")
    except HTTPError as exc:
        raise _map_http_error(exc) from exc
    except URLError as exc:
        raise GitHubConnectionError("github_network_error", f"GitHub 连接失败：{exc.reason}") from exc


def _collect_important_files(
    owner: str,
    repo: str,
    branch: str,
    access_token: str,
    tree_entries: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    tree_paths = {str(item.get("path") or "") for item in tree_entries if item.get("type") == "blob"}
    collected: list[dict[str, Any]] = []
    for path in IMPORTANT_FILE_PRIORITY:
        if path not in tree_paths:
            continue
        snippet = fetch_repository_file_text(owner, repo, path, branch, access_token).strip()
        collected.append(
            {
                "path": path,
                "reason": _important_file_reason(path),
                "snippet": snippet[:500],
            }
        )
    return collected


def _filter_tree_entries(tree_entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for item in tree_entries:
        path = str(item.get("path") or "")
        if not path:
            continue
        parts = path.split("/")
        if any(part in IGNORED_PATH_SEGMENTS for part in parts):
            continue
        filtered.append(item)
    return filtered


def _recommend_directories(tree_entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    score_map: dict[str, dict[str, Any]] = defaultdict(lambda: {"path": "", "score": 0, "file_count": 0})
    for item in tree_entries:
        if item.get("type") != "blob":
            continue
        path = str(item.get("path") or "")
        if "/" not in path:
            continue
        top = path.split("/", 1)[0]
        suffix = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
        entry = score_map[top]
        entry["path"] = top
        entry["file_count"] += 1
        entry["score"] += 10 if suffix in SOURCE_FILE_SUFFIXES else 2

    result = sorted(score_map.values(), key=lambda item: (-item["score"], item["path"]))
    return [
        {
            "path": item["path"],
            "reason": f"目录下包含 {item['file_count']} 个可分析文件，适合作为负责范围主选择。",
            "file_count": item["file_count"],
        }
        for item in result[:6]
    ]


def _build_tree_nodes(tree_entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    for item in tree_entries:
        path = str(item.get("path") or "")
        if not path:
            continue
        parent_path = path.rsplit("/", 1)[0] if "/" in path else ""
        nodes.append(
            {
                "path": path,
                "name": path.rsplit("/", 1)[-1],
                "type": item.get("type") or "blob",
                "parent_path": parent_path,
                "depth": path.count("/") + 1,
                "size": item.get("size"),
            }
        )
    nodes.sort(key=lambda item: (item["depth"], item["path"]))
    return nodes


def _summarize_tree(tree_entries: list[dict[str, Any]]) -> dict[str, int]:
    files = sum(1 for item in tree_entries if item.get("type") == "blob")
    directories = sum(1 for item in tree_entries if item.get("type") == "tree")
    return {
        "files": files,
        "directories": directories,
        "entries": len(tree_entries),
    }


def _important_file_reason(path: str) -> str:
    reasons = {
        "README.md": "README 用于快速理解仓库目标与模块入口。",
        "package.json": "依赖声明有助于识别前端或 Node.js 技术栈。",
        "pyproject.toml": "构建配置可反映 Python 项目结构与依赖。",
        "requirements.txt": "依赖文件可辅助判断 Python 服务边界。",
        "Dockerfile": "容器构建文件可帮助识别部署与运行入口。",
        "docker-compose.yml": "编排文件有助于识别多服务结构。",
    }
    return reasons.get(path, "关键文件可辅助判断负责范围与技术栈。")


def _get_json(url: str, access_token: str, *, timeout: int) -> dict[str, Any] | list[Any]:
    req = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "MemCoach-Repo-Selection/1.0",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - 固定 GitHub API 域
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        raise _map_http_error(exc) from exc
    except URLError as exc:
        raise GitHubConnectionError("github_network_error", f"GitHub 连接失败：{exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise GitHubConnectionError("github_invalid_json", "GitHub 响应不是合法 JSON。") from exc


def _map_http_error(exc: HTTPError) -> GitHubConnectionError:
    if exc.code == 404:
        return GitHubConnectionError("github_not_found", "GitHub 资源不存在。")
    if exc.code == 403:
        return GitHubConnectionError("github_forbidden", "GitHub 拒绝访问当前请求。")
    if exc.code == 401:
        return GitHubConnectionError("github_unauthorized", "GitHub 认证失败，请重新连接。")
    return GitHubConnectionError("github_http_error", f"GitHub 请求失败：HTTP {exc.code}")
