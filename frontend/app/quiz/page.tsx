'use client';

import { useState, useEffect } from 'react';
import { generateQuiz, QuizQuestion } from '@/lib/api';
import QuizCard from '@/components/QuizCard';

const USER_ID = 'demo-user';
const STORAGE_KEY = 'scholarmind_docs';

interface SavedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
}

export default function QuizPage() {
  const [savedDocs, setSavedDocs] = useState<SavedDoc[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [quizKey, setQuizKey] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedDoc[];
        setSavedDocs(parsed);
        if (parsed.length > 0 && !documentId) setDocumentId(parsed[0].documentId);
      }
    } catch {}
  }, []);

  async function handleGenerate() {
    if (!documentId.trim()) return;
    setLoading(true);
    setError(null);
    setQuestions([]);
    setScore({ correct: 0, total: 0 });
    setQuizKey((k) => k + 1);
    try {
      const result = await generateQuiz(documentId.trim(), USER_ID, 5);
      setQuestions(result.questions);
    } catch {
      setError('Failed to generate quiz. Check the document ID and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMoreQuestions() {
    if (!documentId.trim()) return;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await generateQuiz(documentId.trim(), USER_ID, 5);
      setQuestions((prev) => [...prev, ...result.questions]);
    } catch {
      setError('Failed to generate more questions.');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRetake() {
    setScore({ correct: 0, total: 0 });
    setQuizKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleAnswer(correct: boolean) {
    setScore((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <header className="border-b border-[#2a2d3e] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3ecf8e]/20 flex items-center justify-center">
            <span className="text-[#3ecf8e] text-sm font-bold">S</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-none">Quiz Mode</h1>
            <p className="text-[#9ca3af] text-xs mt-0.5">Test your knowledge</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {questions.length > 0 && (
            <button
              onClick={handleRetake}
              className="text-sm text-[#9ca3af] hover:text-white border border-[#2a2d3e] hover:border-[#3ecf8e]/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Retake
            </button>
          )}
          <a href="/" className="text-sm text-[#9ca3af] hover:text-[#3ecf8e] transition-colors">
            ← Chat
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[#1c1e2e] border border-[#2a2d3e] rounded-xl p-5 space-y-4">
          {savedDocs.length > 0 && (
            <div>
              <p className="text-xs text-[#9ca3af] font-medium uppercase tracking-wider mb-2">
                Your Documents
              </p>
              <div className="flex flex-wrap gap-2">
                {savedDocs.map((doc) => (
                  <button
                    key={doc.documentId}
                    onClick={() => setDocumentId(doc.documentId)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                      documentId === doc.documentId
                        ? 'bg-[#3ecf8e]/10 border-[#3ecf8e]/40 text-[#3ecf8e]'
                        : 'border-[#2a2d3e] text-[#9ca3af] hover:border-[#3ecf8e]/30 hover:text-white'
                    }`}
                  >
                    {doc.filename}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white mb-2">Document ID</label>
            <div className="flex gap-3">
              <input
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder="Paste document UUID..."
                className="flex-1 bg-[#0f1117] border border-[#2a2d3e] rounded-lg px-3 py-2 text-sm text-white placeholder-[#9ca3af] focus:outline-none focus:border-[#3ecf8e] transition-colors font-mono"
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !documentId.trim()}
                className="bg-[#3ecf8e] text-[#0f1117] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#34b87a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                {loading ? 'Generating...' : 'Generate Quiz'}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        </div>

        {questions.length > 0 && (
          <div className="bg-[#1c1e2e] border border-[#2a2d3e] rounded-xl px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-[#9ca3af]">Score</span>
            <span className="text-[#3ecf8e] font-semibold font-mono">
              {score.correct} / {score.total}
              <span className="text-[#9ca3af] font-normal text-xs ml-1">answered</span>
            </span>
          </div>
        )}

        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuizCard key={`${quizKey}-${i}`} question={q} index={i} onAnswer={handleAnswer} />
          ))}
        </div>

        {score.total === questions.length && questions.length > 0 && (
          <div className="bg-[#1c1e2e] border border-[#3ecf8e]/30 rounded-xl p-5 text-center space-y-3">
            <p className="text-[#3ecf8e] font-semibold text-lg">
              {score.correct}/{questions.length} correct
            </p>
            <p className="text-[#9ca3af] text-sm">
              {score.correct === questions.length
                ? 'Perfect score!'
                : score.correct >= questions.length * 0.7
                ? 'Great job!'
                : 'Keep studying!'}
            </p>
            <button
              onClick={handleMoreQuestions}
              disabled={loadingMore}
              className="mt-1 bg-[#1c1e2e] border border-[#3ecf8e]/40 text-[#3ecf8e] text-sm font-medium px-5 py-2 rounded-lg hover:bg-[#3ecf8e]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loadingMore ? 'Generating...' : '+ More Questions'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
