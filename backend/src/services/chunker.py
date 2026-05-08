from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
import io


def extractTextFromPDF(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def chunkDocument(text: str, metadata: dict) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    docs = splitter.create_documents([text], metadatas=[metadata])
    return [
        {
            "content": doc.page_content,
            "chunk_index": i,
            "page_number": doc.metadata.get("page_number"),
            "metadata": doc.metadata,
        }
        for i, doc in enumerate(docs)
    ]
