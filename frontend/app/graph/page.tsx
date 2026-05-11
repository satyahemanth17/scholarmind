'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Zap, LogOut } from 'lucide-react';
import { getAuth, clearAuth, AuthState } from '@/lib/auth';
import { fetchKnowledgeGraph, GraphData } from '@/lib/api';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import ScholarMindLogo from '@/components/ScholarMindLogo';

interface SavedDoc { documentId: string; filename: string; chunkCount: number; }

export default function GraphPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [docs, setDocs] = useState<SavedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentAuth = getAuth();
    if (!currentAuth) { router.replace('/login'); return; }
    setAuth(currentAuth);
    try {
      const saved = localStorage.getItem(`scholarmind-docs-${currentAuth.userId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedDoc[];
        setDocs(parsed);
        if (parsed.length > 0) setSelectedDoc(parsed[0].documentId);
      }
    } catch {}
  }, [router]);

  useEffect(() => {
    if (!selectedDoc || !auth) return;
    setGraphData(null);
    setError(null);
    try {
      const cached = localStorage.getItem(`scholarmind-graph-${auth.userId}-${selectedDoc}`);
      if (cached) setGraphData(JSON.parse(cached));
    } catch {}
  }, [selectedDoc, auth]);

  async function handleGenerate() {
    if (!selectedDoc || !auth || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchKnowledgeGraph(selectedDoc, auth.userId);
      setGraphData(result);
      localStorage.setItem(`scholarmind-graph-${auth.userId}-${selectedDoc}`, JSON.stringify(result));
    } catch {
      setError('Failed to generate graph. Make sure a document is uploaded and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    canvas.width = svgEl.clientWidth || 1200;
    canvas.height = svgEl.clientHeight || 800;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'knowledge-graph.png';
        a.click();
        URL.revokeObjectURL(url);
      });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
  }

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  if (!auth) return null;

  const docName = docs.find((d) => d.documentId === selectedDoc)?.filename;
  const initials = auth.username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <header className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ScholarMindLogo size={32} />
          <div>
            <h1 className="text-white font-semibold text-lg leading-none">Knowledge Graph</h1>
            <p className="text-[#6b6b6b] text-xs mt-0.5">Concept map from your documents</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-[#6b6b6b] hover:text-white transition-colors">← Chat</a>
          <div className="flex items-center gap-2 pl-3 border-l border-[#2a2a2a]">
            {auth.avatarUrl ? (
              <img src={auth.avatarUrl} alt={auth.username} className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-white text-xs font-semibold">{initials}</span>
              </div>
            )}
            <span className="text-sm text-white">{auth.username}</span>
            <button onClick={handleLogout} title="Log out" className="p-1.5 rounded-lg text-[#6b6b6b] hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 py-3 border-b border-[#2a2a2a] flex items-center gap-3 shrink-0 flex-wrap">
        {docs.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 flex-1">
              {docs.map((doc) => (
                <button
                  key={doc.documentId}
                  onClick={() => setSelectedDoc(doc.documentId)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                    selectedDoc === doc.documentId
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'border-[#2a2a2a] text-[#6b6b6b] hover:border-white/20 hover:text-white'
                  }`}
                >
                  {doc.filename}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {graphData && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#6b6b6b] hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export PNG
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedDoc}
                className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-white text-[#0a0a0a] font-semibold hover:bg-[#e5e5e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                {loading ? 'Generating...' : graphData ? 'Regenerate' : 'Generate Graph'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-[#6b6b6b] text-sm">Upload a document on the Chat page first.</p>
        )}
        {error && <p className="w-full text-red-400 text-xs">{error}</p>}
      </div>

      {graphData && (
        <div className="px-6 py-2 border-b border-[#2a2a2a] flex items-center gap-4 shrink-0">
          <span className="text-[#6b6b6b] text-xs">{graphData.nodes.length} concepts · {graphData.edges.length} relationships</span>
          <span className="text-[#6b6b6b] text-xs">Scroll to zoom · Drag to pan · Click node to explore</span>
        </div>
      )}

      <div ref={svgContainerRef} className="flex-1 overflow-hidden">
        <KnowledgeGraph data={graphData} loading={loading} />
      </div>
    </div>
  );
}
