import os
from typing import TypedDict, Annotated
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages


class RAGState(TypedDict):
    query: str
    chunks: list[dict]
    answer: str
    citations: list[dict]
    messages: Annotated[list, add_messages]


SYSTEM_PROMPT = """You are ScholarMind, an AI study assistant.

Rules you must always follow:
1. Answer directly using the document context provided. Never ask for clarification.
2. Use ALL provided context to construct the best possible answer, even if only partially relevant. Cite sources (filename + page number).
3. Only if the context is completely empty should you say: "I couldn't find relevant content in the document."
4. Be concise and accurate. Synthesize across multiple context chunks when needed."""


def _build_graph():
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.2,
        openai_api_key=os.environ["OPENAI_API_KEY"],
    )

    def agent_node(state: RAGState):
        context = "\n\n".join(
            f"[{c.get('filename', 'doc')}, p.{c.get('page_number', '?')}]: {c['content']}"
            for c in state["chunks"]
        )
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(
                content=f"Document context:\n{context or '(no relevant content found)'}\n\nQuestion: {state['query']}"
            ),
        ]
        response = llm.invoke(messages)
        return {"messages": [response]}

    def finalize_node(state: RAGState):
        last = state["messages"][-1]
        answer = getattr(last, "content", str(last))
        citations = [
            {
                "filename": c.get("filename", "unknown"),
                "page_number": c.get("page_number"),
                "content": c["content"][:200],
            }
            for c in state["chunks"]
        ]
        return {"answer": answer, "citations": citations}

    graph = StateGraph(RAGState)
    graph.add_node("agent", agent_node)
    graph.add_node("finalize", finalize_node)
    graph.set_entry_point("agent")
    graph.add_edge("agent", "finalize")
    graph.add_edge("finalize", END)
    return graph.compile()


_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph


def generateAnswer(query: str, chunks: list[dict], user_id: str) -> dict:
    result = _get_graph().invoke({"query": query, "chunks": chunks, "messages": []})
    return {
        "answer": result.get("answer", ""),
        "citations": result.get("citations", []),
        "tool_calls": [],
    }
