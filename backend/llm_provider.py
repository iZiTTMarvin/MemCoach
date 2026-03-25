import os

from langchain_openai import ChatOpenAI
from llama_index.llms.openai_like import OpenAILike

from backend.config import settings

_embedding_instance = None
_llama_llm_instance = None


def get_langchain_llm():
    """LangChain ChatModel for LangGraph nodes (via OpenAI-compatible proxy)."""
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
    """Embedding model (singleton). API mode if embedding_api_base is set, else local HuggingFace."""
    global _embedding_instance
    if _embedding_instance is None:
        if settings.embedding_api_base:
            from llama_index.embeddings.openai import OpenAIEmbedding
            _embedding_instance = OpenAIEmbedding(
                model_name=settings.embedding_model,
                api_base=settings.embedding_api_base,
                api_key=settings.embedding_api_key,
            )
        else:
            from llama_index.embeddings.huggingface import HuggingFaceEmbedding
            local_path = settings.base_dir / "data" / "models" / "bge-m3"
            if local_path.exists():
                _embedding_instance = HuggingFaceEmbedding(model_name=str(local_path))
            else:
                _embedding_instance = HuggingFaceEmbedding(model_name=settings.embedding_model)
    return _embedding_instance
