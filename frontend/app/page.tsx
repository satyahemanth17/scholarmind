'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, LogOut, Network, TrendingUp } from 'lucide-react';
import DocumentUpload from '@/components/DocumentUpload';
import ChatWindow from '@/components/ChatWindow';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import MasteryDashboard from '@/components/MasteryDashboard';
import { UploadResult, fetchKnowledgeGraph, GraphData } from '@/lib/api';
import { getAuth, clearAuth, AuthState } from '@/lib/auth';

interface UploadedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
}

type ActiveTab = 'chat' | 'graph' | 'mastery';

export default function Home() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [graphCache, setGraphCache] = useState<Record<string, GraphData>>({});
  const [graphLoading, setGraphLoading] = useState(false);

  useEffect(() => {
    const currentAuth = getAuth();
    if (!currentAuth) { router.replace('/login'); return; }
    setAuth(currentAuth);

    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (nav?.type === 'reload') {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('scholarmind-') && !k.startsWith('scholarmind-auth')) {
            localStorage.removeItem(k);
          }
        });
        return;
      }
    } catch {}

    try {
      const saved = localStorage.getItem(`scholarmind-docs-${currentAuth.userId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as UploadedDoc[];
        setDocs(parsed);
        if (parsed.length > 0) setActiveDocId(parsed[0].documentId);

        const cachedGraphs: Record<string, GraphData> = {};
        parsed.forEach((doc) => {
          try {
            const cached = localStorage.getItem(`scholarmind-graph-${currentAuth.userId}-${doc.documentId}`);
            if (cached) cachedGraphs[doc.documentId] = JSON.parse(cached);
          } catch {}
        });
        setGraphCache(cachedGraphs);
      }
    } catch {}
  }, [router]);

  useEffect(() => {
    if (!auth) return;
    try {
      localStorage.setItem(`scholarmind-docs-${auth.userId}`, JSON.stringify(docs));
    } catch {}
  }, [docs, auth]);

  function handleUploadSuccess(result: UploadResult, filename: string) {
    const doc: UploadedDoc = {
      documentId: result.document_id,
      filename,
      chunkCount: result.chunk_count,
    };
    setDocs((prev) => [doc, ...prev]);
    setActiveDocId(result.document_id);
    setActiveTab('chat');
  }

  function handleDelete(docId: string) {
    const updated = docs.filter((d) => d.documentId !== docId);
    setDocs(updated);
    if (activeDocId === docId) {
      setActiveDocId(updated[0]?.documentId ?? null);
    }
    setGraphCache((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    try {
      localStorage.removeItem(`scholarmind-chat-${auth?.userId}-${docId}`);
      localStorage.removeItem(`scholarmind-graph-${auth?.userId}-${docId}`);
      localStorage.removeItem(`scholarmind-mastery-${auth?.userId}-${docId}`);
    } catch {}
  }

  async function handleCopyId(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  }

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  async function handleGenerateGraph() {
    if (!activeDocId || !auth || graphLoading) return;
    setGraphLoading(true);
    try {
      const result = await fetchKnowledgeGraph(activeDocId, auth.userId);
      setGraphCache((prev) => ({ ...prev, [activeDocId]: result }));
      localStorage.setItem(
        `scholarmind-graph-${auth.userId}-${activeDocId}`,
        JSON.stringify(result),
      );
    } catch {}
    setGraphLoading(false);
  }

  function sendToChat(message: string) {
    setPendingMessage(message);
    setActiveTab('chat');
  }

  if (!auth) return null;

  const initials = auth.username.slice(0, 2).toUpperCase();
  const activeDocName = docs.find((d) => d.documentId === activeDocId)?.filename;

  const TABS: { id: ActiveTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'graph', label: 'Knowledge Graph', icon: <Network className="w-3 h-3" /> },
    { id: 'mastery', label: 'Mastery', icon: <TrendingUp className="w-3 h-3" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      <header className="border-b border-[#2a2d3e] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3ecf8e]/20 flex items-center justify-center">
            <span className="text-[#3ecf8e] text-sm font-bold">S</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-none">ScholarMind</h1>
            <p className="text-[#9ca3af] text-xs mt-0.5">AI Study Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/quiz" className="text-sm text-[#9ca3af] hover:text-[#3ecf8e] transition-colors">
            Quiz Mode →
          </a>
          <a href="/mastery" className="text-sm text-[#9ca3af] hover:text-[#3ecf8e] transition-colors">
            All Mastery →
          </a>
          <div className="flex items-center gap-2 pl-3 border-l border-[#2a2d3e]">
            {auth.avatarUrl ? (
              <img src={auth.avatarUrl} alt={auth.username} className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#3ecf8e]/20 flex items-center justify-center">
                <span className="text-[#3ecf8e] text-xs font-semibold">{initials}</span>
              </div>
            )}
            <span className="text-sm text-white">{auth.username}</span>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-lg text-[#9ca3af] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex gap-0 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        {/* Sidebar */}
        <aside className="w-80 border-r border-[#2a2d3e] flex flex-col p-4 gap-4 overflow-y-auto shrink-0">
          <DocumentUpload userId={auth.userId} onUploadSuccess={handleUploadSuccess} />

          {docs.length > 0 && (
            <div>
              <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wider mb-2 px-1">
                Documents
              </p>
              <div className="space-y-1.5">
                {docs.map((doc) => (
                  <div key={doc.documentId} className="relative group">
                    <div
                      onClick={() => setActiveDocId(doc.documentId)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${doc.filename}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setActiveDocId(doc.documentId);
                      }}
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
                    </div>
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

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="px-3 pt-2 shrink-0 flex gap-0.5 border-b border-[#2a2d3e] bg-[#0f1117]">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-colors cursor-pointer relative ${
                  activeTab === id
                    ? 'text-white bg-[#1c1e2e] border border-b-[#1c1e2e] border-[#2a2d3e] -mb-px z-10'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-4 overflow-hidden">
            {activeTab === 'chat' && (
              <ChatWindow
                userId={auth.userId}
                documentId={activeDocId}
                username={auth.username}
                documentName={activeDocName}
                pendingMessage={pendingMessage}
                onPendingConsumed={() => setPendingMessage(null)}
              />
            )}

            {activeTab === 'graph' && (
              <div
                className="flex flex-col h-full rounded-xl overflow-hidden border border-[#2a2d3e]"
                style={{ background: 'linear-gradient(180deg, #0f1117 0%, #13151f 100%)' }}
              >
                <div className="px-4 py-3 border-b border-[#2a2d3e] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-[#6366f1]" />
                    <span className="text-sm font-medium text-white">
                      {activeDocId
                        ? (activeDocName || 'Document loaded')
                        : 'Upload a document to start'}
                    </span>
                    {activeDocId && graphCache[activeDocId] && (
                      <span className="text-xs text-[#9ca3af]">
                        · {graphCache[activeDocId].nodes.length} concepts, {graphCache[activeDocId].edges.length} edges
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/graph"
                      className="text-xs text-[#9ca3af] hover:text-white transition-colors"
                    >
                      Full screen ↗
                    </a>
                    {activeDocId && (
                      <button
                        onClick={handleGenerateGraph}
                        disabled={graphLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#6366f1]/20 border border-[#6366f1]/30 text-[#6366f1] hover:bg-[#6366f1]/30 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {graphLoading
                          ? 'Generating...'
                          : graphCache[activeDocId]
                          ? 'Regenerate'
                          : 'Generate Graph'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <KnowledgeGraph
                    data={activeDocId ? (graphCache[activeDocId] ?? null) : null}
                    loading={graphLoading}
                    onNodeClick={(label) => sendToChat(`Explain "${label}" in detail`)}
                  />
                </div>
              </div>
            )}

            {activeTab === 'mastery' && (
              <div
                className="h-full rounded-xl overflow-hidden border border-[#2a2d3e]"
                style={{ background: 'linear-gradient(180deg, #0f1117 0%, #13151f 100%)' }}
              >
                <MasteryDashboard
                  userId={auth.userId}
                  documentId={activeDocId}
                  documentName={activeDocName}
                  onSuggestedQuestion={(q) => sendToChat(q)}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
