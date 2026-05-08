from mangum import Mangum
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.services import embeddings, retriever, llm

app = FastAPI()


class QueryRequest(BaseModel):
    query: str
    user_id: str


@app.post("/query")
async def query_documents(req: QueryRequest):
    # Generate embedding for the query
    query_embedding = embeddings.generateEmbedding(req.query)

    # Retrieve relevant chunks via similarity search
    chunks = retriever.similaritySearch(query_embedding, req.user_id)

    # Generate answer via LangGraph RAG agent
    result = llm.generateAnswer(req.query, chunks, req.user_id)

    return JSONResponse(
        {
            "answer": result["answer"],
            "citations": result["citations"],
            "tool_calls": result.get("tool_calls", []),
        }
    )


handler = Mangum(app)
