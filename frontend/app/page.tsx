'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Network, TrendingUp } from 'lucide-react';
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
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [graphCache, setGraphCache] = useState<Record<string, GraphData>>({});
  const [graphLoading, setGraphLoading] = useState(false);

  const activeDocId = selectedDocIds[0] ?? null;
  const activeDocName = docs.find((d) => d.documentId === activeDocId)?.filename;

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
        if (parsed.length > 0) setSelectedDocIds([parsed[0].documentId]);

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
    setSelectedDocIds((prev) => [result.document_id, ...prev]);
    setActiveTab('chat');
  }

  function handleDeleteDoc(docId: string) {
    const updated = docs.filter((d) => d.documentId !== docId);
    setDocs(updated);
    setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
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

  function handleToggleDoc(docId: string) {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
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

  const TABS: { id: ActiveTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'graph', label: 'Knowledge Graph', icon: <Network className="w-3 h-3" /> },
    { id: 'mastery', label: 'Mastery', icon: <TrendingUp className="w-3 h-3" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <header className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-none">ScholarMind</h1>
            <p className="text-[#6b6b6b] text-xs mt-0.5">AI Study Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/quiz" className="text-sm text-[#6b6b6b] hover:text-white transition-colors">
            Quiz Mode →
          </a>
          <a href="/mastery" className="text-sm text-[#6b6b6b] hover:text-white transition-colors">
            All Mastery →
          </a>
          <div className="flex items-center gap-2 pl-3 border-l border-[#2a2a2a]">
            {auth.avatarUrl ? (
              <img src={auth.avatarUrl} alt={auth.username} className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white text-xs font-semibold">{initials}</span>
              </div>
            )}
            <span className="text-sm text-white">{auth.username}</span>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-lg text-[#6b6b6b] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex gap-0 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        {/* Sidebar — upload only */}
        <aside className="w-72 border-r border-[#2a2a2a] flex flex-col p-4 gap-4 shrink-0">
          <DocumentUpload userId={auth.userId} onUploadSuccess={handleUploadSuccess} />
          {docs.length === 0 && (
            <p className="text-[#6b6b6b] text-xs text-center leading-relaxed px-2">
              Upload a PDF to start. Manage documents via the pills above the chat input.
            </p>
          )}
          {docs.length > 0 && (
            <p className="text-[#6b6b6b] text-xs text-center">
              {docs.length} document{docs.length !== 1 ? 's' : ''} · select via chat input
            </p>
          )}
        </aside>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="px-3 pt-2 shrink-0 flex gap-0.5 border-b border-[#2a2a2a] bg-[#0a0a0a]">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg transition-colors cursor-pointer relative ${
                  activeTab === id
                    ? 'text-white bg-[#141414] border border-b-[#141414] border-[#2a2a2a] -mb-px z-10'
                    : 'text-[#6b6b6b] hover:text-white'
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
                docs={docs}
                selectedDocIds={selectedDocIds}
                onToggleDoc={handleToggleDoc}
                onDeleteDoc={handleDeleteDoc}
                username={auth.username}
                pendingMessage={pendingMessage}
                onPendingConsumed={() => setPendingMessage(null)}
              />
            )}

            {activeTab === 'graph' && (
              <div
                className="flex flex-col h-full rounded-xl overflow-hidden border border-[#2a2a2a]"
                style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)' }}
              >
                <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-[#6366f1]" />
                    <span className="text-sm font-medium text-white">
                      {activeDocId
                        ? (activeDocName || 'Document loaded')
                        : 'Select a document to start'}
                    </span>
                    {activeDocId && graphCache[activeDocId] && (
                      <span className="text-xs text-[#6b6b6b]">
                        · {graphCache[activeDocId].nodes.length} concepts, {graphCache[activeDocId].edges.length} edges
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/graph"
                      className="text-xs text-[#6b6b6b] hover:text-white transition-colors"
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
                className="h-full rounded-xl overflow-hidden border border-[#2a2a2a]"
                style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)' }}
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
