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
    match_count: int = 10,
    document_id: Optional[str] = None,
    document_ids: Optional[list[str]] = None,
) -> list[dict]:
    client = _get_client()
    target_ids = document_ids or ([document_id] if document_id else None)

    if target_ids:
        # When filtering by specific docs, fetch ALL user chunks ranked by similarity
        # (low threshold, high limit) then filter by doc_id in Python.
        # This avoids the bug where target doc chunks rank outside the top N globally.
        result = client.rpc(
            "match_chunks",
            {
                "query_embedding": query_embedding,
                "match_threshold": 0.1,
                "match_count": 2000,
                "filter_user_id": user_id,
            },
        ).execute()
        rows = result.data or []
        doc_set = set(str(d) for d in target_ids)
        rows = [r for r in rows if str(r.get("document_id", "")) in doc_set]
        return rows[:match_count]

    result = client.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_threshold": 0.05,
            "match_count": match_count,
            "filter_user_id": user_id,
        },
    ).execute()
    rows = result.data or []
    # Retry with lower threshold if nothing returned
    if not rows:
        result = client.rpc(
            "match_chunks",
            {
                "query_embedding": query_embedding,
                "match_threshold": 0.01,
                "match_count": match_count,
                "filter_user_id": user_id,
            },
        ).execute()
        rows = result.data or []
    return rows


def fetchDocumentChunks(document_id: str, limit: int = 30) -> list[dict]:
    client = _get_client()
    result = (
        client.table("chunks")
        .select("id, content, page_number, document_id")
        .eq("document_id", document_id)
        .limit(limit)
        .execute()
    )
    return result.data or []
