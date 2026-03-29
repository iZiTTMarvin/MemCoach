"""GitHub 源接入：公开仓库解析、分支信息与归档下载。"""

from __future__ import annotations

from dataclasses import dataclass
import json
import re
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


GITHUB_API_BASE = "https://api.github.com"
GITHUB_WEB_HOSTS = {"github.com", "www.github.com"}


class GitHubSourceError(RuntimeError):
    """GitHub 源接入基类异常。"""


class GitHubUrlError(GitHubSourceError):
    """仓库 URL 非法或不支持。"""


class GitHubApiError(GitHubSourceError):
    """GitHub API 请求失败。"""


class GitHubNotFoundError(GitHubApiError):
    """仓库或分支不存在。"""


class GitHubRateLimitError(GitHubApiError):
    """GitHub API 触发限流。"""


class GitHubPrivateRepoError(GitHubApiError):
    """当前仅支持公开仓库。"""


class GitHubArchiveTooLargeError(GitHubSourceError):
    """归档体积超过上限。"""


@dataclass(frozen=True)
class GitHubRepoRef:
    """仓库唯一引用。"""

    owner: str
    repo: str

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repo}"


@dataclass(frozen=True)
class GitHubBranchInfo:
    """分支信息。"""

    name: str
    commit_sha: str
    is_default: bool = False


@dataclass(frozen=True)
class GitHubRepoInfo:
    """仓库元信息（含分支）。"""

    ref: GitHubRepoRef
    html_url: str
    description: str
    default_branch: str
    is_private: bool
    branches: list[GitHubBranchInfo]


def parse_public_github_repo_url(raw_url: str) -> GitHubRepoRef:
    """解析公开 GitHub 仓库 URL，返回 owner/repo。"""
    text = (raw_url or "").strip()
    if not text:
        raise GitHubUrlError("仓库 URL 不能为空。")

    # 支持 git@github.com:owner/repo.git
    ssh_match = re.fullmatch(r"git@github\.com:([^/\s]+)/([^/\s]+?)(?:\.git)?", text)
    if ssh_match:
        return GitHubRepoRef(owner=ssh_match.group(1), repo=ssh_match.group(2))

    # 支持 github.com/owner/repo（无 scheme）
    if text.startswith("github.com/") or text.startswith("www.github.com/"):
        text = "https://" + text

    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"}:
        raise GitHubUrlError("仅支持 http/https 的 GitHub 仓库 URL。")
    if parsed.netloc.lower() not in GITHUB_WEB_HOSTS:
        raise GitHubUrlError("当前仅支持 github.com 公开仓库。")

    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise GitHubUrlError("仓库 URL 需要包含 owner/repo。")

    owner = parts[0].strip()
    repo = parts[1].strip()
    if repo.endswith(".git"):
        repo = repo[:-4]

    if not owner or not repo:
        raise GitHubUrlError("仓库 URL 中的 owner/repo 非法。")
    if any(ch in owner for ch in "?#") or any(ch in repo for ch in "?#"):
        raise GitHubUrlError("仓库 URL 包含非法字符。")

    return GitHubRepoRef(owner=owner, repo=repo)


def fetch_repo_info(
    repo: GitHubRepoRef,
    token: str | None = None,
    timeout: int = 20,
    api_base: str = GITHUB_API_BASE,
) -> GitHubRepoInfo:
    """获取仓库基础信息和分支列表。"""
    repo_data = _get_json(
        f"{api_base}/repos/{quote(repo.owner)}/{quote(repo.repo)}",
        token=token,
        timeout=timeout,
    )
    is_private = bool(repo_data.get("private"))
    if is_private:
        raise GitHubPrivateRepoError("当前仅支持公开仓库。")

    default_branch = str(repo_data.get("default_branch") or "").strip()
    branches = fetch_repo_branches(
        repo,
        default_branch=default_branch,
        token=token,
        timeout=timeout,
        api_base=api_base,
    )
    return GitHubRepoInfo(
        ref=repo,
        html_url=str(repo_data.get("html_url") or f"https://github.com/{repo.full_name}"),
        description=str(repo_data.get("description") or ""),
        default_branch=default_branch,
        is_private=is_private,
        branches=branches,
    )


def fetch_repo_branches(
    repo: GitHubRepoRef,
    default_branch: str = "",
    token: str | None = None,
    timeout: int = 20,
    api_base: str = GITHUB_API_BASE,
) -> list[GitHubBranchInfo]:
    """获取仓库分支列表（首批最多 100）。"""
    rows = _get_json(
        f"{api_base}/repos/{quote(repo.owner)}/{quote(repo.repo)}/branches?per_page=100",
        token=token,
        timeout=timeout,
    )
    if not isinstance(rows, list):
        raise GitHubApiError("GitHub 分支响应格式非法。")

    result: list[GitHubBranchInfo] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        sha = str((row.get("commit") or {}).get("sha") or "").strip()
        if not name or not sha:
            continue
        result.append(
            GitHubBranchInfo(
                name=name,
                commit_sha=sha,
                is_default=(name == default_branch),
            )
        )
    return result


def resolve_branch_commit(
    repo: GitHubRepoRef,
    branch: str,
    token: str | None = None,
    timeout: int = 20,
    api_base: str = GITHUB_API_BASE,
) -> str:
    """解析分支对应的提交 SHA。"""
    clean_branch = (branch or "").strip()
    if not clean_branch:
        raise GitHubUrlError("分支名不能为空。")
    data = _get_json(
        f"{api_base}/repos/{quote(repo.owner)}/{quote(repo.repo)}/branches/{quote(clean_branch)}",
        token=token,
        timeout=timeout,
    )
    sha = str((data.get("commit") or {}).get("sha") or "").strip()
    if not sha:
        raise GitHubApiError("无法解析分支对应的 commit SHA。")
    return sha


def resolve_repo_from_url(
    repo_url: str,
    token: str | None = None,
    timeout: int = 20,
    api_base: str = GITHUB_API_BASE,
) -> GitHubRepoInfo:
    """从仓库 URL 直接解析完整仓库信息。"""
    ref = parse_public_github_repo_url(repo_url)
    return fetch_repo_info(ref, token=token, timeout=timeout, api_base=api_base)


def download_commit_archive(
    repo: GitHubRepoRef,
    commit_sha: str,
    output_dir: Path | str,
    token: str | None = None,
    timeout: int = 60,
    api_base: str = GITHUB_API_BASE,
    max_archive_size_bytes: int = 200 * 1024 * 1024,
) -> Path:
    """下载指定 commit 归档到本地。"""
    clean_sha = (commit_sha or "").strip()
    if not clean_sha:
        raise GitHubUrlError("commit_sha 不能为空。")

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{repo.owner}-{repo.repo}-{clean_sha[:12]}.zip"

    url = f"{api_base}/repos/{quote(repo.owner)}/{quote(repo.repo)}/zipball/{quote(clean_sha)}"
    req = _build_request(url, token)
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - 固定 GitHub API 域
            content_length = resp.headers.get("Content-Length")
            if content_length:
                try:
                    declared = int(content_length)
                    if declared > max_archive_size_bytes:
                        raise GitHubArchiveTooLargeError(
                            f"归档体积超限：{declared} > {max_archive_size_bytes}"
                        )
                except ValueError:
                    pass

            total = 0
            with zip_path.open("wb") as fw:
                while True:
                    chunk = resp.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_archive_size_bytes:
                        raise GitHubArchiveTooLargeError(
                            f"归档体积超限：{total} > {max_archive_size_bytes}"
                        )
                    fw.write(chunk)
    except GitHubArchiveTooLargeError:
        if zip_path.exists():
            zip_path.unlink(missing_ok=True)
        raise
    except HTTPError as exc:
        _raise_http_error(exc)
    except URLError as exc:
        raise GitHubApiError(f"下载归档失败：{exc.reason}") from exc

    return zip_path


def _build_request(url: str, token: str | None = None) -> Request:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "MemCoach-Project-Analysis/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return Request(url, headers=headers, method="GET")


def _get_json(url: str, token: str | None, timeout: int) -> dict[str, Any] | list[Any]:
    req = _build_request(url, token)
    try:
        with urlopen(req, timeout=timeout) as resp:  # noqa: S310 - 固定 GitHub API 域
            payload = resp.read().decode("utf-8")
            return json.loads(payload)
    except HTTPError as exc:
        _raise_http_error(exc)
    except URLError as exc:
        raise GitHubApiError(f"请求 GitHub 失败：{exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise GitHubApiError("GitHub 响应 JSON 解析失败。") from exc


def _raise_http_error(exc: HTTPError) -> None:
    code = exc.code
    if code == 404:
        raise GitHubNotFoundError("仓库或分支不存在。") from exc
    if code == 403:
        remaining = exc.headers.get("X-RateLimit-Remaining", "")
        if remaining == "0":
            raise GitHubRateLimitError("GitHub API 限流，请稍后重试。") from exc
        raise GitHubApiError("GitHub API 禁止访问（403）。") from exc
    raise GitHubApiError(f"GitHub API 请求失败：HTTP {code}") from exc

