"""GitHub 源接入与归档过滤测试。"""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import shutil
import unittest
import uuid
import zipfile

from backend.project_analysis.filtering import (
    ArchiveLimitError,
    FilterLimits,
    PathTraversalError,
    filter_repository_text_files,
    safe_extract_zip,
)
from backend.project_analysis.github_source import (
    GitHubUrlError,
    parse_public_github_repo_url,
)


class ParseRepoUrlTests(unittest.TestCase):
    """仓库 URL 解析测试。"""

    def test_parse_https_url(self) -> None:
        ref = parse_public_github_repo_url("https://github.com/octocat/Hello-World.git")
        self.assertEqual(ref.owner, "octocat")
        self.assertEqual(ref.repo, "Hello-World")

    def test_parse_short_url_without_scheme(self) -> None:
        ref = parse_public_github_repo_url("github.com/openai/codex")
        self.assertEqual(ref.owner, "openai")
        self.assertEqual(ref.repo, "codex")

    def test_parse_ssh_url(self) -> None:
        ref = parse_public_github_repo_url("git@github.com:foo/bar.git")
        self.assertEqual(ref.owner, "foo")
        self.assertEqual(ref.repo, "bar")

    def test_reject_non_github(self) -> None:
        with self.assertRaises(GitHubUrlError):
            parse_public_github_repo_url("https://gitlab.com/group/proj")


class SafeExtractTests(unittest.TestCase):
    """安全解压测试。"""

    @staticmethod
    @contextmanager
    def _temp_dir():
        path = Path(".tmp-tests") / f"github-ingestion-{uuid.uuid4().hex}"
        path.mkdir(parents=True, exist_ok=True)
        try:
            yield str(path)
        finally:
            shutil.rmtree(path, ignore_errors=True)

    def test_reject_path_traversal(self) -> None:
        with self._temp_dir() as td:
            root = Path(td)
            zip_path = root / "bad.zip"
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("../evil.txt", "nope")

            out_dir = root / "out"
            with self.assertRaises(PathTraversalError):
                safe_extract_zip(zip_path, out_dir)

    def test_extract_normal_files(self) -> None:
        with self._temp_dir() as td:
            root = Path(td)
            zip_path = root / "ok.zip"
            with zipfile.ZipFile(zip_path, "w") as zf:
                zf.writestr("src/main.py", "print('ok')\n")

            out_dir = root / "out"
            files = safe_extract_zip(zip_path, out_dir)
            self.assertEqual(len(files), 1)
            self.assertTrue((out_dir / "src" / "main.py").exists())


class FilterRepositoryTests(unittest.TestCase):
    """仓库过滤测试。"""

    @staticmethod
    @contextmanager
    def _temp_dir():
        path = Path(".tmp-tests") / f"github-filtering-{uuid.uuid4().hex}"
        path.mkdir(parents=True, exist_ok=True)
        try:
            yield str(path)
        finally:
            shutil.rmtree(path, ignore_errors=True)

    def test_filter_skips_ignored_and_binary(self) -> None:
        with self._temp_dir() as td:
            root = Path(td)
            (root / "src").mkdir(parents=True, exist_ok=True)
            (root / "node_modules" / "leftpad").mkdir(parents=True, exist_ok=True)
            (root / "images").mkdir(parents=True, exist_ok=True)

            (root / "src" / "main.py").write_text("print('hello')\n", encoding="utf-8")
            (root / "README.md").write_text("# Demo\n", encoding="utf-8")
            (root / "node_modules" / "leftpad" / "index.js").write_text("module.exports={}\n", encoding="utf-8")
            (root / "images" / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00")

            files, summary = filter_repository_text_files(root)
            rel_paths = {f.relative_path for f in files}
            self.assertIn("src/main.py", rel_paths)
            self.assertIn("README.md", rel_paths)
            self.assertNotIn("node_modules/leftpad/index.js", rel_paths)
            self.assertNotIn("images/logo.png", rel_paths)
            self.assertGreaterEqual(summary.skipped_by_reason.get("ignored_directory", 0), 1)
            self.assertGreaterEqual(summary.skipped_by_reason.get("ignored_suffix", 0), 1)

    def test_filter_respects_total_size_limit(self) -> None:
        with self._temp_dir() as td:
            root = Path(td)
            (root / "src").mkdir(parents=True, exist_ok=True)
            (root / "src" / "a.py").write_text("a = 'x' * 100\n", encoding="utf-8")
            (root / "src" / "b.py").write_text("b = 'y' * 100\n", encoding="utf-8")

            with self.assertRaises(ArchiveLimitError):
                filter_repository_text_files(
                    root,
                    limits=FilterLimits(
                        max_total_text_bytes=10,
                        max_single_file_bytes=10_000,
                        max_text_files=100,
                        max_archive_members=1000,
                    ),
                )


if __name__ == "__main__":
    unittest.main()
