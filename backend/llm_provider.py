import os

from langchain_openai import ChatOpenAI
from llama_index.llms.openai_like import OpenAILike

from backend.config import settings

_embedding_instance = None
_llama_llm_instance = None


def get_langchain_llm():
    """获取 LangChain ChatModel，用于 LangGraph 节点（通过 OpenAI 兼容代理）。"""
    return ChatOpenAI(
        model=settings.model,
        api_key=settings.api_key,
        base_url=settings.api_base,
        temperature=settings.temperature,
    )


def get_llama_llm():
    """LlamaIndex LLM (单例)。

    注意: 某些版本的 llama-index OpenAILike 不会正确将构造参数中的 api_key
    传递给底层 OpenAI 客户端，因此需要同步设置 OPENAI_API_KEY 环境变量作为兜底。
    """
    global _llama_llm_instance
    if _llama_llm_instance is None:
        # 兜底：确保环境变量中也有 API Key，防止 OpenAILike 内部回退读取环境变量时找不到
        if settings.api_key and not os.environ.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = settings.api_key
        _llama_llm_instance = OpenAILike(
            model=settings.model,
            api_key=settings.api_key,
            api_base=settings.api_base,
            temperature=settings.temperature,
            is_chat_model=True,
        )
    return _llama_llm_instance


def get_embedding():
    """获取云端 Embedding 模型（单例），始终走 OpenAI 兼容 API。"""
    global _embedding_instance
    if _embedding_instance is None:
        api_base = settings.resolved_embedding_api_base
        api_key = settings.resolved_embedding_api_key
        if not api_base or not api_key:
            raise RuntimeError(
                "Embedding cloud API not configured. "
                "Set EMBEDDING_API_BASE / EMBEDDING_API_KEY or reuse API_BASE / API_KEY."
            )

        from llama_index.embeddings.openai import OpenAIEmbedding
        _embedding_instance = OpenAIEmbedding(
            model_name=settings.embedding_model,
            api_base=api_base,
            api_key=api_key,
        )
    return _embedding_instance
