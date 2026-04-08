"""GitHub 仓库发现与范围候选测试。"""

from __future__ import annotations

import shutil
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from backend.config import settings
from backend.storage.github_connections import upsert_github_connection


TEST_TMP_ROOT = Path(".tmp_test_db")


class GitHubRepoSelectionServiceTest(unittest.TestCase):
    """验证 GitHub 仓库选择服务契约。"""

    def setUp(self) -> None:
        self._tmp_dir = TEST_TMP_ROOT / f"github-repo-selection-{uuid.uuid4().hex}"
        self._tmp_dir.mkdir(parents=True, exist_ok=True)
        self._old_db_path = settings.db_path
        settings.db_path = self._tmp_dir / "test.db"
        upsert_github_connection(
            user_id="u001",
            github_user_id=123,
            github_login="octocat",
            github_name="The Octocat",
            github_avatar_url="https://avatars.example.com/octocat",
            installation_id=456,
            installations=[
                {
                    "id": 456,
                    "target_type": "User",
                    "account_login": "octocat",
                    "account_type": "User",
                }
            ],
            access_token="ghu_token",
            refresh_token="ghr_token",
            access_token_expires_at=None,
            refresh_token_expires_at=None,
            token_type="bearer",
            scope="read:user",
        )

    def tearDown(self) -> None:
        settings.db_path = self._old_db_path
        shutil.rmtree(self._tmp_dir, ignore_errors=True)

    @patch("backend.project_analysis.repo_selection.list_installation_repositories")
    @patch("backend.project_analysis.repo_selection.get_valid_github_access_token")
    def test_list_authorized_public_repositories_filters_and_paginates(
        self,
        mock_get_token,
        mock_list_repositories,
    ) -> None:
        from backend.project_analysis.repo_selection import list_authorized_public_repositories

        mock_get_token.return_value = "ghu_token"
        mock_list_repositories.return_value = [
            {
                "id": 1,
                "name": "MemCoach",
                "full_name": "octocat/MemCoach",
                "private": False,
                "html_url": "https://github.com/octocat/MemCoach",
                "description": "demo",
                "default_branch": "main",
                "updated_at": "2026-04-08T12:00:00Z",
            },
            {
                "id": 2,
                "name": "private-repo",
                "full_name": "octocat/private-repo",
                "private": True,
                "html_url": "https://github.com/octocat/private-repo",
                "description": "hidden",
                "default_branch": "main",
                "updated_at": "2026-04-07T12:00:00Z",
            },
            {
                "id": 3,
                "name": "repo-mem-analysis",
                "full_name": "octocat/repo-mem-analysis",
                "private": False,
                "html_url": "https://github.com/octocat/repo-mem-analysis",
                "description": "match",
                "default_branch": "develop",
                "updated_at": "2026-04-09T12:00:00Z",
            },
        ]

        payload = list_authorized_public_repositories("u001", query="mem", page=1, per_page=10)
        self.assertEqual(payload["total"], 2)
        self.assertEqual(payload["items"][0]["full_name"], "octocat/repo-mem-analysis")
        self.assertEqual(payload["items"][1]["full_name"], "octocat/MemCoach")
        self.assertEqual(payload["items"][0]["installation_id"], 456)

    @patch("backend.project_analysis.repo_selection.fetch_repository_file_text")
    @patch("backend.project_analysis.repo_selection.fetch_repository_tree")
    @patch("backend.project_analysis.repo_selection.resolve_branch_commit")
    @patch("backend.project_analysis.repo_selection.get_valid_github_access_token")
    def test_build_scope_candidates_returns_recommended_directories(
        self,
        mock_get_token,
        mock_resolve_branch_commit,
        mock_fetch_tree,
        mock_fetch_file_text,
    ) -> None:
        from backend.project_analysis.repo_selection import build_scope_candidates

        mock_get_token.return_value = "ghu_token"
        mock_resolve_branch_commit.return_value = "abc1234"
        mock_fetch_tree.return_value = [
            {"path": "README.md", "type": "blob", "size": 100},
            {"path": "backend", "type": "tree"},
            {"path": "backend/main.py", "type": "blob", "size": 2000},
            {"path": "backend/auth.py", "type": "blob", "size": 1000},
            {"path": "frontend", "type": "tree"},
            {"path": "frontend/src", "type": "tree"},
            {"path": "frontend/src/pages/ProjectAnalysis.jsx", "type": "blob", "size": 1500},
            {"path": "package.json", "type": "blob", "size": 200},
        ]
        mock_fetch_file_text.side_effect = [
            "# MemCoach\n",
            '{ "name": "memcoach" }',
        ]

        payload = build_scope_candidates("u001", owner="octocat", repo="MemCoach", branch="main")
        self.assertEqual(payload["commit_sha"], "abc1234")
        self.assertEqual(payload["recommended_directories"][0]["path"], "backend")
        self.assertEqual(payload["recommended_directories"][1]["path"], "frontend")
        self.assertEqual(payload["important_files"][0]["path"], "README.md")
        self.assertTrue(any(node["path"] == "frontend/src/pages/ProjectAnalysis.jsx" for node in payload["tree"]))


if __name__ == "__main__":
    unittest.main()
