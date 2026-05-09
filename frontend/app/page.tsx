'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import DocumentUpload from '@/components/DocumentUpload';
import ChatWindow from '@/components/ChatWindow';
import { UploadResult } from '@/lib/api';

const USER_ID = 'demo-user';
const STORAGE_KEY = 'scholarmind_docs';

interface UploadedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
}

export default function Home() {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as UploadedDoc[];
        setDocs(parsed);
        if (parsed.length > 0) setActiveDocId(parsed[0].documentId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch {}
  }, [docs]);

  function handleUploadSuccess(result: UploadResult, filename: string) {
    const doc: UploadedDoc = {
      documentId: result.document_id,
      filename,
      chunkCount: result.chunk_count,
    };
    setDocs((prev) => [doc, ...prev]);
    setActiveDocId(result.document_id);
  }

  function handleDelete(docId: string) {
    const updated = docs.filter((d) => d.documentId !== docId);
    setDocs(updated);
    if (activeDocId === docId) {
      setActiveDocId(updated[0]?.documentId ?? null);
    }
  }

  async function handleCopyId(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <header className="border-b border-[#2a2d3e] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3ecf8e]/20 flex items-center justify-center">
            <span className="text-[#3ecf8e] text-sm font-bold">S</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-none">ScholarMind</h1>
            <p className="text-[#9ca3af] text-xs mt-0.5">AI Study Assistant</p>
          </div>
        </div>
        <a href="/quiz" className="text-sm text-[#9ca3af] hover:text-[#3ecf8e] transition-colors">
          Quiz Mode →
        </a>
      </header>

      <main className="flex-1 flex gap-0 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        <aside className="w-80 border-r border-[#2a2d3e] flex flex-col p-4 gap-4 overflow-y-auto shrink-0">
          <DocumentUpload userId={USER_ID} onUploadSuccess={handleUploadSuccess} />

          {docs.length > 0 && (
            <div>
              <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wider mb-2 px-1">
                Documents
              </p>
              <div className="space-y-1.5">
                {docs.map((doc) => (
                  <div key={doc.documentId} className="relative group">
                    <button
                      onClick={() => setActiveDocId(doc.documentId)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors pr-8 cursor-pointer ${
                        activeDocId === doc.documentId
                          ? 'bg-[#3ecf8e]/10 text-[#3ecf8e] border border-[#3ecf8e]/30'
                          : 'text-[#9ca3af] hover:bg-[#1c1e2e] hover:text-white border border-transparent'
                      }`}
                    >
                      <p className="font-medium truncate">{doc.filename}</p>
                      <p className="text-xs opacity-60 mt-0.5">{doc.chunkCount} chunks</p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="font-mono text-[10px] bg-[#0f1117] border border-[#2a2d3e] rounded px-1.5 py-0.5 text-[#9ca3af] truncate cursor-text select-text">
                          {doc.documentId}
                        </span>
                        <button
                          onClick={(e) => handleCopyId(e, doc.documentId)}
                          title="Copy UUID"
                          className="shrink-0 p-0.5 text-[#9ca3af] hover:text-[#3ecf8e] transition-colors cursor-pointer"
                        >
                          {copiedId === doc.documentId ? (
                            <Check className="w-3 h-3 text-[#3ecf8e]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.documentId); }}
                      title="Remove"
                      className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-[#9ca3af] hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 1l10 10M11 1L1 11" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className="flex-1 p-4 overflow-hidden">
          <ChatWindow userId={USER_ID} documentId={activeDocId} />
        </div>
      </main>
    </div>
  );
}
