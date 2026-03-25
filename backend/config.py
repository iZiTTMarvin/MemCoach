"""
MemCoach 配置模块

集中管理所有环境变量和配置项，支持从 .env 文件加载。
"""
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    MemCoach 全局配置类

    所有配置项均支持从环境变量或 .env 文件读取。
    配置分为以下几类：
    - LLM 配置：大语言模型 API
    - Embedding 配置：向量嵌入模型
    - ASR 配置：语音识别
    - OSS 配置：对象存储（用于音频文件公开访问）
    - 路径配置：数据存储路径
    - 认证配置：JWT 和用户注册
    - 面试配置：题目数量限制
    """

    # ==================== LLM 配置 ====================
    # 大语言模型 API（OpenAI 兼容代理）
    api_base: str = ""           # API 地址，如 https://api.openai.com/v1
    api_key: str = ""            # API 密钥
    model: str = ""               # 模型名称，如 gpt-4o-mini
    temperature: float = 0.7     # 生成温度，0-1 之间，越高越随机

    # ==================== Embedding 配置 ====================
    # 向量嵌入模型，支持两种模式：
    # 1. API 模式（OpenAI 兼容，如 SiliconFlow）
    # 2. 本地模式（HuggingFace）
    embedding_api_base: str = ""   # API 模式地址，如 https://api.siliconflow.cn/v1；留空则使用本地模式
    embedding_api_key: str = ""    # 嵌入 API 密钥
    embedding_model: str = "BAAI/bge-m3"  # 嵌入模型名称

    # ==================== ASR 配置 ====================
    # 阿里云 DashScope 语音识别
    dashscope_api_key: str = ""    # DashScope API 密钥，用于语音转文字

    # ==================== OSS 配置 ====================
    # 七牛云对象存储，用于上传音频文件获取公开访问 URL
    qiniu_access_key: str = ""     # 七牛云 Access Key
    qiniu_secret_key: str = ""     # 七牛云 Secret Key
    qiniu_bucket: str = ""         # 七牛云存储桶名称
    qiniu_domain: str = ""         # 七牛云 CDN 域名

    # ==================== 路径配置 ====================
    base_dir: Path = Path(__file__).resolve().parent.parent           # 项目根目录
    resume_path: Path = Path(__file__).resolve().parent.parent / "data" / "resume"          # 简历文件目录
    knowledge_path: Path = Path(__file__).resolve().parent.parent / "data" / "knowledge"    # 知识库目录
    high_freq_path: Path = Path(__file__).resolve().parent.parent / "data" / "high_freq"     # 高频题库目录
    db_path: Path = Path(__file__).resolve().parent.parent / "data" / "interviews.db"        # SQLite 数据库路径

    # ==================== 认证配置 ====================
    jwt_secret: str = "change-me-in-production"   # JWT 密钥，生产环境必须修改
    default_email: str = "xuhaochen0212@qq.com"   # 默认管理员邮箱
    default_password: str = "asd2528836683"            # 默认管理员密码
    default_name: str = "xhc"                   # 默认管理员名称
    allow_registration: bool = False              # 是否允许公开注册

    # ==================== 面试配置 ====================
    max_questions_per_phase: int = 5   # 每个面试阶段的最大题目数
    max_drill_questions: int = 15     # 专项训练的最大题目数

    def user_data_dir(self, user_id: str) -> Path:
        """
        获取指定用户的根数据目录路径

        Args:
            user_id: 用户唯一标识符

        Returns:
            Path: 用户数据目录的完整路径
        """
        return self.base_dir / "data" / "users" / user_id

    def user_profile_dir(self, user_id: str) -> Path:
        """
        获取指定用户的人像数据目录路径

        Args:
            user_id: 用户唯一标识符

        Returns:
            Path: 用户画像目录的完整路径
        """
        return self.user_data_dir(user_id) / "profile"

    def user_resume_path(self, user_id: str) -> Path:
        """
        获取指定用户的简历目录路径

        Args:
            user_id: 用户唯一标识符

        Returns:
            Path: 用户简历目录的完整路径
        """
        return self.user_data_dir(user_id) / "resume"

    def user_knowledge_path(self, user_id: str) -> Path:
        """
        获取指定用户的知识库目录路径

        Args:
            user_id: 用户唯一标识符

        Returns:
            Path: 用户知识库目录的完整路径
        """
        return self.user_data_dir(user_id) / "knowledge"

    def user_high_freq_path(self, user_id: str) -> Path:
        """
        获取指定用户的高频题库目录路径

        Args:
            user_id: 用户唯一标识符

        Returns:
            Path: 用户高频题库目录的完整路径
        """
        return self.user_data_dir(user_id) / "high_freq"

    def user_topics_path(self, user_id: str) -> Path:
        """
        获取指定用户的领域配置文件路径

        Args:
            user_id: 用户唯一标识符

        Returns:
            Path: 用户领域配置 JSON 文件的完整路径
        """
        return self.user_data_dir(user_id) / "topics.json"

    def user_index_cache_path(self, user_id: str) -> Path:
        """
        获取指定用户的索引缓存目录路径

        Args:
            user_id: 用户唯一标识符

        Returns:
            Path: 用户索引缓存目录的完整路径
        """
        return self.user_data_dir(user_id) / ".index_cache"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


# 全局配置单例，供其他模块导入使用
settings = Settings()
