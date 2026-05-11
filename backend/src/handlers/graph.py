from typing import Optional
from mangum import Mangum
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

from src.services import graph as graph_service
from src.services.retriever import fetchDocumentChunks

app = FastAPI()


@app.get("/graph/{document_id}")
async def get_knowledge_graph(
    document_id: str,
    user_id: str = Query(...),
):
    try:
        print(f"[graph] document_id={document_id} user_id={user_id}")
        chunks = fetchDocumentChunks(document_id, limit=30)
        print(f"[graph] chunks_fetched={len(chunks)}")
        if not chunks:
            return JSONResponse({"nodes": [], "edges": [], "error": "No content found for document"})
        result = graph_service.extractKnowledgeGraph(document_id, chunks)
        print(f"[graph] nodes={len(result['nodes'])} edges={len(result['edges'])}")
        return JSONResponse(result)
    except Exception as e:
        print(f"[graph] error={e}")
        return JSONResponse({"error": str(e)}, status_code=500)


handler = Mangum(app)
