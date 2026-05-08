'use client';

import { useState } from 'react';
import DocumentUpload from '@/components/DocumentUpload';
import ChatWindow from '@/components/ChatWindow';
import { UploadResult } from '@/lib/api';

const USER_ID = 'demo-user';

interface UploadedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
}

export default function Home() {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  function handleUploadSuccess(result: UploadResult, filename: string) {
    const doc: UploadedDoc = {
      documentId: result.document_id,
      filename,
      chunkCount: result.chunk_count,
    };
    setDocs((prev) => [doc, ...prev]);
    setActiveDocId(result.document_id);
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
                  <button
                    key={doc.documentId}
                    onClick={() => setActiveDocId(doc.documentId)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      activeDocId === doc.documentId
                        ? 'bg-[#3ecf8e]/10 text-[#3ecf8e] border border-[#3ecf8e]/30'
                        : 'text-[#9ca3af] hover:bg-[#1c1e2e] hover:text-white border border-transparent'
                    }`}
                  >
                    <p className="font-medium truncate">{doc.filename}</p>
                    <p className="text-xs opacity-60 mt-0.5">{doc.chunkCount} chunks</p>
                  </button>
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
