from typing import Optional
from functools import lru_cache
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client
import os

app = FastAPI()


@lru_cache(maxsize=1)
def _get_client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


class CreateSessionRequest(BaseModel):
    id: Optional[str] = None
    user_id: str
    title: str = "New conversation"
    preview: str = ""
    messages: list = []
    document_ids: list[str] = []
    is_pinned: bool = False


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = None
    preview: Optional[str] = None
    messages: Optional[list] = None
    document_ids: Optional[list[str]] = None
    is_pinned: Optional[bool] = None


@app.get("/sessions/{user_id}")
async def get_sessions(user_id: str):
    try:
        client = _get_client()
        result = (
            client.table("chat_sessions")
            .select("id, title, preview, document_ids, is_pinned, messages, created_at, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return JSONResponse(result.data or [])
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/sessions")
async def create_session(req: CreateSessionRequest):
    try:
        client = _get_client()
        now = datetime.now(timezone.utc).isoformat()
        data: dict = {
            "user_id": req.user_id,
            "title": req.title,
            "preview": req.preview,
            "messages": req.messages,
            "document_ids": req.document_ids,
            "is_pinned": req.is_pinned,
            "created_at": now,
            "updated_at": now,
        }
        if req.id:
            data["id"] = req.id
        result = client.table("chat_sessions").insert(data).execute()
        return JSONResponse(result.data[0] if result.data else {})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.put("/sessions/{session_id}")
async def update_session(session_id: str, req: UpdateSessionRequest):
    try:
        client = _get_client()
        updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if req.title is not None:
            updates["title"] = req.title
        if req.preview is not None:
            updates["preview"] = req.preview
        if req.messages is not None:
            updates["messages"] = req.messages
        if req.document_ids is not None:
            updates["document_ids"] = req.document_ids
        if req.is_pinned is not None:
            updates["is_pinned"] = req.is_pinned
        result = (
            client.table("chat_sessions")
            .update(updates)
            .eq("id", session_id)
            .execute()
        )
        return JSONResponse(result.data[0] if result.data else {})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    try:
        client = _get_client()
        client.table("chat_sessions").delete().eq("id", session_id).execute()
        return JSONResponse({"success": True})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
