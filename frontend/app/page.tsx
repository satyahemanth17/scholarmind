'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Network, TrendingUp } from 'lucide-react';
import ChatWindow, { Message } from '@/components/ChatWindow';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import MasteryDashboard from '@/components/MasteryDashboard';
import ChatSidebar, { ChatSession } from '@/components/ChatSidebar';
import {
  UploadResult,
  fetchKnowledgeGraph,
  GraphData,
  fetchSessions,
  createSession,
  updateSession,
  deleteSessionRemote,
} from '@/lib/api';
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

  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  useEffect(() => { currentSessionIdRef.current = currentSessionId; }, [currentSessionId]);

  const activeDocId = selectedDocIds[0] ?? null;
  const activeDocName = docs.find((d) => d.documentId === activeDocId)?.filename;

  // Helpers: per-session doc persistence in localStorage
  function saveSessionDocs(userId: string, sessionId: string, docsToSave: UploadedDoc[]) {
    try {
      localStorage.setItem(`scholarmind-session-docs-${userId}-${sessionId}`, JSON.stringify(docsToSave));
    } catch {}
  }

  function loadSessionDocs(userId: string, sessionId: string): UploadedDoc[] {
    try {
      const saved = localStorage.getItem(`scholarmind-session-docs-${userId}-${sessionId}`);
      return saved ? (JSON.parse(saved) as UploadedDoc[]) : [];
    } catch { return []; }
  }

  // Load auth and sessions on mount (docs load per-session via currentSessionId effect below)
  useEffect(() => {
    const currentAuth = getAuth();
    if (!currentAuth) { router.replace('/login'); return; }
    setAuth(currentAuth);

    const isGuestUser = currentAuth.userId.startsWith('guest-');

    if (isGuestUser) {
      // Guest: load sessions from localStorage
      try {
        const savedSessions = localStorage.getItem(`scholarmind-sessions-${currentAuth.userId}`);
        if (savedSessions) {
          const parsed = JSON.parse(savedSessions) as ChatSession[];
          setSessions(parsed);
          setCurrentSessionId(parsed.length > 0 ? parsed[0].id : crypto.randomUUID());
        } else {
          setCurrentSessionId(crypto.randomUUID());
        }
      } catch {
        setCurrentSessionId(crypto.randomUUID());
      }
    } else {
      // GitHub user: fetch sessions from Supabase
      fetchSessions(currentAuth.userId)
        .then((apiSessions) => {
          const mapped: ChatSession[] = apiSessions.map((s) => ({
            id: s.id,
            title: s.title,
            preview: s.preview,
            documentIds: s.document_ids,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            pinned: s.is_pinned,
            messages: s.messages,
          }));
          setSessions(mapped);
          // Cache messages + docs metadata per-session in localStorage for ChatWindow
          apiSessions.forEach((s) => {
            try {
              localStorage.setItem(
                `scholarmind-session-msgs-${currentAuth.userId}-${s.id}`,
                JSON.stringify(Array.isArray(s.messages) ? s.messages : []),
              );
              // Cache docs metadata so filenames restore correctly
              if (Array.isArray(s.documents_metadata) && s.documents_metadata.length > 0) {
                localStorage.setItem(
                  `scholarmind-session-docs-${currentAuth.userId}-${s.id}`,
                  JSON.stringify(s.documents_metadata),
                );
              }
            } catch {}
          });
          setCurrentSessionId(mapped.length > 0 ? mapped[0].id : crypto.randomUUID());
        })
        .catch(() => {
          setCurrentSessionId(crypto.randomUUID());
        });
    }
  }, [router]);

  // Tracks the last session for which we've loaded docs (guards the save effect on mount)
  const prevSessionIdRef = useRef<string | null>(null);

  // Persist per-session docs to localStorage + Supabase (fires on upload/delete/session-switch).
  // Guard: skip if we haven't finished loading for this session yet (prevents overwriting on mount).
  useEffect(() => {
    if (!auth || !currentSessionId) return;
    if (prevSessionIdRef.current !== currentSessionId) return; // load effect hasn't run yet
    saveSessionDocs(auth.userId, currentSessionId, docs);
    if (!auth.userId.startsWith('guest-')) {
      updateSession(currentSessionId, {
        document_ids: docs.map((d) => d.documentId),
        documents_metadata: docs,
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, auth, currentSessionId]);

  // Load per-session docs when currentSessionId changes (initial mount + session restore)
  useEffect(() => {
    if (!auth || !currentSessionId) return;
    if (prevSessionIdRef.current === currentSessionId) return;
    prevSessionIdRef.current = currentSessionId;

    const sessionDocs = loadSessionDocs(auth.userId, currentSessionId);
    setDocs(sessionDocs);
    setSelectedDocIds(sessionDocs.map((d) => d.documentId));
    // Load graph caches for this session's docs
    const cachedGraphs: Record<string, GraphData> = {};
    sessionDocs.forEach((doc) => {
      try {
        const cached = localStorage.getItem(`scholarmind-graph-${auth.userId}-${doc.documentId}`);
        if (cached) cachedGraphs[doc.documentId] = JSON.parse(cached);
      } catch {}
    });
    if (Object.keys(cachedGraphs).length > 0) setGraphCache(cachedGraphs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, currentSessionId]);

  // Persist sessions to localStorage (guest users only — Supabase handles GitHub users)
  useEffect(() => {
    if (!auth || !auth.userId.startsWith('guest-')) return;
    try {
      localStorage.setItem(`scholarmind-sessions-${auth.userId}`, JSON.stringify(sessions));
    } catch {}
  }, [sessions, auth]);

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
      localStorage.setItem(`scholarmind-graph-${auth.userId}-${activeDocId}`, JSON.stringify(result));
    } catch {}
    setGraphLoading(false);
  }

  const sendToChat = useCallback((message: string) => {
    setPendingMessage(message);
    setActiveTab('chat');
  }, []);

  // Session management
  const handleNewChat = useCallback(() => {
    // Save current session's docs before clearing so it restores on switch-back
    if (auth && currentSessionId) {
      saveSessionDocs(auth.userId, currentSessionId, docs);
    }
    const newId = crypto.randomUUID();
    prevSessionIdRef.current = newId; // prevent the load effect from overriding the empty state
    setDocs([]);
    setSelectedDocIds([]);
    setCurrentSessionId(newId);
    setActiveTab('chat');
  }, [auth, currentSessionId, docs]);

  const handleSelectSession = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    if (id === currentSessionId) return;

    // Save current session's docs before switching
    if (auth && currentSessionId) {
      saveSessionDocs(auth.userId, currentSessionId, docs);
    }

    // Restore target session's docs
    const targetDocs = auth ? loadSessionDocs(auth.userId, id) : [];
    setDocs(targetDocs);
    setSelectedDocIds(targetDocs.map((d) => d.documentId));
    prevSessionIdRef.current = id; // prevent load effect from double-loading

    // Load graph caches for the restored docs
    const cachedGraphs: Record<string, GraphData> = {};
    if (auth) {
      targetDocs.forEach((doc) => {
        try {
          const cached = localStorage.getItem(`scholarmind-graph-${auth.userId}-${doc.documentId}`);
          if (cached) cachedGraphs[doc.documentId] = JSON.parse(cached);
        } catch {}
      });
    }
    if (Object.keys(cachedGraphs).length > 0) setGraphCache(cachedGraphs);
    else setGraphCache({});

    // GitHub users: sync messages from Supabase sessions state to localStorage
    const isGuest = auth?.userId.startsWith('guest-');
    if (!isGuest && auth && Array.isArray(session.messages) && session.messages.length > 0) {
      try {
        localStorage.setItem(
          `scholarmind-session-msgs-${auth.userId}-${id}`,
          JSON.stringify(session.messages),
        );
      } catch {}
    }

    setCurrentSessionId(id);
    setActiveTab('chat');
  }, [sessions, auth, currentSessionId, docs]);

  const handleDeleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      if (auth) localStorage.removeItem(`scholarmind-session-msgs-${auth.userId}-${id}`);
    } catch {}
    if (auth && !auth.userId.startsWith('guest-')) {
      deleteSessionRemote(id).catch(() => {});
    }
    if (currentSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setCurrentSessionId(remaining.length > 0 ? remaining[0].id : crypto.randomUUID());
    }
  }, [currentSessionId, sessions, auth]);

  const handlePinSession = useCallback((id: string) => {
    setSessions((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const newPinned = !s.pinned;
      if (auth && !auth.userId.startsWith('guest-')) {
        updateSession(id, { is_pinned: newPinned }).catch(() => {});
      }
      return { ...s, pinned: newPinned };
    }));
  }, [auth]);

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setSessions((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      if (auth && !auth.userId.startsWith('guest-')) {
        updateSession(id, { title: newTitle }).catch(() => {});
      }
      return { ...s, title: newTitle };
    }));
  }, [auth]);

  const handleSessionUpdate = useCallback((title: string, preview: string) => {
    if (!currentSessionId || !auth) return;
    const now = new Date().toISOString();
    const isGuest = auth.userId.startsWith('guest-');
    const docIds = docs.map((d) => d.documentId);
    setSessions((prev) => {
      const existing = prev.find((s) => s.id === currentSessionId);
      const updated: ChatSession = {
        id: currentSessionId,
        title,
        preview,
        documentIds: docIds,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        pinned: existing?.pinned,
      };
      if (!isGuest) {
        if (existing) {
          updateSession(currentSessionId, {
            title,
            preview,
            document_ids: docIds,
            documents_metadata: docs,
          }).catch(() => {});
        } else {
          createSession({
            id: currentSessionId,
            user_id: auth.userId,
            title,
            preview,
            messages: [],
            document_ids: docIds,
            documents_metadata: docs,
            is_pinned: false,
          }).catch(() => {});
        }
      }
      if (existing) {
        return [updated, ...prev.filter((s) => s.id !== currentSessionId)];
      }
      return [updated, ...prev];
    });
  }, [currentSessionId, docs, auth]);

  // Immediate messages sync to Supabase + sessions state (GitHub users only)
  const handleMessagesChange = useCallback((msgs: Message[]) => {
    if (!auth || auth.userId.startsWith('guest-') || !currentSessionIdRef.current) return;
    const sid = currentSessionIdRef.current;
    updateSession(sid, { messages: msgs as unknown[] }).catch(() => {});
    // Keep sessions state current so handleSelectSession has fresh messages
    setSessions((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, messages: msgs as unknown[] } : s)),
    );
  }, [auth]);

  if (!auth) return null;

  const initials = auth.username.slice(0, 2).toUpperCase();

  const TABS: { id: ActiveTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'graph', label: 'Knowledge Graph', icon: <Network className="w-3 h-3" /> },
    { id: 'mastery', label: 'Mastery', icon: <TrendingUp className="w-3 h-3" /> },
  ];

  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0a] flex flex-col">
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
        {/* Chat history sidebar */}
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          username={auth.username}
          avatarUrl={auth.avatarUrl}
          initials={initials}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onPinSession={handlePinSession}
          onRenameSession={handleRenameSession}
          onLogout={handleLogout}
        />

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
                key={currentSessionId ?? 'no-session'}
                userId={auth.userId}
                docs={docs}
                onDeleteDoc={handleDeleteDoc}
                onUploadSuccess={handleUploadSuccess}
                username={auth.username}
                pendingMessage={pendingMessage}
                onPendingConsumed={() => setPendingMessage(null)}
                sessionId={currentSessionId}
                sessionTitle={sessions.find((s) => s.id === currentSessionId)?.title}
                onSessionUpdate={handleSessionUpdate}
                onMessagesChange={handleMessagesChange}
                onPinSession={currentSessionId ? () => handlePinSession(currentSessionId) : undefined}
                onRenameSession={currentSessionId ? (t) => handleRenameSession(currentSessionId, t) : undefined}
                onDeleteSession={currentSessionId ? () => { handleDeleteSession(currentSessionId); } : undefined}
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
                      {activeDocId ? (activeDocName || 'Document loaded') : 'Upload a document to start'}
                    </span>
                    {activeDocId && graphCache[activeDocId] && (
                      <span className="text-xs text-[#6b6b6b]">
                        · {graphCache[activeDocId].nodes.length} concepts, {graphCache[activeDocId].edges.length} edges
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a href="/graph" className="text-xs text-[#6b6b6b] hover:text-white transition-colors">
                      Full screen ↗
                    </a>
                    {activeDocId && (
                      <button
                        onClick={handleGenerateGraph}
                        disabled={graphLoading}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#6366f1]/20 border border-[#6366f1]/30 text-[#6366f1] hover:bg-[#6366f1]/30 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {graphLoading ? 'Generating...' : graphCache[activeDocId] ? 'Regenerate' : 'Generate Graph'}
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
