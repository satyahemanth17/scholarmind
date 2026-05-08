import os
from functools import lru_cache
from mangum import Mangum
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from supabase import create_client, Client

from src.services import chunker, embeddings
from src.utils.s3 import uploadToS3

app = FastAPI()


@lru_cache(maxsize=1)
def _get_supabase() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Form(...),
):
    file_bytes = await file.read()
    filename = file.filename or "document.pdf"

    # Extract text and chunk
    text = chunker.extractTextFromPDF(file_bytes)
    chunks = chunker.chunkDocument(text, {"filename": filename, "user_id": user_id})

    # Upload PDF to S3
    s3_key = f"uploads/{user_id}/{filename}"
    s3_url = uploadToS3(file_bytes, s3_key, "application/pdf")

    # Generate embeddings for all chunks
    contents = [c["content"] for c in chunks]
    batch_embeddings = embeddings.generateBatchEmbeddings(contents)

    # Store document record in Supabase
    supabase = _get_supabase()
    doc_result = (
        supabase.table("documents")
        .insert({"user_id": user_id, "filename": filename, "s3_key": s3_key})
        .execute()
    )
    document_id = doc_result.data[0]["id"]

    # Store all chunks with embeddings
    chunk_rows = [
        {
            "document_id": document_id,
            "content": chunks[i]["content"],
            "page_number": chunks[i].get("page_number"),
            "chunk_index": chunks[i]["chunk_index"],
            "embedding": batch_embeddings[i],
        }
        for i in range(len(chunks))
    ]
    supabase.table("chunks").insert(chunk_rows).execute()

    return JSONResponse(
        {
            "document_id": document_id,
            "chunk_count": len(chunks),
            "s3_url": s3_url,
        }
    )


handler = Mangum(app)
