'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, TrendingUp, BookOpen, Flame } from 'lucide-react';
import { getAuth, clearAuth, AuthState } from '@/lib/auth';
import ScholarMindLogo from '@/components/ScholarMindLogo';

interface SavedDoc { documentId: string; filename: string; chunkCount: number; }
interface StoredMastery {
  mastery: {
    overallMastery: number;
    topics: { name: string; masteryScore: number; status: string; suggestedQuestion: string }[];
    suggestedNextTopic: string;
    studyStreak: number;
  };
  timestamp: string;
}

export default function MasteryPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [docs, setDocs] = useState<SavedDoc[]>([]);
  const [masteryMap, setMasteryMap] = useState<Record<string, StoredMastery>>({});

  useEffect(() => {
    const currentAuth = getAuth();
    if (!currentAuth) { router.replace('/login'); return; }
    setAuth(currentAuth);
    try {
      const saved = localStorage.getItem(`scholarmind-docs-${currentAuth.userId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedDoc[];
        setDocs(parsed);
        const map: Record<string, StoredMastery> = {};
        parsed.forEach((doc) => {
          try {
            const ms = localStorage.getItem(`scholarmind-mastery-${currentAuth.userId}-${doc.documentId}`);
            if (ms) map[doc.documentId] = JSON.parse(ms);
          } catch {}
        });
        setMasteryMap(map);
      }
    } catch {}
  }, [router]);

  function handleLogout() { clearAuth(); router.replace('/login'); }

  if (!auth) return null;

  const initials = auth.username.slice(0, 2).toUpperCase();
  const analyzedDocs = docs.filter((d) => masteryMap[d.documentId]);
  const avgMastery = analyzedDocs.length
    ? Math.round(analyzedDocs.reduce((s, d) => s + masteryMap[d.documentId].mastery.overallMastery, 0) / analyzedDocs.length)
    : null;

  const barColor = (score: number) =>
    score >= 70 ? 'bg-white' : score >= 40 ? 'bg-[#f59e0b]' : 'bg-red-400';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#2a2a2a] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScholarMindLogo size={32} />
          <div>
            <h1 className="text-white font-semibold text-lg leading-none">Mastery Overview</h1>
            <p className="text-[#6b6b6b] text-xs mt-0.5">All documents · Learning progress</p>
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

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {avgMastery !== null && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{avgMastery}%</p>
              <p className="text-[#6b6b6b] text-xs mt-1">Avg Mastery</p>
            </div>
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{analyzedDocs.length}</p>
              <p className="text-[#6b6b6b] text-xs mt-1">Documents Studied</p>
            </div>
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-1">
                <Flame className="w-6 h-6 text-orange-400" />
                <p className="text-3xl font-bold text-orange-400">
                  {Math.max(...analyzedDocs.map((d) => masteryMap[d.documentId].mastery.studyStreak), 0)}
                </p>
              </div>
              <p className="text-[#6b6b6b] text-xs">Best Streak</p>
            </div>
          </div>
        )}

        {docs.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <BookOpen className="w-12 h-12 text-[#6b6b6b] mx-auto" />
            <p className="text-[#6b6b6b]">No documents uploaded yet.</p>
            <a href="/" className="inline-block text-sm text-white hover:underline">Upload a PDF →</a>
          </div>
        )}

        {docs.length > 0 && !analyzedDocs.length && (
          <div className="text-center py-8 bg-[#141414] border border-[#2a2a2a] rounded-xl space-y-3">
            <TrendingUp className="w-10 h-10 text-[#6b6b6b] mx-auto" />
            <p className="text-[#6b6b6b] text-sm">No mastery data yet.</p>
            <p className="text-[#6b6b6b] text-xs">Go to Chat, ask questions and take quizzes, then click &quot;Mastery&quot; → Refresh.</p>
            <a href="/" className="inline-block text-sm text-white hover:underline">Go to Chat →</a>
          </div>
        )}

        {docs.map((doc) => {
          const data = masteryMap[doc.documentId];
          return (
            <div key={doc.documentId} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">{doc.filename}</h3>
                  {data && <p className="text-[#6b6b6b] text-xs mt-0.5">Last analyzed {data.timestamp}</p>}
                </div>
                {data ? (
                  <span className="shrink-0 text-2xl font-bold text-white">{data.mastery.overallMastery}%</span>
                ) : (
                  <a href="/" className="shrink-0 text-xs text-[#6b6b6b] hover:text-white transition-colors">Study →</a>
                )}
              </div>

              {data && (
                <>
                  <div className="space-y-2">
                    {data.mastery.topics.map((topic, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white">{topic.name}</span>
                          <span className="text-[#6b6b6b]">{topic.masteryScore}%</span>
                        </div>
                        <div className="w-full bg-[#0a0a0a] rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${barColor(topic.masteryScore)}`}
                            style={{ width: `${topic.masteryScore}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {data.mastery.topics.some((t) => t.status === 'weak') && (
                    <div className="bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                      <p className="text-red-400 text-xs font-medium">Weakest topic:</p>
                      <p className="text-white text-xs mt-0.5">
                        {data.mastery.topics.find((t) => t.status === 'weak')?.name}
                      </p>
                    </div>
                  )}
                </>
              )}

              {!data && (
                <div className="border border-dashed border-[#2a2a2a] rounded-lg p-4 text-center">
                  <p className="text-[#6b6b6b] text-xs">No mastery data yet. Chat about this document and take a quiz.</p>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
