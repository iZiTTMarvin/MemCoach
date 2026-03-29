"""仓库归档过滤：安全解压、文本筛选与限制校验。"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
import zipfile


class FilteringError(RuntimeError):
    """过滤流程基类异常。"""


class PathTraversalError(FilteringError):
    """归档中存在路径穿越风险。"""


class ArchiveLimitError(FilteringError):
    """归档内容触发限制。"""


DEFAULT_IGNORED_DIR_NAMES = {
    ".git",
    "node_modules",
    "vendor",
    "dist",
    "build",
    "target",
    "out",
    ".next",
    ".nuxt",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".idea",
    ".vscode",
    ".gradle",
    ".terraform",
    "coverage",
}

DEFAULT_IGNORED_SUFFIXES = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".webp",
    ".svgz",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".7z",
    ".rar",
    ".mp3",
    ".wav",
    ".mp4",
    ".mov",
    ".avi",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".class",
    ".jar",
    ".pyc",
    ".pyo",
    ".o",
    ".a",
    ".bin",
}

HIGH_VALUE_SUFFIXES = {
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
    ".cs",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".scala",
    ".kt",
    ".swift",
    ".sql",
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".xml",
    ".html",
    ".css",
    ".sh",
    ".dockerfile",
}

HIGH_VALUE_FILENAMES = {
    "readme",
    "readme.md",
    "license",
    "license.md",
    "makefile",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".gitignore",
    "pyproject.toml",
    "requirements.txt",
    "package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
}


@dataclass(frozen=True)
class FilterLimits:
    """过滤限制。"""

    max_total_text_bytes: int = 20 * 1024 * 1024
    max_single_file_bytes: int = 2 * 1024 * 1024
    max_text_files: int = 2000
    max_archive_members: int = 20000


@dataclass(frozen=True)
class FilteredTextFile:
    """过滤后的文本文件。"""

    absolute_path: Path
    relative_path: str
    size_bytes: int
    content: str


@dataclass
class FilterSummary:
    """过滤摘要，用于错误分析和可观测性。"""

    scanned_files: int = 0
    accepted_files: int = 0
    accepted_text_bytes: int = 0
    skipped_by_reason: dict[str, int] = field(default_factory=dict)

    def add_skip(self, reason: str) -> None:
        self.skipped_by_reason[reason] = self.skipped_by_reason.get(reason, 0) + 1


def safe_extract_zip(
    zip_path: Path | str,
    destination: Path | str,
    limits: FilterLimits | None = None,
) -> list[Path]:
    """安全解压 zip，阻止路径穿越。"""
    lim = limits or FilterLimits()
    src = Path(zip_path)
    dst = Path(destination)
    dst.mkdir(parents=True, exist_ok=True)

    extracted: list[Path] = []
    with zipfile.ZipFile(src, "r") as zf:
        members = zf.infolist()
        if len(members) > lim.max_archive_members:
            raise ArchiveLimitError(
                f"归档文件数超限：{len(members)} > {lim.max_archive_members}"
            )

        for member in members:
            filename = member.filename.replace("\\", "/")
            if not filename:
                continue
            rel = PurePosixPath(filename)
            if rel.is_absolute():
                raise PathTraversalError(f"归档包含绝对路径：{filename}")
            if any(part == ".." for part in rel.parts):
                raise PathTraversalError(f"归档包含路径穿越：{filename}")

            out_path = (dst / Path(*rel.parts)).resolve()
            _ensure_within_base(dst.resolve(), out_path)

            if member.is_dir():
                out_path.mkdir(parents=True, exist_ok=True)
                continue

            out_path.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member, "r") as src_f, out_path.open("wb") as dst_f:
                while True:
                    chunk = src_f.read(1024 * 1024)
                    if not chunk:
                        break
                    dst_f.write(chunk)
            extracted.append(out_path)
    return extracted


def filter_repository_text_files(
    extracted_root: Path | str,
    limits: FilterLimits | None = None,
) -> tuple[list[FilteredTextFile], FilterSummary]:
    """过滤仓库目录，仅保留高价值文本文件。"""
    lim = limits or FilterLimits()
    root = Path(extracted_root).resolve()
    summary = FilterSummary()
    result: list[FilteredTextFile] = []

    for file_path in sorted(root.rglob("*")):
        if not file_path.is_file():
            continue
        summary.scanned_files += 1

        rel_posix = PurePosixPath(file_path.relative_to(root).as_posix())
        skip_reason = _should_skip_by_path(rel_posix)
        if skip_reason:
            summary.add_skip(skip_reason)
            continue

        size = file_path.stat().st_size
        if size > lim.max_single_file_bytes:
            summary.add_skip("file_too_large")
            continue

        if not _is_high_value_text_path(rel_posix):
            summary.add_skip("low_signal_path")
            continue

        sample = file_path.read_bytes()[:4096]
        if is_probably_binary(sample):
            summary.add_skip("binary_content")
            continue

        if summary.accepted_files + 1 > lim.max_text_files:
            raise ArchiveLimitError(
                f"文本文件数量超限：{summary.accepted_files + 1} > {lim.max_text_files}"
            )
        if summary.accepted_text_bytes + size > lim.max_total_text_bytes:
            raise ArchiveLimitError(
                f"文本总大小超限：{summary.accepted_text_bytes + size} > {lim.max_total_text_bytes}"
            )

        content = _read_text(file_path)
        result.append(
            FilteredTextFile(
                absolute_path=file_path,
                relative_path=rel_posix.as_posix(),
                size_bytes=size,
                content=content,
            )
        )
        summary.accepted_files += 1
        summary.accepted_text_bytes += size

    return result, summary


def is_probably_binary(data: bytes) -> bool:
    """基于内容样本判断是否二进制。"""
    if not data:
        return False
    if b"\x00" in data:
        return True
    text_like = sum(
        1
        for b in data
        if b in b"\t\n\r\f\b" or 32 <= b <= 126
    )
    ratio = text_like / len(data)
    return ratio < 0.7


def _should_skip_by_path(rel_posix: PurePosixPath) -> str | None:
    for part in rel_posix.parts[:-1]:
        if part.lower() in DEFAULT_IGNORED_DIR_NAMES:
            return "ignored_directory"

    suffix = rel_posix.suffix.lower()
    if suffix in DEFAULT_IGNORED_SUFFIXES:
        return "ignored_suffix"
    return None


def _is_high_value_text_path(rel_posix: PurePosixPath) -> bool:
    lower_name = rel_posix.name.lower()
    if lower_name in HIGH_VALUE_FILENAMES:
        return True

    suffix = rel_posix.suffix.lower()
    if suffix in HIGH_VALUE_SUFFIXES:
        return True

    # 支持无后缀脚本/配置（如 README、LICENSE）
    if "." not in lower_name and len(lower_name) <= 32:
        return lower_name in HIGH_VALUE_FILENAMES
    return False


def _read_text(path: Path) -> str:
    """读取文本，优先 UTF-8，必要时降级。"""
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # 仅在已通过二进制初筛后做宽松解码
        return path.read_text(encoding="utf-8", errors="replace")


def _ensure_within_base(base: Path, target: Path) -> None:
    """确保目标路径位于基目录下。"""
    try:
        target.relative_to(base)
    except ValueError as exc:
        raise PathTraversalError(f"非法解压路径：{target}") from exc

