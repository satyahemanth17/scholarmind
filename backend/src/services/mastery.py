import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

MASTERY_PROMPT = """You are a learning analytics specialist. Analyze a student's study activity and produce a mastery assessment.

Given their chat history (questions asked) and quiz results, return ONLY valid JSON:
{
  "topics": [
    {
      "name": "Topic Name",
      "masteryScore": 75,
      "questionsAsked": 4,
      "quizCorrect": 3,
      "quizTotal": 4,
      "status": "strong",
      "suggestedQuestion": "What is the relationship between X and Y?"
    }
  ],
  "overallMastery": 72,
  "studyStreak": 1,
  "suggestedNextTopic": "Topic Name"
}

Status rules: "strong" if masteryScore >= 70, "developing" if 40-69, "weak" if <40.
masteryScore combines chat engagement (40%) and quiz accuracy (60%).
Identify 3-6 distinct topics from the document content.
Return ONLY the JSON, no other text."""


def analyzeMastery(
    document_id: str,
    user_id: str,
    chat_history: list[dict],
    quiz_history: list[dict],
    study_streak: int = 1,
) -> dict:
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.1,
        openai_api_key=os.environ["OPENAI_API_KEY"],
    )
    chat_text = "\n".join(
        f"Q: {m['content']}" for m in chat_history if m.get("role") == "user"
    ) or "No chat history yet."
    quiz_text = "\n".join(
        f"Q: {q['question']} | Correct: {q.get('userAnswer') == q.get('answer')} | Answer: {q.get('answer')}"
        for q in quiz_history
    ) or "No quiz history yet."
    messages = [
        SystemMessage(content=MASTERY_PROMPT),
        HumanMessage(
            content=f"Chat questions asked:\n{chat_text}\n\nQuiz results:\n{quiz_text}\n\nStudy streak: {study_streak} day(s)\n\nGenerate mastery assessment:"
        ),
    ]
    response = llm.invoke(messages)
    raw = getattr(response, "content", str(response)).strip()
    for prefix in ("```json", "```"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()
    result = json.loads(raw)
    result["studyStreak"] = study_streak
    return result
