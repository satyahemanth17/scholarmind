import os
from functools import lru_cache
from langchain_openai import OpenAIEmbeddings


@lru_cache(maxsize=1)
def _get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=os.environ["OPENAI_API_KEY"],
    )


def generateEmbedding(text: str) -> list[float]:
    return _get_embeddings().embed_query(text)


def generateBatchEmbeddings(texts: list[str]) -> list[list[float]]:
    return _get_embeddings().embed_documents(texts)
