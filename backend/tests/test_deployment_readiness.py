"""部署就绪性测试：覆盖安全默认值、依赖清单与部署配置文件。"""

from __future__ import annotations

import os
import shutil
import sqlite3
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from backend.auth import ensure_default_user, init_users_table
from backend.config import Settings, settings


ROOT_DIR = Path(__file__).resolve().parents[2]


class DeploymentReadinessTest(unittest.TestCase):
    """约束项目的部署级契约，避免线上才暴露缺口。"""

    def test_settings_defaults_keep_registration_closed_without_env(self) -> None:
        """无环境变量时，运行时默认仍保持关闭注册，避免误开。"""
        with patch.dict(os.environ, {}, clear=True):
            runtime_settings = Settings(_env_file=None)

        self.assertEqual(runtime_settings.default_email, "")
        self.assertEqual(runtime_settings.default_password, "")
        self.assertEqual(runtime_settings.default_name, "")
        self.assertFalse(runtime_settings.allow_registration)
        self.assertEqual(runtime_settings.registration_access_code, "")

    def test_embedding_defaults_to_siliconflow_cloud_api(self) -> None:
        """Embedding 默认应指向硅基流动云端接口，而不是本地模型。"""
        with patch.dict(os.environ, {}, clear=True):
            runtime_settings = Settings(
                _env_file=None,
                api_key="llm-key",
            )

        self.assertEqual(runtime_settings.resolved_embedding_api_base, "https://api.siliconflow.cn/v1")
        self.assertEqual(runtime_settings.resolved_embedding_api_key, "llm-key")

    def test_ensure_default_user_skips_without_bootstrap_credentials(self) -> None:
        """未显式提供初始化账号时，不应自动创建默认用户。"""
        tmp_dir = ROOT_DIR / ".tmp-tests" / f"deployment-readiness-{uuid.uuid4().hex}"
        old_db_path = settings.db_path
        old_email = settings.default_email
        old_password = settings.default_password
        old_name = settings.default_name
        try:
            tmp_dir.mkdir(parents=True, exist_ok=True)
            db_path = tmp_dir / "test.db"
            settings.db_path = db_path
            settings.default_email = ""
            settings.default_password = ""
            settings.default_name = ""
            init_users_table()
            ensure_default_user()

            conn = sqlite3.connect(str(db_path))
            count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            conn.close()
        finally:
            settings.db_path = old_db_path
            settings.default_email = old_email
            settings.default_password = old_password
            settings.default_name = old_name
            shutil.rmtree(tmp_dir, ignore_errors=True)

        self.assertEqual(count, 0)

    def test_env_example_contains_required_deployment_keys(self) -> None:
        """`.env.example` 必须覆盖当前代码真实使用的关键环境变量。"""
        content = (ROOT_DIR / ".env.example").read_text(encoding="utf-8")
        required_keys = [
            "API_BASE",
            "API_KEY",
            "MODEL",
            "TEMPERATURE",
            "EMBEDDING_API_BASE",
            "EMBEDDING_API_KEY",
            "EMBEDDING_MODEL",
            "JWT_SECRET",
            "DEFAULT_EMAIL",
            "DEFAULT_PASSWORD",
            "DEFAULT_NAME",
            "ALLOW_REGISTRATION",
            "REGISTRATION_ACCESS_CODE",
            "GITHUB_APP_CLIENT_ID",
            "GITHUB_APP_CLIENT_SECRET",
            "GITHUB_APP_SLUG",
            "GITHUB_OAUTH_STATE_SECRET",
            "BACKEND_PUBLIC_URL",
            "FRONTEND_APP_URL",
            "MAX_QUESTIONS_PER_PHASE",
            "MAX_DRILL_QUESTIONS",
        ]
        for key in required_keys:
            self.assertIn(f"{key}=", content, f"缺少环境变量示例: {key}")

    def test_requirements_include_requests_dependency(self) -> None:
        """录音转写依赖 requests，依赖清单必须显式声明。"""
        requirements = (ROOT_DIR / "requirements.txt").read_text(encoding="utf-8")
        self.assertRegex(requirements, r"(?m)^requests(?:[<>=\[].*)?$")

    def test_requirements_do_not_reintroduce_local_embedding_dependency(self) -> None:
        """部署链路必须避免重新引入本地 HuggingFace embedding 依赖。"""
        requirements = (ROOT_DIR / "requirements.txt").read_text(encoding="utf-8")
        self.assertNotIn("llama-index-embeddings-huggingface", requirements)

    def test_zeabur_specific_files_exist(self) -> None:
        """Zeabur 前后端分离部署需要独立 Dockerfile 与 zbpack 配置。"""
        expected_paths = [
            ROOT_DIR / "Dockerfile.backend",
            ROOT_DIR / "Dockerfile.frontend",
            ROOT_DIR / "zbpack.backend.json",
            ROOT_DIR / "zbpack.frontend.json",
            ROOT_DIR / "frontend" / "nginx.conf.template",
        ]
        for path in expected_paths:
            self.assertTrue(path.exists(), f"缺少部署文件: {path.name}")

    def test_frontend_nginx_template_uses_runtime_api_upstream(self) -> None:
        """前端反代目标必须通过运行时环境变量注入，不能写死 compose 主机名。"""
        template = (ROOT_DIR / "frontend" / "nginx.conf.template").read_text(encoding="utf-8")
        self.assertIn("${API_UPSTREAM}", template)


if __name__ == "__main__":
    unittest.main()
