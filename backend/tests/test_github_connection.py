"""GitHub 连接流程与持久化测试。"""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
import shutil
import uuid
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch

from backend.config import settings


TEST_TMP_ROOT = Path(".tmp_test_db")


class GitHubConnectionStorageTest(unittest.TestCase):
    """验证 GitHub 连接持久化行为。"""

    def setUp(self) -> None:
        self._tmp_dir = TEST_TMP_ROOT / f"github-connection-{uuid.uuid4().hex}"
        self._tmp_dir.mkdir(parents=True, exist_ok=True)
        self._old_db_path = settings.db_path
        settings.db_path = self._tmp_dir / "test.db"

    def tearDown(self) -> None:
        settings.db_path = self._old_db_path
        shutil.rmtree(self._tmp_dir, ignore_errors=True)

    def test_upsert_and_get_connection(self) -> None:
        from backend.storage.github_connections import (
            get_github_connection,
            upsert_github_connection,
        )

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
                    "account_login": "octocat",
                    "account_type": "User",
                    "target_type": "User",
                }
            ],
            access_token="ghu_token",
            refresh_token="ghr_token",
            access_token_expires_at="2026-04-09T10:00:00+00:00",
            refresh_token_expires_at="2026-10-09T10:00:00+00:00",
            token_type="bearer",
            scope="read:user",
        )

        record = get_github_connection("u001")
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual(record["github_login"], "octocat")
        self.assertEqual(record["installation_id"], 456)
        self.assertEqual(record["installations"][0]["id"], 456)
        self.assertEqual(record["status"], "connected")

    def test_disconnect_clears_tokens(self) -> None:
        from backend.storage.github_connections import (
            disconnect_github_connection,
            get_github_connection,
            upsert_github_connection,
        )

        upsert_github_connection(
            user_id="u001",
            github_user_id=123,
            github_login="octocat",
            github_name="The Octocat",
            github_avatar_url="https://avatars.example.com/octocat",
            installation_id=None,
            installations=[],
            access_token="ghu_token",
            refresh_token="ghr_token",
            access_token_expires_at=None,
            refresh_token_expires_at=None,
            token_type="bearer",
            scope="read:user",
        )

        updated = disconnect_github_connection("u001")
        self.assertTrue(updated)

        record = get_github_connection("u001")
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual(record["status"], "disconnected")
        self.assertEqual(record["access_token"], "")
        self.assertEqual(record["refresh_token"], "")
        self.assertIsNotNone(record["disconnected_at"])


class GitHubConnectionServiceTest(unittest.TestCase):
    """验证 GitHub 连接服务的关键契约。"""

    def setUp(self) -> None:
        self._tmp_dir = TEST_TMP_ROOT / f"github-service-{uuid.uuid4().hex}"
        self._tmp_dir.mkdir(parents=True, exist_ok=True)
        self._old_db_path = settings.db_path
        self._old_backend_public_url = settings.backend_public_url
        self._old_frontend_app_url = settings.frontend_app_url
        self._old_client_id = settings.github_app_client_id
        self._old_client_secret = settings.github_app_client_secret
        self._old_state_secret = settings.github_oauth_state_secret
        settings.db_path = self._tmp_dir / "test.db"
        settings.backend_public_url = "http://localhost:8000"
        settings.frontend_app_url = "http://localhost:5173"
        settings.github_app_client_id = "Iv1.test-client-id"
        settings.github_app_client_secret = "test-client-secret"
        settings.github_oauth_state_secret = "test-github-state-secret"

    def tearDown(self) -> None:
        settings.db_path = self._old_db_path
        settings.backend_public_url = self._old_backend_public_url
        settings.frontend_app_url = self._old_frontend_app_url
        settings.github_app_client_id = self._old_client_id
        settings.github_app_client_secret = self._old_client_secret
        settings.github_oauth_state_secret = self._old_state_secret
        shutil.rmtree(self._tmp_dir, ignore_errors=True)

    def test_create_connect_url_contains_required_query(self) -> None:
        from backend.github_connection import create_github_connect_session

        payload = create_github_connect_session("u001", redirect_path="/project-analysis")
        authorize_url = payload["authorize_url"]
        parsed = urlparse(authorize_url)
        query = parse_qs(parsed.query)

        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "github.com")
        self.assertEqual(query["client_id"][0], "Iv1.test-client-id")
        self.assertEqual(
            query["redirect_uri"][0],
            "http://localhost:8000/api/github/connection/callback",
        )
        self.assertEqual(query["state"][0], payload["state"])

    @patch("backend.github_connection.list_user_installations")
    @patch("backend.github_connection.fetch_authenticated_user")
    @patch("backend.github_connection.exchange_code_for_user_token")
    def test_handle_callback_persists_connection(
        self,
        mock_exchange_code,
        mock_fetch_user,
        mock_list_installations,
    ) -> None:
        from backend.github_connection import (
            create_github_connect_session,
            handle_github_callback,
        )
        from backend.storage.github_connections import get_github_connection

        connect_payload = create_github_connect_session("u001", redirect_path="/project-analysis")
        mock_exchange_code.return_value = {
            "access_token": "ghu_test_token",
            "refresh_token": "ghr_test_token",
            "expires_in": 28800,
            "refresh_token_expires_in": 15897600,
            "scope": "read:user",
            "token_type": "bearer",
        }
        mock_fetch_user.return_value = {
            "id": 123,
            "login": "octocat",
            "name": "The Octocat",
            "avatar_url": "https://avatars.example.com/octocat",
        }
        mock_list_installations.return_value = [
            {
                "id": 456,
                "target_type": "User",
                "account": {
                    "login": "octocat",
                    "type": "User",
                },
            }
        ]

        result = handle_github_callback(
            code="oauth-code",
            state=connect_payload["state"],
            installation_id=456,
            setup_action="install",
            error=None,
            error_description=None,
        )

        self.assertIn("github_connected=1", result["redirect_url"])
        record = get_github_connection("u001")
        self.assertIsNotNone(record)
        assert record is not None
        self.assertEqual(record["github_login"], "octocat")
        self.assertEqual(record["installation_id"], 456)
        self.assertEqual(record["status"], "connected")

    @patch("backend.github_connection.refresh_user_access_token")
    def test_get_valid_access_token_refreshes_expired_token(self, mock_refresh_token) -> None:
        from backend.github_connection import get_valid_github_access_token
        from backend.storage.github_connections import upsert_github_connection

        expired_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        mock_refresh_token.return_value = {
            "access_token": "ghu_refreshed_token",
            "refresh_token": "ghr_refreshed_token",
            "expires_in": 28800,
            "refresh_token_expires_in": 15897600,
            "scope": "read:user",
            "token_type": "bearer",
        }
        upsert_github_connection(
            user_id="u001",
            github_user_id=123,
            github_login="octocat",
            github_name="The Octocat",
            github_avatar_url="https://avatars.example.com/octocat",
            installation_id=456,
            installations=[],
            access_token="ghu_old_token",
            refresh_token="ghr_old_token",
            access_token_expires_at=expired_at.isoformat(),
            refresh_token_expires_at=None,
            token_type="bearer",
            scope="read:user",
        )

        token = get_valid_github_access_token("u001")
        self.assertEqual(token, "ghu_refreshed_token")

    @patch("backend.main.handle_github_callback")
    def test_callback_error_redirect_preserves_full_error_message(self, mock_handle_callback) -> None:
        from backend.github_connection import GitHubConnectionError
        from backend.main import github_connection_callback

        mock_handle_callback.side_effect = GitHubConnectionError(
            "github_invalid_state",
            "state=a&b",
        )

        response = github_connection_callback()
        parsed = urlparse(response.headers["location"])
        query = parse_qs(parsed.query)

        self.assertEqual(query["github_connected"][0], "0")
        self.assertEqual(query["error_code"][0], "github_invalid_state")
        self.assertEqual(query["error_message"][0], "state=a&b")


if __name__ == "__main__":
    unittest.main()
