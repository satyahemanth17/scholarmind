'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flame, ChevronRight, TrendingUp, RefreshCw } from 'lucide-react';
import { submitMasteryAnalysis, MasteryResult } from '@/lib/api';

interface Props {
  userId: string;
  documentId: string | null;
  documentName?: string;
  onSuggestedQuestion: (question: string) => void;
}

function ProgressRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={96} height={96} className="-rotate-90">
      <circle cx={48} cy={48} r={r} fill="none" stroke="#2a2d3e" strokeWidth={8} />
      <circle
        cx={48} cy={48} r={r}
        fill="none" stroke="#3ecf8e" strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
}

export default function MasteryDashboard({ userId, documentId, documentName, onSuggestedQuestion }: Props) {
  const [mastery, setMastery] = useState<MasteryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const storageKey = documentId ? `scholarmind-mastery-${userId}-${documentId}` : null;

  useEffect(() => {
    if (!storageKey) { setMastery(null); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMastery(parsed.mastery);
        setLastUpdated(parsed.timestamp);
      } else {
        setMastery(null);
      }
    } catch { setMastery(null); }
  }, [storageKey]);

  const refresh = useCallback(async () => {
    if (!documentId || loading) return;
    setLoading(true);
    setError(null);
    try {
      // Read chat history from localStorage
      let chatHistory: { role: string; content: string }[] = [];
      try {
        const chatSaved = localStorage.getItem(`scholarmind-chat-${userId}-${documentId}`);
        if (chatSaved) chatHistory = JSON.parse(chatSaved);
      } catch {}

      // Read quiz history from localStorage
      let quizHistory: { question: string; answer: string; userAnswer?: string }[] = [];
      try {
        const quizSaved = localStorage.getItem(`scholarmind-quiz-state-${userId}`);
        if (quizSaved) {
          const quizState = JSON.parse(quizSaved);
          if (quizState.documentId === documentId && quizState.questions) {
            quizHistory = quizState.questions.map((q: { question: string; answer: string }, idx: number) => ({
              question: q.question,
              answer: q.answer,
              userAnswer: quizState.selectedAnswers?.[idx],
            }));
          }
        }
      } catch {}

      const result = await submitMasteryAnalysis(documentId, userId, chatHistory, quizHistory, 1);
      setMastery(result);
      const ts = new Date().toLocaleString();
      setLastUpdated(ts);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify({ mastery: result, timestamp: ts }));
      }
    } catch {
      setError('Failed to analyze mastery. Ask some questions first, then retry.');
    } finally {
      setLoading(false);
    }
  }, [documentId, userId, loading, storageKey]);

  const statusColor = (status: string) =>
    status === 'strong' ? 'text-[#3ecf8e]' : status === 'developing' ? 'text-[#f59e0b]' : 'text-red-400';

  const barColor = (score: number) =>
    score >= 70 ? 'bg-[#3ecf8e]' : score >= 40 ? 'bg-[#f59e0b]' : 'bg-red-400';

  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#9ca3af] text-sm">Select a document to track mastery.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-sm">Study Mastery</h2>
          {documentName && (
            <p className="text-[#9ca3af] text-xs mt-0.5 truncate max-w-[180px]">{documentName}</p>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#3ecf8e]/10 border border-[#3ecf8e]/30 text-[#3ecf8e] hover:bg-[#3ecf8e]/20 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}

      {!mastery && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center pb-8">
          <TrendingUp className="w-10 h-10 text-[#9ca3af]" />
          <p className="text-[#9ca3af] text-sm max-w-[220px] leading-relaxed">
            Ask questions in Chat and take a Quiz, then click Refresh to see your mastery score.
          </p>
          <button
            onClick={refresh}
            className="text-sm px-5 py-2.5 rounded-full bg-[#3ecf8e] text-[#0f1117] font-semibold hover:bg-[#34b87a] transition-colors cursor-pointer"
          >
            Analyze Now
          </button>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse space-y-3 w-full max-w-xs">
            {[60, 80, 70, 50, 75].map((w, i) => (
              <div key={i} className="h-3 bg-[#2a2d3e] rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      )}

      {mastery && !loading && (
        <>
          <div className="bg-[#1c1e2e] border border-[#2a2d3e] rounded-xl p-4 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <ProgressRing score={mastery.overallMastery} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{mastery.overallMastery}%</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Overall Mastery</p>
              <p className="text-[#9ca3af] text-xs mt-0.5">
                {mastery.overallMastery >= 70
                  ? 'Excellent progress!'
                  : mastery.overallMastery >= 40
                  ? 'Keep studying!'
                  : 'Just getting started'}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-orange-400 text-sm font-semibold">{mastery.studyStreak}</span>
                <span className="text-[#9ca3af] text-xs">day streak</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wider">Topics</p>
            {mastery.topics.map((topic, i) => (
              <div key={i} className="bg-[#1c1e2e] border border-[#2a2d3e] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white text-sm font-medium truncate">{topic.name}</span>
                  <span className={`text-xs font-semibold shrink-0 ${statusColor(topic.status)}`}>
                    {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                  </span>
                </div>
                <div className="w-full bg-[#0f1117] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 ${barColor(topic.masteryScore)}`}
                    style={{ width: `${topic.masteryScore}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#9ca3af]">
                  <span>{topic.masteryScore}% · {topic.questionsAsked} questions</span>
                  <span className="text-[#3ecf8e]">{topic.quizCorrect}/{topic.quizTotal} quiz</span>
                </div>
                {topic.suggestedQuestion && (
                  <button
                    onClick={() => onSuggestedQuestion(topic.suggestedQuestion)}
                    className="flex items-start gap-1.5 text-[10px] text-[#3ecf8e] hover:text-white transition-colors group cursor-pointer text-left"
                  >
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    <span>{topic.suggestedQuestion}</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {mastery.suggestedNextTopic && (
            <div className="bg-[#3ecf8e]/5 border border-[#3ecf8e]/20 rounded-xl p-3">
              <p className="text-[#9ca3af] text-xs">Suggested next topic:</p>
              <p className="text-[#3ecf8e] text-sm font-semibold mt-0.5">{mastery.suggestedNextTopic}</p>
            </div>
          )}

          {lastUpdated && (
            <p className="text-[#9ca3af] text-[10px] text-center">Last updated {lastUpdated}</p>
          )}
        </>
      )}
    </div>
  );
}
