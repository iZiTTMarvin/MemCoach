"""注册激活码测试。"""

from __future__ import annotations

import shutil
import unittest
import uuid
from pathlib import Path

from fastapi import HTTPException

from backend.auth import create_user, init_users_table
from backend.config import settings


ROOT_DIR = Path(__file__).resolve().parents[2]


class RegistrationAccessCodeTest(unittest.TestCase):
    """验证注册开关与激活码校验。"""

    def setUp(self) -> None:
        self._tmp_dir = ROOT_DIR / ".tmp-tests" / f"registration-access-code-{uuid.uuid4().hex}"
        self._tmp_dir.mkdir(parents=True, exist_ok=True)

        self._old_db_path = settings.db_path
        self._old_allow_registration = settings.allow_registration
        self._old_registration_access_code = settings.registration_access_code

        settings.db_path = self._tmp_dir / "test.db"
        settings.allow_registration = True
        settings.registration_access_code = "xuhaochen"
        init_users_table()

    def tearDown(self) -> None:
        settings.db_path = self._old_db_path
        settings.allow_registration = self._old_allow_registration
        settings.registration_access_code = self._old_registration_access_code
        shutil.rmtree(self._tmp_dir, ignore_errors=True)

    def test_create_user_rejects_invalid_access_code(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            create_user("new@example.com", "password123", "New User", access_code="wrong-code")

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Access code", str(ctx.exception.detail))

    def test_create_user_accepts_valid_access_code(self) -> None:
        user = create_user("new@example.com", "password123", "New User", access_code="xuhaochen")

        self.assertEqual(user["email"], "new@example.com")
        self.assertEqual(user["name"], "New User")

    def test_create_user_allows_open_registration_when_code_not_configured(self) -> None:
        settings.registration_access_code = ""

        user = create_user("open@example.com", "password123", "Open User", access_code="")

        self.assertEqual(user["email"], "open@example.com")


if __name__ == "__main__":
    unittest.main()
