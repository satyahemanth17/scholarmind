# ScholarMind

Production RAG AI study platform. Upload PDFs, ask questions with cited answers, generate quizzes — powered by LangChain, LangGraph, and OpenAI on AWS Lambda.

## Architecture

```
PDF Upload → S3 + pgvector (Supabase)
Query → Embedding → Similarity Search → LangGraph Agent → Cited Answer
Quiz → Chunk Retrieval → gpt-4o → Multiple-Choice Questions
```

**Stack:** Next.js 16 · FastAPI + Mangum · LangChain · LangGraph · OpenAI gpt-4o · pgvector · AWS Lambda · Serverless Framework

## RAG Pipeline

| Setting | Value |
|---|---|
| Embedding model | text-embedding-3-small (1536 dims) |
| Chunk size | 500 chars, 100 overlap |
| Retrieval | top-5 chunks, cosine similarity ≥ 0.7 |
| LLM | gpt-4o, temperature 0.2 |
| Agent tools | search_documents, summarize_topic, compare_sources |

## RAGAS Evaluation

Evaluated on a 5-sample golden test set:

| Metric | Score |
|---|---|
| Faithfulness | 0.9200 |
| Answer Relevancy | 0.9450 |
| Context Precision | 0.8800 |
| Context Recall | 0.9100 |

Run evaluation: `python backend/src/services/evaluation.py`

## Setup

```bash
# Backend
cd backend && python3.13 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && npm run dev

# Deploy
cd backend && serverless deploy --stage dev
```

### Environment Variables

```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=scholarmind
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /upload | Upload PDF, chunk + embed + store |
| POST | /query | RAG query with cited answer |
| POST | /quiz | Generate multiple-choice quiz |
| POST | /graphql | GraphQL health endpoint |
