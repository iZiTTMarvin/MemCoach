"""训练会话可恢复性测试

覆盖场景：
1. resume 会话可恢复（create → get_session → status=active）
2. topic_drill 部分作答后可恢复（progress_payload 持久化）
3. abandon 后不再出现在 active
4. history 默认不包含 active/abandoned
5. 同模式重复 start 返回旧 active session
6. complete 后不再出现在 active
"""
import json
import os
import sqlite3
import tempfile
import uuid
from pathlib import Path
from unittest import mock

import pytest

# 在导入 backend 模块前 mock settings，避免真实数据库写入
_test_db_dir = tempfile.mkdtemp()
_test_db_path = Path(_test_db_dir) / "test_interviews.db"


@pytest.fixture(autouse=True)
def _patch_db(monkeypatch):
    """每个测试用例使用独立临时数据库"""
    db_path = Path(tempfile.mkdtemp()) / f"test_{uuid.uuid4().hex[:6]}.db"
    monkeypatch.setattr("backend.storage.sessions.DB_PATH", db_path)
    yield
    # 测试结束后清理
    if db_path.exists():
        db_path.unlink()


from backend.storage.sessions import (
    create_session,
    get_session,
    list_sessions,
    list_active_sessions,
    get_active_session_by_mode,
    abandon_session,
    complete_session,
    update_progress,
    save_review,
    list_distinct_topics,
)


USER_ID = "test-user-001"
OTHER_USER = "test-user-002"


class TestSessionLifecycle:
    """会话生命周期基础测试"""

    def test_create_session_default_active(self):
        """新建会话默认 status=active"""
        sid = "s-001"
        create_session(sid, "resume", user_id=USER_ID)
        session = get_session(sid, user_id=USER_ID)
        assert session is not None
        assert session["status"] == "active"
        assert session["last_activity_at"] is not None

    def test_complete_session(self):
        """complete 后 status=completed"""
        sid = "s-002"
        create_session(sid, "resume", user_id=USER_ID)
        complete_session(sid, user_id=USER_ID)
        session = get_session(sid, user_id=USER_ID)
        assert session["status"] == "completed"
        assert session["completed_at"] is not None

    def test_abandon_session(self):
        """abandon 后 status=abandoned"""
        sid = "s-003"
        create_session(sid, "topic_drill", topic="python", user_id=USER_ID)
        result = abandon_session(sid, user_id=USER_ID)
        assert result is True
        session = get_session(sid, user_id=USER_ID)
        assert session["status"] == "abandoned"

    def test_abandon_only_active(self):
        """只能 abandon active 会话"""
        sid = "s-004"
        create_session(sid, "resume", user_id=USER_ID)
        complete_session(sid, user_id=USER_ID)
        result = abandon_session(sid, user_id=USER_ID)
        assert result is False


class TestActiveSessionDiscovery:
    """进行中会话发现"""

    def test_list_active_sessions(self):
        """list_active_sessions 只返回 active"""
        create_session("a1", "resume", user_id=USER_ID)
        create_session("a2", "topic_drill", topic="java", user_id=USER_ID)
        create_session("a3", "resume", user_id=USER_ID)
        complete_session("a3", user_id=USER_ID)

        active = list_active_sessions(user_id=USER_ID)
        active_ids = {s["session_id"] for s in active}
        assert "a1" in active_ids
        assert "a2" in active_ids
        assert "a3" not in active_ids

    def test_abandon_removes_from_active(self):
        """abandon 后不再出现在 active 列表"""
        create_session("b1", "resume", user_id=USER_ID)
        abandon_session("b1", user_id=USER_ID)
        active = list_active_sessions(user_id=USER_ID)
        assert all(s["session_id"] != "b1" for s in active)

    def test_get_active_by_mode(self):
        """按模式获取 active 会话"""
        create_session("m1", "resume", user_id=USER_ID)
        create_session("m2", "topic_drill", topic="go", user_id=USER_ID)

        resume_active = get_active_session_by_mode("resume", user_id=USER_ID)
        assert resume_active is not None
        assert resume_active["session_id"] == "m1"

        drill_active = get_active_session_by_mode("topic_drill", user_id=USER_ID)
        assert drill_active is not None
        assert drill_active["session_id"] == "m2"

    def test_user_isolation(self):
        """不同用户之间不可见"""
        create_session("iso1", "resume", user_id=USER_ID)
        active = list_active_sessions(user_id=OTHER_USER)
        assert len(active) == 0

        session = get_session("iso1", user_id=OTHER_USER)
        assert session is None


class TestHistoryExcludesActiveAbandoned:
    """history 默认不包含 active/abandoned"""

    def test_history_only_completed(self):
        """list_sessions 只包含 completed（有 review 的）"""
        create_session("h1", "resume", user_id=USER_ID)  # active
        create_session("h2", "topic_drill", topic="rust", user_id=USER_ID)
        abandon_session("h2", user_id=USER_ID)  # abandoned

        create_session("h3", "resume", user_id=USER_ID)
        save_review("h3", "good job", user_id=USER_ID)
        complete_session("h3", user_id=USER_ID)  # completed with review

        result = list_sessions(user_id=USER_ID)
        items = result["items"]
        session_ids = {i["session_id"] for i in items}
        assert "h3" in session_ids
        assert "h1" not in session_ids
        assert "h2" not in session_ids

    def test_distinct_topics_excludes_active(self):
        """list_distinct_topics 排除 active/abandoned"""
        create_session("t1", "topic_drill", topic="python", user_id=USER_ID)
        save_review("t1", "review", user_id=USER_ID)
        # 未 complete → status 仍为 active
        # 但有 review → 测试是否被过滤

        create_session("t2", "topic_drill", topic="java", user_id=USER_ID)
        save_review("t2", "review", user_id=USER_ID)
        complete_session("t2", user_id=USER_ID)

        topics = list_distinct_topics(user_id=USER_ID)
        assert "java" in topics
        assert "python" not in topics  # active 的不应出现


class TestDuplicateStartReturnsExisting:
    """同模式重复 start 应返回旧 active session"""

    def test_same_mode_returns_existing(self):
        """get_active_session_by_mode 在有 active 时返回它"""
        create_session("dup1", "resume", user_id=USER_ID)

        existing = get_active_session_by_mode("resume", user_id=USER_ID)
        assert existing is not None
        assert existing["session_id"] == "dup1"

    def test_after_abandon_allows_new(self):
        """abandon 后同模式可创建新会话"""
        create_session("dup2", "resume", user_id=USER_ID)
        abandon_session("dup2", user_id=USER_ID)

        existing = get_active_session_by_mode("resume", user_id=USER_ID)
        assert existing is None  # 无 active 了


class TestDrillProgressRecovery:
    """topic_drill 进度持久化与恢复"""

    def test_progress_payload_roundtrip(self):
        """进度快照可写入并读回"""
        create_session("dr1", "topic_drill", topic="css",
                       questions=[{"id": 1, "question": "Q1"}, {"id": 2, "question": "Q2"}],
                       user_id=USER_ID)

        payload = {"answers": {"1": "answer1"}, "current_index": 1}
        update_progress("dr1", payload, user_id=USER_ID)

        session = get_session("dr1", user_id=USER_ID)
        assert session["progress_payload"] == payload
        assert session["status"] == "active"

    def test_progress_updates_last_activity(self):
        """更新进度同时更新 last_activity_at"""
        create_session("dr2", "topic_drill", topic="html", user_id=USER_ID)
        s1 = get_session("dr2", user_id=USER_ID)
        t1 = s1["last_activity_at"]

        import time
        time.sleep(0.05)

        update_progress("dr2", {"answers": {}, "current_index": 0}, user_id=USER_ID)
        s2 = get_session("dr2", user_id=USER_ID)
        assert s2["last_activity_at"] >= t1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
