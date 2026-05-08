import os
from typing import TypedDict, Annotated
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode


class RAGState(TypedDict):
    query: str
    chunks: list[dict]
    answer: str
    citations: list[dict]
    messages: list


@tool
def search_documents(query: str, user_id: str = "") -> str:
    """Search for relevant document chunks by query."""
    from src.services.embeddings import generateEmbedding
    from src.services.retriever import similaritySearch

    embedding = generateEmbedding(query)
    results = similaritySearch(embedding, user_id)
    return "\n\n".join(r["content"] for r in results)


@tool
def summarize_topic(topic: str, context: str) -> str:
    """Summarize a topic based on provided context."""
    return f"Summary of '{topic}': {context[:500]}"


@tool
def compare_sources(topic: str, sources: list[str]) -> str:
    """Compare information about a topic across multiple sources."""
    return f"Comparison for '{topic}' across {len(sources)} sources."


_TOOLS = [search_documents, summarize_topic, compare_sources]

SYSTEM_PROMPT = """You are ScholarMind, an AI study assistant. Answer questions using only
the provided document context. Always cite your sources with filename and page number.
Be concise and accurate. Temperature: low — prefer factual answers over speculation."""


def _build_graph():
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0.2,
        openai_api_key=os.environ["OPENAI_API_KEY"],
    ).bind_tools(_TOOLS)

    tool_node = ToolNode(_TOOLS)

    def agent_node(state: RAGState):
        context = "\n\n".join(
            f"[{c.get('filename', 'doc')}, p.{c.get('page_number', '?')}]: {c['content']}"
            for c in state["chunks"]
        )
        messages = state.get("messages", []) or [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {state['query']}"),
        ]
        response = llm.invoke(messages)
        return {"messages": messages + [response]}

    def should_continue(state: RAGState):
        last = state["messages"][-1]
        return "tools" if getattr(last, "tool_calls", None) else "finalize"

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
    graph.add_node("tools", tool_node)
    graph.add_node("finalize", finalize_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "finalize": "finalize"})
    graph.add_edge("tools", "agent")
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
