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


@app.post("/query")
async def query_documents(req: QueryRequest):
    try:
        query_embedding = embeddings.generateEmbedding(req.query)
        chunks = retriever.similaritySearch(
            query_embedding, req.user_id, document_id=req.document_id
        )
        result = llm.generateAnswer(req.query, chunks, req.user_id)
        return JSONResponse(
            {
                "answer": result["answer"],
                "citations": result["citations"],
                "tool_calls": result.get("tool_calls", []),
            }
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


handler = Mangum(app)
