import os
import json
from functools import lru_cache
from mangum import Mangum
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

app = FastAPI()


@lru_cache(maxsize=1)
def _get_supabase() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


@lru_cache(maxsize=1)
def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4o",
        temperature=0.3,
        openai_api_key=os.environ["OPENAI_API_KEY"],
    )


class QuizRequest(BaseModel):
    document_id: str
    user_id: str
    num_questions: int = 5


@app.post("/quiz")
async def generate_quiz(req: QuizRequest):
    # Fetch document chunks from Supabase
    supabase = _get_supabase()
    result = (
        supabase.table("chunks")
        .select("content")
        .eq("document_id", req.document_id)
        .execute()
    )
    rows = result.data or []
    context = "\n\n".join(r["content"] for r in rows)

    # Build prompt for quiz generation
    prompt = (
        f"Generate {req.num_questions} multiple-choice questions from this text. "
        "Return a JSON array only (no markdown, no explanation) with this structure: "
        '[{"question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A) ..."}]. '
        f"Text:\n{context}"
    )

    llm = _get_llm()
    response = llm.invoke([HumanMessage(content=prompt)])
    raw = response.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        questions = json.loads(raw)
    except json.JSONDecodeError:
        questions = []

    return JSONResponse({"questions": questions})


handler = Mangum(app)
