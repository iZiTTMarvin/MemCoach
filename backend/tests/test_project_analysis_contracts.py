"""项目分析契约测试。"""

from __future__ import annotations

import unittest

from pydantic import ValidationError

from backend.project_analysis.contracts import (
    AnalysisStatus,
    ProjectAnalysisResult,
)


class TestProjectAnalysisContracts(unittest.TestCase):
    """验证项目分析结果契约。"""

    def _valid_payload(self) -> dict:
        return {
            "metadata": {
                "repo_url": "https://github.com/example/repo",
                "repo_name": "repo",
                "branch": "main",
                "commit_sha": "abc1234",
            },
            "questions": [
                {
                    "question": "请解释该项目的核心架构。",
                    "reference_answer_points": ["分层设计", "模块解耦"],
                    "follow_up_directions": ["如果流量翻倍如何扩展"],
                    "evidence": [
                        {
                            "source_type": "file",
                            "source_path": "backend/main.py",
                            "reason": "入口路由与核心流程集中在该文件",
                            "line_start": 1,
                            "line_end": 20,
                        }
                    ],
                }
            ],
            "breakdown": {
                "core_features": ["面试模拟", "项目分析"],
                "tech_stack": ["FastAPI", "React"],
            },
            "resume_draft": "主导项目分析模块设计与落地。",
            "confidence": 0.9,
        }

    def test_status_enum_contains_required_values(self):
        expected = {
            "queued",
            "fetching",
            "filtering",
            "analyzing",
            "completed",
            "failed",
            "cancelled",
        }
        actual = {s.value for s in AnalysisStatus}
        self.assertEqual(actual, expected)

    def test_result_payload_validation_success(self):
        model = ProjectAnalysisResult.model_validate(self._valid_payload())
        dumped = model.model_dump(mode="json")
        self.assertEqual(dumped["metadata"]["branch"], "main")
        self.assertEqual(len(dumped["questions"]), 1)
        self.assertEqual(dumped["questions"][0]["evidence"][0]["source_type"], "file")

    def test_result_payload_requires_evidence(self):
        payload = self._valid_payload()
        payload["questions"][0]["evidence"] = []
        with self.assertRaises(ValidationError):
            ProjectAnalysisResult.model_validate(payload)

    def test_result_payload_requires_answer_points(self):
        payload = self._valid_payload()
        payload["questions"][0]["reference_answer_points"] = []
        with self.assertRaises(ValidationError):
            ProjectAnalysisResult.model_validate(payload)


if __name__ == "__main__":
    unittest.main()

