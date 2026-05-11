from mangum import Mangum
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.services import mastery as mastery_service

app = FastAPI()


class MasteryRequest(BaseModel):
    user_id: str
    chat_history: list[dict] = []
    quiz_history: list[dict] = []
    study_streak: int = 1


@app.post("/mastery/{document_id}")
async def analyze_mastery(document_id: str, req: MasteryRequest):
    try:
        print(f"[mastery] document_id={document_id} user_id={req.user_id}")
        result = mastery_service.analyzeMastery(
            document_id=document_id,
            user_id=req.user_id,
            chat_history=req.chat_history,
            quiz_history=req.quiz_history,
            study_streak=req.study_streak,
        )
        return JSONResponse(result)
    except Exception as e:
        print(f"[mastery] error={e}")
        return JSONResponse({"error": str(e)}, status_code=500)


handler = Mangum(app)
