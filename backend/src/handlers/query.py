import os
from typing import Optional
from mangum import Mangum
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.services import embeddings, retriever, llm

app = FastAPI()


class QueryRequest(BaseModel):
    query: str
    user_id: str
    document_id: Optional[str] = None
    document_ids: Optional[list[str]] = None


@app.post("/query")
async def query_documents(req: QueryRequest):
    try:
        supabase_url = os.environ.get("SUPABASE_URL", "NOT SET")
        supabase_key = os.environ.get("SUPABASE_KEY", "NOT SET")
        print(f"[query] SUPABASE_URL={supabase_url}")
        print(f"[query] SUPABASE_KEY={supabase_key[:10]}...")

        doc_ids = req.document_ids or ([req.document_id] if req.document_id else None)
        print(f"[query] user_id={req.user_id} document_ids={doc_ids} query={req.query[:80]!r}")

        query_embedding = embeddings.generateEmbedding(req.query)
        chunks = retriever.similaritySearch(
            query_embedding, req.user_id, match_count=10, document_ids=doc_ids
        )
        print(f"[query] chunks_found={len(chunks)}")
        for c in chunks:
            sim = c.get("similarity", "N/A")
            sim_str = f"{sim:.3f}" if isinstance(sim, float) else str(sim)
            print(f"  chunk: doc={str(c.get('document_id', '?'))[:8]} sim={sim_str} content={c['content'][:80]!r}")

        result = llm.generateAnswer(req.query, chunks, req.user_id)
        return JSONResponse(
            {
                "answer": result["answer"],
                "citations": result["citations"],
                "tool_calls": result.get("tool_calls", []),
            }
        )
    except Exception as e:
        import traceback
        print(f"[query] ERROR: {e}")
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


handler = Mangum(app)
