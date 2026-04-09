"""
认证模块 — 用户表管理、密码哈希、JWT 令牌、FastAPI 依赖注入

本模块提供完整的用户认证功能：
- 用户注册与登录
- 密码 bcrypt 哈希加密
- JWT 令牌生成与验证
- FastAPI 依赖注入获取当前用户
"""
import uuid
import sqlite3
import logging
from datetime import datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from backend.config import settings

logger = logging.getLogger("uvicorn")

# HTTP Bearer 认证方案
bearer_scheme = HTTPBearer()

# JWT 配置
JWT_ALGORITHM = "HS256"  # JWT 签名算法
JWT_EXPIRE_DAYS = 7     # JWT 令牌过期天数


def _hash_password(password: str) -> str:
    """
    使用 bcrypt 对密码进行哈希加密。

    Args:
        password: 明文密码

    Returns:
        哈希后的密码字符串
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    """
    验证密码是否与哈希值匹配。

    Args:
        password: 明文密码
        hashed: 存储的哈希密码

    Returns:
        密码匹配返回 True，否则返回 False
    """
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def _get_conn() -> sqlite3.Connection:
    """
    获取 SQLite 数据库连接。

    确保数据库目录存在，并返回配置了 Row 工厂的连接对象。
    Row 工厂允许通过列名访问数据。

    Returns:
        SQLite 数据库连接对象
    """
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(settings.db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_users_table():
    """
    初始化用户表。

    创建 users 表（如果不存在），包含以下字段：
    - id: 用户唯一标识符
    - email: 用户邮箱（唯一）
    - password: 哈希密码
    - name: 用户名称
    - created_at: 创建时间
    """
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            email      TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            name       TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def ensure_default_user():
    """
    确保默认用户存在。

    从环境配置中读取默认用户信息，如果用户不存在则创建。
    用于系统初始化时自动创建管理员账户。
    """
    email = settings.default_email.lower().strip()
    password = settings.default_password
    if not email or not password:
        logger.info("Default user bootstrap skipped: DEFAULT_EMAIL / DEFAULT_PASSWORD not configured.")
        return
    conn = _get_conn()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return
    uid = uuid.uuid4().hex[:8]
    hashed = _hash_password(password)
    conn.execute(
        "INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)",
        (uid, email, hashed, settings.default_name),
    )
    conn.commit()
    conn.close()
    logger.info(f"Default user created: {email}")


def create_user(email: str, password: str, name: str = "", access_code: str = "") -> dict:
    """
    创建新用户。

    Args:
        email: 用户邮箱（会自动转小写并去除首尾空格）
        password: 明文密码（会自动哈希存储）
        name: 用户名称（可选，默认为空）
        access_code: 注册激活码

    Returns:
        包含用户信息的字典，包含 id、email、name 字段

    Raises:
        HTTPException: 如果注册被禁用（403）、激活码错误（403）或邮箱已存在（409）
    """
    if not settings.allow_registration:
        raise HTTPException(403, "Registration is disabled")
    expected_access_code = settings.registration_access_code.strip()
    if expected_access_code and access_code.strip() != expected_access_code:
        raise HTTPException(403, "Access code is invalid")
    uid = uuid.uuid4().hex[:8]
    hashed = _hash_password(password)
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)",
            (uid, email.lower().strip(), hashed, name),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(409, "Email already registered")
    conn.close()
    return {"id": uid, "email": email.lower().strip(), "name": name}


def authenticate_user(email: str, password: str) -> dict | None:
    """
    验证用户凭据。

    Args:
        email: 用户邮箱
        password: 明文密码

    Returns:
        认证成功返回用户信息字典（包含 id、email、name），
        认证失败返回 None
    """
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
    ).fetchone()
    conn.close()
    if not row or not _verify_password(password, row["password"]):
        return None
    return {"id": row["id"], "email": row["email"], "name": row["name"]}


def create_token(user_id: str) -> str:
    """
    生成 JWT 访问令牌。

    Args:
        user_id: 用户唯一标识符

    Returns:
        编码后的 JWT 令牌字符串，包含用户 ID 和过期时间
    """
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "exp": expire},
        settings.jwt_secret,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    FastAPI 依赖注入：获取当前认证用户。

    从请求头中提取 Bearer 令牌，验证 JWT 签名和有效期，
    并返回用户 ID 字符串。

    Args:
        cred: HTTP Bearer 认证凭据（由 FastAPI 自动注入）

    Returns:
        当前用户的 ID 字符串

    Raises:
        HTTPException: 令牌无效（401）或已过期（401）
    """
    try:
        payload = jwt.decode(
            cred.credentials, settings.jwt_secret, algorithms=[JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
