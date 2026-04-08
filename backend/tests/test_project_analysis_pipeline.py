"""项目分析编排管线测试。"""

from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import patch
import shutil
import uuid

from backend.config import settings
from backend.project_analysis import pipeline
from backend.project_analysis.filtering import FilterSummary, FilteredTextFile


class ProjectAnalysisPipelineTest(unittest.TestCase):
    """覆盖 Phase 1 正式编排链路的关键断言。"""

    def setUp(self) -> None:
        self._old_db_path = settings.db_path
        self._temp_dir = Path(".tmp-tests") / f"project-analysis-pipeline-{uuid.uuid4().hex}"
        self._temp_dir.mkdir(parents=True, exist_ok=True)
        settings.db_path = self._temp_dir / "test_project_analysis.db"

    def tearDown(self) -> None:
        settings.db_path = self._old_db_path
        shutil.rmtree(self._temp_dir, ignore_errors=True)

    def test_resolve_repo_preview_rejects_invalid_url(self):
        with self.assertRaises(pipeline.AnalysisPipelineError):
            pipeline.resolve_repo_preview("https://example.com/not-github/repo", "u001")

    @patch("backend.project_analysis.pipeline.get_valid_github_access_token")
    @patch("backend.project_analysis.pipeline.resolve_branch_commit")
    @patch("backend.project_analysis.pipeline.fetch_repo_info")
    def test_create_analysis_job_supports_repo_snapshot(
        self,
        mock_fetch_repo_info,
        mock_resolve_commit,
        mock_get_token,
    ) -> None:
        repo_ref = type("RepoRef", (), {"repo": "Hello-World", "full_name": "octocat/Hello-World"})()
        branch = type("Branch", (), {"name": "main", "commit_sha": "abc1234", "is_default": True})()
        mock_get_token.return_value = "ghu_user_token"
        mock_fetch_repo_info.return_value = type(
            "RepoInfo",
            (),
            {
                "ref": repo_ref,
                "html_url": "https://github.com/octocat/Hello-World",
                "description": "demo",
                "default_branch": "main",
                "is_private": False,
                "branches": [branch],
            },
        )()
        mock_resolve_commit.return_value = "abc1234"

        created = pipeline.create_analysis_job(
            repo_snapshot={
                "provider": "github",
                "owner": "octocat",
                "repo": "Hello-World",
                "full_name": "octocat/Hello-World",
                "html_url": "https://github.com/octocat/Hello-World",
                "installation_id": 456,
            },
            user_id="u001",
            branch="main",
            role_summary="后端开发负责人",
            selected_scope_snapshot=[
                {"path": "backend", "type": "directory"},
                {"path": "frontend/src/pages/ProjectAnalysis.jsx", "type": "file"},
            ],
        )

        self.assertEqual(created["status"], pipeline.STATUS_QUEUED)
        self.assertEqual(created["repo_source"]["full_name"], "octocat/Hello-World")
        self.assertEqual(created["selected_scope_snapshot"][0]["path"], "backend")
        self.assertEqual(created["owned_scopes"], ["backend", "frontend/src/pages/ProjectAnalysis.jsx"])
        self.assertEqual(mock_fetch_repo_info.call_args.kwargs["token"], "ghu_user_token")
        self.assertEqual(mock_resolve_commit.call_args.kwargs["token"], "ghu_user_token")

    @patch("backend.project_analysis.pipeline.get_valid_github_access_token")
    @patch("backend.project_analysis.pipeline.download_commit_archive")
    @patch("backend.project_analysis.pipeline.safe_extract_zip")
    @patch("backend.project_analysis.pipeline.filter_repository_text_files")
    @patch("backend.project_analysis.pipeline._detect_repo_root")
    @patch("backend.project_analysis.pipeline.resolve_branch_commit")
    @patch("backend.project_analysis.pipeline.fetch_repo_info")
    def test_create_and_run_analysis_job_reaches_completed_with_user_token(
        self,
        mock_fetch_repo_info,
        mock_resolve_commit,
        mock_detect_repo_root,
        mock_filter_files,
        mock_safe_extract,
        mock_download_archive,
        mock_get_token,
    ):
        repo_ref = type("RepoRef", (), {"repo": "Hello-World", "full_name": "octocat/Hello-World"})()
        branch = type("Branch", (), {"name": "main", "commit_sha": "abc1234", "is_default": True})()
        mock_get_token.return_value = "ghu_user_token"
        mock_fetch_repo_info.return_value = type(
            "RepoInfo",
            (),
            {
                "ref": repo_ref,
                "html_url": "https://github.com/octocat/Hello-World",
                "description": "demo",
                "default_branch": "main",
                "is_private": False,
                "branches": [branch],
            },
        )()
        mock_resolve_commit.return_value = "abc1234"

        archive_path = self._temp_dir / "repo.zip"
        archive_path.write_bytes(b"PK\x03\x04")
        mock_download_archive.return_value = archive_path
        mock_safe_extract.return_value = [self._temp_dir / "repo" / "README.md"]
        mock_detect_repo_root.return_value = self._temp_dir / "repo"
        mock_filter_files.return_value = (
            [
                FilteredTextFile(
                    absolute_path=self._temp_dir / "repo" / "README.md",
                    relative_path="README.md",
                    size_bytes=64,
                    content="# Demo\nThis is a demo repository.\n",
                )
            ],
            FilterSummary(scanned_files=1, accepted_files=1, accepted_text_bytes=64),
        )

        created = pipeline.create_analysis_job(
            repo_snapshot={
                "provider": "github",
                "owner": "octocat",
                "repo": "Hello-World",
                "full_name": "octocat/Hello-World",
                "html_url": "https://github.com/octocat/Hello-World",
                "installation_id": 456,
            },
            user_id="u001",
            branch=None,
            role_summary="后端开发负责人",
            selected_scope_snapshot=[
                {"path": "backend", "type": "directory"},
                {"path": "api", "type": "directory"},
            ],
        )
        self.assertEqual(created["status"], pipeline.STATUS_QUEUED)
        analysis_id = created["analysis_id"]

        pipeline.run_analysis_job(analysis_id, "u001")
        record = pipeline.get_analysis(analysis_id, "u001")

        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual(record["status"], pipeline.STATUS_COMPLETED)

        result = record.get("result", {})
        self.assertIn("questions", result)
        self.assertIn("breakdown", result)
        self.assertIn("resume_draft", result)
        self.assertIn("metadata", result)
        self.assertGreaterEqual(len(result["questions"]), 5)
        self.assertEqual(result["questions"][0]["evidence"][0]["source_type"], "file")
        self.assertEqual(mock_download_archive.call_args.kwargs["token"], "ghu_user_token")

    def test_detect_repo_root_handles_resolved_path_mismatch(self) -> None:
        extracted_root = self._temp_dir / "relative-repo"
        extracted_root.mkdir(parents=True, exist_ok=True)
        nested_file = (extracted_root / "octocat-hello-world" / "README.md").resolve()
        nested_file.parent.mkdir(parents=True, exist_ok=True)
        nested_file.write_text("# Demo\n", encoding="utf-8")

        detected = pipeline._detect_repo_root(Path(".") / extracted_root, [nested_file])
        self.assertEqual(detected, extracted_root.resolve() / "octocat-hello-world")


if __name__ == "__main__":
    unittest.main()
