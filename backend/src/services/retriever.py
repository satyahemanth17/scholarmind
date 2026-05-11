import os
from typing import Optional
from functools import lru_cache
from supabase import create_client, Client


@lru_cache(maxsize=1)
def _get_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def similaritySearch(
    query_embedding: list[float],
    user_id: str,
    match_count: int = 5,
    document_id: Optional[str] = None,
) -> list[dict]:
    client = _get_client()
    result = client.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_threshold": 0.3,
            "match_count": match_count,
            "filter_user_id": user_id,
        },
    ).execute()
    rows = result.data or []
    if document_id:
        rows = [r for r in rows if r.get("document_id") == document_id]
    return rows
