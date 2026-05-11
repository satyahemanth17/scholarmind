import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

GRAPH_PROMPT = """You are a knowledge extraction specialist. Analyze the document and extract a rich knowledge graph.

Return ONLY valid JSON with this exact structure:
{
  "nodes": [
    {"id": "1", "label": "Concept Name", "topic": "Category", "summary": "One to two sentence description."}
  ],
  "edges": [
    {"source": "1", "target": "2", "relationship": "relates to"}
  ]
}

Requirements:
- Extract 15-25 nodes representing key concepts, terms, or ideas
- Create 20-35 edges showing relationships between concepts
- Group nodes into 4-6 topic categories
- Node labels: concise (2-4 words)
- Edge relationships: descriptive verb phrases ("is part of", "causes", "defines", "leads to", "depends on", "contrasts with")
- Return ONLY the JSON object, no markdown, no explanation"""


def extractKnowledgeGraph(document_id: str, chunks: list[dict]) -> dict:
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.1,
        openai_api_key=os.environ["OPENAI_API_KEY"],
    )
    context = "\n\n".join(
        f"[Page {c.get('page_number', '?')}]: {c['content']}"
        for c in chunks[:30]
    )
    messages = [
        SystemMessage(content=GRAPH_PROMPT),
        HumanMessage(content=f"Document content:\n\n{context}\n\nExtract the knowledge graph:"),
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
    nodes = result.get("nodes", [])
    edges = result.get("edges", [])
    for e in edges:
        e["source"] = str(e["source"])
        e["target"] = str(e["target"])
    for n in nodes:
        n["id"] = str(n["id"])
    return {"nodes": nodes, "edges": edges}
