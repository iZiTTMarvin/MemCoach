"""项目分析存储层测试。"""

from __future__ import annotations

import unittest
import uuid
from pathlib import Path
import shutil

from backend.config import settings
from backend.project_analysis.contracts import AnalysisStatus
from backend.storage.project_analyses import (
    create_project_analysis,
    delete_project_analysis,
    get_project_analysis,
    list_project_analyses,
    save_project_analysis_result,
    update_project_analysis_status,
)


def _sample_result_payload() -> dict:
    """构造合法的分析结果载荷。"""
    return {
        "metadata": {
            "repo_url": "https://github.com/example/repo",
            "repo_name": "repo",
            "branch": "main",
            "commit_sha": "abc1234",
        },
        "questions": [
            {
                "question": "项目的核心模块是什么？",
                "reference_answer_points": ["模块边界清晰", "职责单一"],
                "follow_up_directions": ["如何做异常兜底"],
                "evidence": [
                    {
                        "source_type": "file",
                        "source_path": "backend/main.py",
                        "reason": "核心流程在入口中组装",
                    }
                ],
            }
        ],
        "breakdown": {
            "core_features": ["项目分析导入", "结果工作区"],
            "tech_stack": ["FastAPI", "SQLite"],
        },
        "resume_draft": "负责项目分析数据模型设计与实现。",
    }


class TestProjectAnalysesStorage(unittest.TestCase):
    """验证项目分析存储层行为。"""

    def setUp(self):
        self._original_db_path = settings.db_path
        self._temp_dir = Path(".tmp-tests") / f"project-analysis-storage-{uuid.uuid4().hex}"
        self._temp_dir.mkdir(parents=True, exist_ok=True)
        settings.db_path = self._temp_dir / "test_project_analysis.db"
        self.user_id = f"ut_{uuid.uuid4().hex[:8]}"

    def tearDown(self):
        settings.db_path = self._original_db_path
        shutil.rmtree(self._temp_dir, ignore_errors=True)

    def test_create_and_get_project_analysis(self):
        create_project_analysis(
            analysis_id="a1",
            repo_url="https://github.com/example/repo",
            repo_name="repo",
            branch="main",
            commit_sha="abc1234",
            role_summary="负责后端分析管线",
            owned_scopes=["backend", "storage"],
            repo_source={
                "provider": "github",
                "owner": "example",
                "repo": "repo",
                "full_name": "example/repo",
                "html_url": "https://github.com/example/repo",
                "installation_id": 456,
            },
            selected_scope_snapshot=[
                {"path": "backend", "type": "directory"},
                {"path": "backend/storage/project_analyses.py", "type": "file"},
            ],
            user_id=self.user_id,
        )

        record = get_project_analysis("a1", user_id=self.user_id)
        self.assertIsNotNone(record)
        self.assertEqual(record["status"], AnalysisStatus.QUEUED.value)
        self.assertEqual(record["repo_name"], "repo")
        self.assertEqual(record["owned_scopes"], ["backend", "storage"])
        self.assertEqual(record["repo_source"]["full_name"], "example/repo")
        self.assertEqual(record["selected_scope_snapshot"][0]["path"], "backend")
        self.assertEqual(record["result"], {})

    def test_update_status_and_save_result(self):
        create_project_analysis(
            analysis_id="a2",
            repo_url="https://github.com/example/repo",
            repo_name="repo",
            branch="dev",
            commit_sha="def5678",
            user_id=self.user_id,
        )

        updated = update_project_analysis_status(
            "a2",
            AnalysisStatus.FAILED.value,
            user_id=self.user_id,
            error_code="GITHUB_RATE_LIMIT",
            error_message="api limited",
        )
        self.assertTrue(updated)
        failed_record = get_project_analysis("a2", user_id=self.user_id)
        self.assertEqual(failed_record["status"], AnalysisStatus.FAILED.value)
        self.assertEqual(failed_record["error_code"], "GITHUB_RATE_LIMIT")

        saved = save_project_analysis_result(
            "a2",
            _sample_result_payload(),
            user_id=self.user_id,
            status=AnalysisStatus.COMPLETED.value,
        )
        self.assertTrue(saved)
        completed = get_project_analysis("a2", user_id=self.user_id)
        self.assertEqual(completed["status"], AnalysisStatus.COMPLETED.value)
        self.assertIsNone(completed["error_code"])
        self.assertEqual(completed["result"]["metadata"]["branch"], "main")

    def test_list_filter_and_delete(self):
        create_project_analysis(
            analysis_id="a3",
            repo_url="https://github.com/example/repo",
            repo_name="repo",
            branch="main",
            commit_sha="abc1234",
            user_id=self.user_id,
        )
        create_project_analysis(
            analysis_id="a4",
            repo_url="https://github.com/example/repo2",
            repo_name="repo2",
            branch="main",
            commit_sha="fff0000",
            user_id=self.user_id,
        )
        update_project_analysis_status(
            "a4",
            AnalysisStatus.ANALYZING.value,
            user_id=self.user_id,
        )

        all_items = list_project_analyses(user_id=self.user_id, limit=10, offset=0)
        self.assertEqual(all_items["total"], 2)

        analyzing_items = list_project_analyses(
            user_id=self.user_id,
            status=AnalysisStatus.ANALYZING.value,
        )
        self.assertEqual(analyzing_items["total"], 1)
        self.assertEqual(analyzing_items["items"][0]["analysis_id"], "a4")

        deleted = delete_project_analysis("a3", user_id=self.user_id)
        self.assertTrue(deleted)
        after_delete = list_project_analyses(user_id=self.user_id)
        self.assertEqual(after_delete["total"], 1)

    def test_invalid_status_rejected(self):
        create_project_analysis(
            analysis_id="a5",
            repo_url="https://github.com/example/repo",
            repo_name="repo",
            branch="main",
            commit_sha="abc1234",
            user_id=self.user_id,
        )
        with self.assertRaises(ValueError):
            update_project_analysis_status("a5", "bad-status", user_id=self.user_id)


if __name__ == "__main__":
    unittest.main()
