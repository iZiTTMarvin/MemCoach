"""简历与面试知识库的 LlamaIndex 索引模块。"""
import json
from pathlib import Path

from llama_index.core import (
    SimpleDirectoryReader,
    VectorStoreIndex,
    StorageContext,
    load_index_from_storage,
    Settings as LlamaSettings,
)

from backend.config import settings
from backend.llm_provider import get_llama_llm, get_embedding

# 内存索引缓存，键为 (user_id, topic_or_resume)
_index_cache: dict[tuple[str, str], "VectorStoreIndex"] = {}


def load_topics(user_id: str) -> dict:
    """加载用户的 topics.json，返回 {key: {name, icon, dir}}。"""
    path = settings.user_topics_path(user_id)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {}


def save_topics(topics: dict, user_id: str):
    """将 topics 写回用户的 topics.json。"""
    path = settings.user_topics_path(user_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(topics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def get_topic_map(user_id: str) -> dict[str, str]:
    """返回 {key: dir_name} 的映射。"""
    return {k: v["dir"] for k, v in load_topics(user_id).items()}


def _init_llama_settings():
    """初始化 LlamaIndex 的 LLM 和嵌入模型配置。"""
    LlamaSettings.llm = get_llama_llm()
    LlamaSettings.embed_model = get_embedding()


def build_resume_index(user_id: str, force_rebuild: bool = False) -> VectorStoreIndex:
    """构建或加载简历索引。"""
    cache_key = (user_id, "resume")
    if cache_key in _index_cache and not force_rebuild:
        return _index_cache[cache_key]

    _init_llama_settings()
    resume_path = settings.user_resume_path(user_id)
    cache_dir = settings.user_index_cache_path(user_id) / "resume"

    if cache_dir.exists() and not force_rebuild:
        storage_context = StorageContext.from_defaults(persist_dir=str(cache_dir))
        index = load_index_from_storage(storage_context)
    else:
        docs = SimpleDirectoryReader(
            input_dir=str(resume_path),
            recursive=True,
        ).load_data()
        index = VectorStoreIndex.from_documents(docs)
        cache_dir.mkdir(parents=True, exist_ok=True)
        index.storage_context.persist(persist_dir=str(cache_dir))

    _index_cache[cache_key] = index
    return index


def build_topic_index(topic: str, user_id: str, force_rebuild: bool = False) -> VectorStoreIndex:
    """构建或加载指定领域的知识索引。"""
    cache_key = (user_id, topic)
    if cache_key in _index_cache and not force_rebuild:
        return _index_cache[cache_key]

    _init_llama_settings()

    topic_map = get_topic_map(user_id)
    if topic not in topic_map:
        raise ValueError(f"Unknown topic: {topic}. Available: {list(topic_map.keys())}")

    dir_name = topic_map[topic]
    topic_dir = settings.user_knowledge_path(user_id) / dir_name
    cache_dir = settings.user_index_cache_path(user_id) / topic

    if cache_dir.exists() and not force_rebuild:
        storage_context = StorageContext.from_defaults(persist_dir=str(cache_dir))
        index = load_index_from_storage(storage_context)
    else:
        if not topic_dir.exists():
            raise FileNotFoundError(f"Knowledge directory not found: {topic_dir}")

        docs = SimpleDirectoryReader(
            input_dir=str(topic_dir),
            recursive=True,
            required_exts=[".md", ".txt", ".py"],
        ).load_data()

        if not docs:
            raise ValueError(f"No documents found in {topic_dir}")

        index = VectorStoreIndex.from_documents(docs)
        cache_dir.mkdir(parents=True, exist_ok=True)
        index.storage_context.persist(persist_dir=str(cache_dir))

    _index_cache[cache_key] = index
    return index


def query_resume(question: str, user_id: str, top_k: int = 3) -> str:
    """检索简历内容（纯向量检索，不调用 LLM）。

    参数:
        question: 检索查询文本
        user_id: 用户 ID
        top_k: 返回的最相似片段数量
    返回:
        拼接后的简历文本片段
    """
    index = build_resume_index(user_id)
    retriever = index.as_retriever(similarity_top_k=top_k)
    nodes = retriever.retrieve(question)
    return "\n\n".join(node.get_content() for node in nodes)


def query_topic(topic: str, question: str, user_id: str, top_k: int = 5) -> str:
    """检索领域知识库内容（纯向量检索，不调用 LLM）。

    参数:
        topic: 领域标识
        question: 检索查询文本
        user_id: 用户 ID
        top_k: 返回的最相似片段数量
    返回:
        拼接后的知识文本片段
    """
    index = build_topic_index(topic, user_id)
    retriever = index.as_retriever(similarity_top_k=top_k)
    nodes = retriever.retrieve(question)
    return "\n\n".join(node.get_content() for node in nodes)


def retrieve_topic_context(topic: str, question: str, user_id: str, top_k: int = 5) -> list[str]:
    """从领域索引中检索原始文本片段（用于答案评估）。"""
    index = build_topic_index(topic, user_id)
    retriever = index.as_retriever(similarity_top_k=top_k)
    nodes = retriever.retrieve(question)
    return [node.get_content() for node in nodes]
