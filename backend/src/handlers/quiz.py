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
    try:
        supabase = _get_supabase()
        result = (
            supabase.table("chunks")
            .select("content")
            .eq("document_id", req.document_id)
            .execute()
        )
        rows = result.data or []
        context = "\n\n".join(r["content"] for r in rows)

        prompt = (
            f"Generate {req.num_questions} multiple-choice questions from this text. "
            "Return a JSON array only (no markdown, no text outside the JSON) with this exact structure: "
            '[{"question": "...", "options": ["option text only", "option text only", "option text only", "option text only"], '
            '"answer": "exact option text that is correct (must match one option exactly)", '
            '"explanation": "Why this answer is correct: ..."}]. '
            "Do NOT include letter prefixes (A), B), etc.) in options or answer — plain text only. "
            f"Text:\n{context}"
        )

        llm = _get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

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
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


handler = Mangum(app)
