"""项目分析任务编排与状态流转。"""

from __future__ import annotations

import tempfile
import uuid
from datetime import datetime
from pathlib import Path
import shutil

from backend.config import settings
from backend.github_connection import GitHubConnectionError, get_valid_github_access_token
from backend.project_analysis.contracts import (
    AnalysisStatus,
    EvidenceItem,
    EvidenceSourceType,
    InterviewQuestionItem,
    ModuleSummaryItem,
    ProjectAnalysisMetadata,
    ProjectAnalysisResult,
    ProjectBreakdown,
)
from backend.project_analysis.filtering import (
    ArchiveLimitError,
    FilteredTextFile,
    FilterLimits,
    PathTraversalError,
    filter_repository_text_files,
    safe_extract_zip,
)
from backend.project_analysis.github_source import (
    GitHubApiError,
    GitHubArchiveTooLargeError,
    GitHubBranchInfo,
    GitHubNotFoundError,
    GitHubPrivateRepoError,
    GitHubRepoRef,
    GitHubRateLimitError,
    GitHubUrlError,
    download_commit_archive,
    fetch_repo_info,
    parse_public_github_repo_url,
    resolve_branch_commit,
    resolve_repo_from_url,
)
from backend.storage.project_analyses import (
    create_project_analysis,
    get_project_analysis,
    save_project_analysis_result,
    update_project_analysis_status,
)

STATUS_QUEUED = AnalysisStatus.QUEUED.value
STATUS_FETCHING = AnalysisStatus.FETCHING.value
STATUS_FILTERING = AnalysisStatus.FILTERING.value
STATUS_ANALYZING = AnalysisStatus.ANALYZING.value
STATUS_COMPLETED = AnalysisStatus.COMPLETED.value
STATUS_FAILED = AnalysisStatus.FAILED.value
STATUS_CANCELLED = AnalysisStatus.CANCELLED.value


class AnalysisPipelineError(Exception):
    """项目分析管线错误，附带稳定错误码。"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def resolve_repo_preview(repo_url: str, user_id: str) -> dict:
    """解析公开仓库预览信息。"""
    token = _resolve_analysis_github_token(user_id, require_connection=False)
    try:
        repo_info = resolve_repo_from_url(repo_url, token=token)
    except GitHubUrlError as exc:
        raise AnalysisPipelineError("invalid_repo_url", str(exc)) from exc
    except GitHubPrivateRepoError as exc:
        raise AnalysisPipelineError("private_repo_unsupported", str(exc)) from exc
    except GitHubNotFoundError as exc:
        raise AnalysisPipelineError("repo_not_found", str(exc)) from exc
    except GitHubRateLimitError as exc:
        raise AnalysisPipelineError("github_rate_limited", str(exc)) from exc
    except GitHubApiError as exc:
        raise AnalysisPipelineError("github_api_error", str(exc)) from exc

    return {
        "repo": {
            "name": repo_info.ref.repo,
            "full_name": repo_info.ref.full_name,
            "default_branch": repo_info.default_branch,
            "description": repo_info.description,
            "html_url": repo_info.html_url,
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


def create_analysis_job(
    *,
    repo_url: str = "",
    repo_snapshot: dict | None = None,
    user_id: str,
    branch: str | None,
    role_summary: str,
    owned_scopes: list[str] | None = None,
    selected_scope_snapshot: list[dict] | None = None,
) -> dict:
    """创建项目分析任务。"""
    token = _resolve_analysis_github_token(user_id, require_connection=bool(repo_snapshot))
    normalized_repo_source = _normalize_repo_source(repo_url, repo_snapshot, user_id, token=token)
    repo = normalized_repo_source["repo"]
    chosen_branch = (branch or repo["default_branch"] or "main").strip()
    repo_ref = normalized_repo_source["repo_ref"]
    commit_sha = _resolve_commit(repo_ref, chosen_branch, token=token)
    analysis_id = uuid.uuid4().hex[:12]
    normalized_scope_snapshot = _normalize_scope_snapshot(selected_scope_snapshot or [])
    normalized_owned_scopes = _normalize_owned_scopes(
        owned_scopes or [item["path"] for item in normalized_scope_snapshot]
    )

    create_project_analysis(
        analysis_id=analysis_id,
        repo_url=normalized_repo_source["repo_url"],
        repo_name=repo["full_name"],
        branch=chosen_branch,
        commit_sha=commit_sha,
        role_summary=role_summary.strip(),
        owned_scopes=normalized_owned_scopes,
        repo_source=normalized_repo_source["repo_source"],
        selected_scope_snapshot=normalized_scope_snapshot,
        user_id=user_id,
    )
    record = get_analysis(analysis_id, user_id)
    if not record:
        raise AnalysisPipelineError("analysis_create_failed", "分析任务创建失败。")
    return record


def cancel_analysis_job(analysis_id: str, user_id: str) -> dict | None:
    """取消尚未结束的分析任务。"""
    record = get_analysis(analysis_id, user_id)
    if not record:
        return None
    if is_terminal_status(record.get("status", "")):
        return record
    update_project_analysis_status(
        analysis_id,
        STATUS_CANCELLED,
        user_id=user_id,
        error_code=None,
        error_message=None,
    )
    return get_analysis(analysis_id, user_id)


def run_analysis_job(analysis_id: str, user_id: str) -> None:
    """执行分析任务。"""
    record = get_analysis(analysis_id, user_id)
    if not record or record.get("status") == STATUS_CANCELLED:
        return

    temp_dir_path: Path | None = None
    try:
        update_project_analysis_status(analysis_id, STATUS_FETCHING, user_id=user_id)
        _ensure_not_cancelled(analysis_id, user_id)

        repo_ref = parse_public_github_repo_url(record["repo_url"])
        token = _resolve_analysis_github_token(
            user_id,
            require_connection=bool((record.get("repo_source") or {}).get("installation_id")),
        )
        # 使用系统临时目录，避免在项目根目录下创建文件触发 uvicorn --reload
        temp_dir_path = Path(tempfile.mkdtemp(prefix="memcoach-project-analysis-"))
        archive_path = download_commit_archive(
            repo_ref,
            record["commit_sha"],
            temp_dir_path / "archive",
            token=token,
        )

        update_project_analysis_status(analysis_id, STATUS_FILTERING, user_id=user_id)
        _ensure_not_cancelled(analysis_id, user_id)

        extracted_root = temp_dir_path / "repo"
        extracted_files = safe_extract_zip(archive_path, extracted_root)
        repo_root = _detect_repo_root(extracted_root, extracted_files)
        filtered_files, summary = filter_repository_text_files(
            repo_root,
            limits=FilterLimits(),
        )

        update_project_analysis_status(analysis_id, STATUS_ANALYZING, user_id=user_id)
        _ensure_not_cancelled(analysis_id, user_id)

        result = _build_result_payload(record, filtered_files, summary)
        save_project_analysis_result(analysis_id, result, user_id=user_id)
    except AnalysisPipelineError as exc:
        update_project_analysis_status(
            analysis_id,
            STATUS_FAILED,
            user_id=user_id,
            error_code=exc.code,
            error_message=str(exc),
        )
    except (GitHubUrlError, GitHubPrivateRepoError, GitHubNotFoundError) as exc:
        update_project_analysis_status(
            analysis_id,
            STATUS_FAILED,
            user_id=user_id,
            error_code="repo_source_error",
            error_message=str(exc),
        )
    except (GitHubRateLimitError, GitHubApiError) as exc:
        update_project_analysis_status(
            analysis_id,
            STATUS_FAILED,
            user_id=user_id,
            error_code="github_api_error",
            error_message=str(exc),
        )
    except (GitHubArchiveTooLargeError, ArchiveLimitError) as exc:
        update_project_analysis_status(
            analysis_id,
            STATUS_FAILED,
            user_id=user_id,
            error_code="archive_limit_error",
            error_message=str(exc),
        )
    except PathTraversalError as exc:
        update_project_analysis_status(
            analysis_id,
            STATUS_FAILED,
            user_id=user_id,
            error_code="archive_security_error",
            error_message=str(exc),
        )
    except Exception as exc:  # noqa: BLE001
        update_project_analysis_status(
            analysis_id,
            STATUS_FAILED,
            user_id=user_id,
            error_code="analysis_internal_error",
            error_message=str(exc),
        )
    finally:
        if temp_dir_path is not None:
            shutil.rmtree(temp_dir_path, ignore_errors=True)


def get_analysis(analysis_id: str, user_id: str) -> dict | None:
    """读取分析任务。"""
    return get_project_analysis(analysis_id, user_id=user_id)


def is_terminal_status(status: str) -> bool:
    """判断状态是否已结束。"""
    return status in {STATUS_COMPLETED, STATUS_FAILED, STATUS_CANCELLED}


def _resolve_commit(repo_ref, branch: str, token: str | None = None) -> str:
    try:
        return resolve_branch_commit(repo_ref, branch, token=token)
    except GitHubNotFoundError as exc:
        raise AnalysisPipelineError("branch_not_found", str(exc)) from exc
    except GitHubRateLimitError as exc:
        raise AnalysisPipelineError("github_rate_limited", str(exc)) from exc
    except GitHubApiError as exc:
        raise AnalysisPipelineError("commit_resolve_failed", str(exc)) from exc


def _ensure_not_cancelled(analysis_id: str, user_id: str) -> None:
    record = get_analysis(analysis_id, user_id)
    if record and record.get("status") == STATUS_CANCELLED:
        raise AnalysisPipelineError("analysis_cancelled", "分析任务已取消。")


def _normalize_owned_scopes(owned_scopes: list[str]) -> list[str]:
    normalized: list[str] = []
    for scope in owned_scopes:
        item = scope.strip()
        if item and item not in normalized:
            normalized.append(item)
    return normalized


def _normalize_scope_snapshot(selected_scope_snapshot: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    seen_paths: set[str] = set()
    for item in selected_scope_snapshot:
        path = str(item.get("path") or "").strip()
        item_type = str(item.get("type") or "").strip() or "directory"
        if not path or path in seen_paths:
            continue
        if item_type not in {"directory", "file"}:
            item_type = "directory"
        normalized.append({"path": path, "type": item_type})
        seen_paths.add(path)
    return normalized


def _normalize_repo_source(
    repo_url: str,
    repo_snapshot: dict | None,
    user_id: str,
    *,
    token: str | None = None,
) -> dict:
    if repo_snapshot:
        owner = str(repo_snapshot.get("owner") or "").strip()
        repo = str(repo_snapshot.get("repo") or "").strip()
        full_name = str(repo_snapshot.get("full_name") or "").strip()
        if (not owner or not repo) and full_name and "/" in full_name:
            owner, repo = full_name.split("/", 1)
        if not owner or not repo:
            raise AnalysisPipelineError("invalid_repo_snapshot", "仓库快照缺少 owner/repo。")

        repo_ref = GitHubRepoRef(owner=owner, repo=repo)
        try:
            repo_info = fetch_repo_info(repo_ref, token=token)
        except GitHubPrivateRepoError as exc:
            raise AnalysisPipelineError("private_repo_unsupported", str(exc)) from exc
        except GitHubNotFoundError as exc:
            raise AnalysisPipelineError("repo_not_found", str(exc)) from exc
        except GitHubRateLimitError as exc:
            raise AnalysisPipelineError("github_rate_limited", str(exc)) from exc
        except GitHubApiError as exc:
            raise AnalysisPipelineError("github_api_error", str(exc)) from exc

        html_url = str(repo_snapshot.get("html_url") or repo_info.html_url)
        return {
            "repo_ref": repo_ref,
            "repo_url": html_url,
            "repo": {
                "name": repo_info.ref.repo,
                "full_name": repo_info.ref.full_name,
                "default_branch": repo_info.default_branch,
                "description": repo_info.description,
                "html_url": html_url,
            },
            "repo_source": {
                "provider": "github",
                "owner": owner,
                "repo": repo,
                "full_name": repo_info.ref.full_name,
                "html_url": html_url,
                "installation_id": repo_snapshot.get("installation_id"),
            },
        }

    preview = resolve_repo_preview(repo_url, user_id)
    repo = preview["repo"]
    repo_ref = parse_public_github_repo_url(repo_url)
    return {
        "repo_ref": repo_ref,
        "repo_url": repo_url,
        "repo": repo,
        "repo_source": {
            "provider": "github",
            "owner": repo_ref.owner,
            "repo": repo_ref.repo,
            "full_name": repo_ref.full_name,
            "html_url": repo_url,
            "installation_id": None,
        },
    }


def _resolve_analysis_github_token(user_id: str, *, require_connection: bool) -> str | None:
    """在分析相关 GitHub 请求中优先使用用户 token。"""
    try:
        return get_valid_github_access_token(user_id)
    except GitHubConnectionError as exc:
        if not require_connection and exc.code == "github_not_connected":
            return None
        raise AnalysisPipelineError(exc.code, exc.message) from exc


def _detect_repo_root(extracted_root: Path, extracted_files: list[Path]) -> Path:
    if not extracted_files:
        return extracted_root.resolve()
    root = extracted_root.resolve()
    first = extracted_files[0].resolve()
    relative_parts = first.relative_to(root).parts
    if relative_parts:
        return root / relative_parts[0]
    return root


def _build_result_payload(record: dict, files: list[FilteredTextFile], summary) -> dict:
    owned_scopes = record.get("owned_scopes", [])
    role_summary = record.get("role_summary", "").strip()
    repo_name = record["repo_name"]
    role_hint = role_summary or "项目主要开发者"
    scope_hint = "、".join(owned_scopes) if owned_scopes else "核心模块"

    evidence = _build_evidence(files)
    top_evidence = evidence[:3]

    questions = [
        InterviewQuestionItem(
            question=f"请说明 {repo_name} 的核心功能边界，以及为什么这样拆分模块？",
            reference_answer_points=[
                "先交代业务目标和核心用户价值",
                "再解释模块边界与职责划分依据",
                "补充为什么这样拆分更利于维护或扩展",
            ],
            follow_up_directions=[
                "如果业务范围扩大一倍，模块边界会怎么调整？",
                "有没有权衡过更简单但扩展性更差的方案？",
            ],
            evidence=top_evidence or evidence[:1],
        ),
        InterviewQuestionItem(
            question=f"围绕你负责的 {scope_hint}，请讲清楚关键设计决策与取舍。",
            reference_answer_points=[
                "明确你负责的模块或目录",
                "解释设计决策时的约束和备选方案",
                "说明最终方案为什么更适合当前项目阶段",
            ],
            follow_up_directions=[
                "如果让你重做一次，什么决定会调整？",
                "有哪些你主动规避掉的复杂度？",
            ],
            evidence=top_evidence or evidence[:1],
        ),
        InterviewQuestionItem(
            question=f"如果 {repo_name} 出现线上故障或异常结果，你会如何定位和恢复？",
            reference_answer_points=[
                "先说监控/日志/现象观察入口",
                "再按模块和调用链缩小范围",
                "最后说明恢复策略和事后修复动作",
            ],
            follow_up_directions=[
                "有没有可能是跨层契约不一致导致的故障？",
                "你会补什么测试避免同类问题再发生？",
            ],
            evidence=top_evidence or evidence[:1],
        ),
        InterviewQuestionItem(
            question=f"请结合仓库证据说明 {repo_name} 的技术栈与关键依赖选择。",
            reference_answer_points=[
                "列出主要框架、语言、存储或构建工具",
                "说明为什么选择这些依赖",
                "指出这些选择带来的收益与限制",
            ],
            follow_up_directions=[
                "如果迁移技术栈，最难的地方在哪？",
                "哪些依赖是阶段性选择，不一定长期保留？",
            ],
            evidence=top_evidence or evidence[:1],
        ),
        InterviewQuestionItem(
            question=f"如果让你优先重构 {repo_name} 的一处实现，你会选哪里？为什么？",
            reference_answer_points=[
                "先点出当前最不稳或最难维护的部分",
                "解释重构的收益和风险",
                "给出渐进式改造方案，而不是推倒重来",
            ],
            follow_up_directions=[
                "如何保证重构不影响现有功能？",
                "你会先补哪些测试再动代码？",
            ],
            evidence=top_evidence or evidence[:1],
        ),
    ]

    breakdown = ProjectBreakdown(
        core_features=_infer_core_features(files, repo_name),
        key_modules=_infer_key_modules(files, owned_scopes),
        tech_stack=_infer_tech_stack(files),
        highlights=[
            f"围绕 {scope_hint} 形成了较清晰的实现边界",
            "支持从项目分析继续进入训练闭环",
        ],
        risks=[
            "跨层契约变化需要同步修改前后端与存储层",
            "大仓库仍然需要更严格的配额与缓存策略",
        ],
        ownership_alignment=[
            f"角色声明：{role_hint}",
            f"负责范围：{scope_hint}",
        ],
    )

    metadata = ProjectAnalysisMetadata(
        repo_url=record["repo_url"],
        repo_name=repo_name,
        branch=record["branch"],
        commit_sha=record["commit_sha"],
        analyzed_at=_now_iso(),
    )

    resume_draft = (
        f"负责 {scope_hint} 的设计与实现，围绕 {repo_name} 的核心功能、模块边界、异常处理与演进路径进行落地；"
        f"在项目实践中沉淀了可直接用于面试表达的设计取舍、风险控制与重构思路。"
    )

    result = ProjectAnalysisResult(
        metadata=metadata,
        questions=questions,
        breakdown=breakdown,
        resume_draft=resume_draft,
        confidence=0.75 if files else 0.35,
    )
    payload = result.model_dump(mode="json")
    payload["filter_summary"] = {
        "scanned_files": summary.scanned_files,
        "accepted_files": summary.accepted_files,
        "accepted_text_bytes": summary.accepted_text_bytes,
        "skipped_by_reason": summary.skipped_by_reason,
    }
    return payload


def _build_evidence(files: list[FilteredTextFile]) -> list[EvidenceItem]:
    prioritized = sorted(
        files,
        key=lambda item: (
            0 if item.relative_path.lower().startswith("readme") else 1,
            0 if item.relative_path.lower().endswith(("package.json", "requirements.txt", "pyproject.toml")) else 1,
            item.relative_path,
        ),
    )
    evidence: list[EvidenceItem] = []
    for file in prioritized[:8]:
        snippet = file.content[:500].strip()
        line_count = len(snippet.splitlines()) or 1
        evidence.append(
            EvidenceItem(
                source_type=_infer_source_type(file.relative_path),
                source_path=file.relative_path,
                reason=_infer_evidence_reason(file.relative_path),
                snippet=snippet,
                line_start=1,
                line_end=max(1, min(line_count, 20)),
            )
        )
    if not evidence:
        evidence.append(
            EvidenceItem(
                source_type=EvidenceSourceType.DIRECTORY,
                source_path="repository",
                reason="未获取到高价值文本文件，当前结果可信度较低。",
                snippet="",
            )
        )
    return evidence


def _infer_source_type(relative_path: str) -> EvidenceSourceType:
    lower = relative_path.lower()
    if lower.endswith(("package.json", "requirements.txt", "pyproject.toml", "pom.xml", "cargo.toml")):
        return EvidenceSourceType.DEPENDENCY
    if lower.endswith((".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".xml")):
        return EvidenceSourceType.CONFIG
    if "/" in lower:
        return EvidenceSourceType.FILE
    return EvidenceSourceType.FILE


def _infer_evidence_reason(relative_path: str) -> str:
    lower = relative_path.lower()
    if lower.startswith("readme"):
        return "README 提供了项目整体说明与使用入口。"
    if lower.endswith(("package.json", "requirements.txt", "pyproject.toml")):
        return "依赖声明文件可用于判断技术栈与关键框架选择。"
    if lower.endswith((".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs")):
        return "源码文件可直接支撑模块边界、异常处理与设计取舍分析。"
    return "该文件是理解项目结构与配置边界的重要依据。"


def _infer_core_features(files: list[FilteredTextFile], repo_name: str) -> list[str]:
    features = [f"{repo_name} 的核心业务流程"]
    lower_paths = {item.relative_path.lower() for item in files}
    if any(path.startswith("frontend/") or path.startswith("src/") for path in lower_paths):
        features.append("前端交互与结果展示")
    if any(path.startswith("backend/") or path.endswith(".py") for path in lower_paths):
        features.append("后端接口与业务编排")
    if any("docker" in path or path.endswith(("package.json", "requirements.txt", "pyproject.toml")) for path in lower_paths):
        features.append("运行配置与依赖管理")
    return features[:5]


def _infer_key_modules(files: list[FilteredTextFile], owned_scopes: list[str]) -> list[ModuleSummaryItem]:
    top_dirs: dict[str, int] = {}
    for item in files:
        top = item.relative_path.split("/", 1)[0]
        top_dirs[top] = top_dirs.get(top, 0) + 1

    modules: list[ModuleSummaryItem] = []
    for name, _count in sorted(top_dirs.items(), key=lambda pair: (-pair[1], pair[0]))[:6]:
        ownership_match = any(name in scope or scope in name for scope in owned_scopes)
        modules.append(
            ModuleSummaryItem(
                module_name=name,
                summary=f"{name} 目录包含该项目的一组关键实现与配置文件。",
                ownership_match=ownership_match if owned_scopes else None,
            )
        )
    return modules


def _infer_tech_stack(files: list[FilteredTextFile]) -> list[str]:
    stack: list[str] = []
    paths = {item.relative_path.lower() for item in files}
    if any(path.endswith(".py") for path in paths):
        stack.append("Python")
    if any(path.endswith((".js", ".jsx", ".ts", ".tsx")) for path in paths):
        stack.append("JavaScript/TypeScript")
    if "package.json" in paths:
        stack.append("Node.js")
    if any(path.endswith(("requirements.txt", "pyproject.toml")) for path in paths):
        stack.append("Python dependencies")
    if any("docker" in path for path in paths):
        stack.append("Docker")
    if not stack:
        stack.append("Unknown")
    return stack


def _now_iso() -> str:
    return datetime.now().isoformat()
