'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Copy, Check, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { queryDocuments, Citation } from '@/lib/api';
import CitationCard from './CitationCard';

interface Draft {
  content: string;
  citations?: Citation[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  drafts?: Draft[];
  activeDraftIndex?: number;
}

interface Props {
  userId: string;
  documentId: string | null;
}

export default function ChatWindow({ userId, documentId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const query = input;
    const userMsg: Message = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const result = await queryDocuments(query, userId, documentId ?? undefined);
      const draft: Draft = { content: result.answer, citations: result.citations };
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer,
          citations: result.citations,
          drafts: [draft],
          activeDraftIndex: 0,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error generating answer. Please try again.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg, drafts: [{ content: msg }], activeDraftIndex: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function retryMessage(msgIndex: number) {
    if (loading) return;
    let userQuery = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuery = messages[i].content;
        break;
      }
    }
    if (!userQuery) return;
    setLoading(true);
    try {
      const result = await queryDocuments(userQuery, userId, documentId ?? undefined);
      const newDraft: Draft = { content: result.answer, citations: result.citations };
      setMessages((prev) =>
        prev.map((msg, i) => {
          if (i !== msgIndex) return msg;
          const existingDrafts = msg.drafts ?? [{ content: msg.content, citations: msg.citations }];
          const drafts = [...existingDrafts, newDraft];
          const activeDraftIndex = drafts.length - 1;
          return { ...msg, drafts, activeDraftIndex, content: newDraft.content, citations: newDraft.citations };
        })
      );
    } catch {
      // silent fail for retry
    } finally {
      setLoading(false);
    }
  }

  function changeDraft(msgIndex: number, delta: number) {
    setMessages((prev) =>
      prev.map((msg, i) => {
        if (i !== msgIndex || !msg.drafts) return msg;
        const newIndex = Math.max(0, Math.min(msg.drafts.length - 1, (msg.activeDraftIndex ?? 0) + delta));
        const draft = msg.drafts[newIndex];
        return { ...msg, activeDraftIndex: newIndex, content: draft.content, citations: draft.citations };
      })
    );
  }

  async function copyMessage(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function getActiveDraft(msg: Message): Draft {
    if (msg.drafts && msg.activeDraftIndex !== undefined) {
      return msg.drafts[msg.activeDraftIndex];
    }
    return { content: msg.content, citations: msg.citations };
  }

  return (
    <div className="flex flex-col h-full bg-[#1c1e2e] rounded-xl border border-[#2a2d3e] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2d3e] flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#3ecf8e]" />
        <span className="text-sm font-medium text-white">
          {documentId ? 'Document loaded' : 'Upload a document to start'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-[#9ca3af] text-sm mt-8">
            Ask a question about your uploaded document
          </p>
        )}
        {messages.map((msg, i) => {
          const draft = getActiveDraft(msg);
          const draftCount = msg.drafts?.length ?? 0;
          const activeDraft = msg.activeDraftIndex ?? 0;

          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#3ecf8e] text-[#0f1117] font-medium'
                      : 'bg-[#0f1117] text-white border border-[#2a2d3e]'
                  }`}
                >
                  {draft.content}
                </div>

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 px-1">
                    <button
                      onClick={() => copyMessage(draft.content, i)}
                      title="Copy answer"
                      className="p-1 rounded text-[#9ca3af] hover:text-[#3ecf8e] hover:bg-[#3ecf8e]/10 transition-colors cursor-pointer"
                    >
                      {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-[#3ecf8e]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    {draftCount > 1 && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => changeDraft(i, -1)}
                          disabled={activeDraft === 0}
                          title="Previous draft"
                          className="p-1 rounded text-[#9ca3af] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-[#9ca3af] font-mono px-0.5">
                          {activeDraft + 1}/{draftCount}
                        </span>
                        <button
                          onClick={() => changeDraft(i, 1)}
                          disabled={activeDraft === draftCount - 1}
                          title="Next draft"
                          className="p-1 rounded text-[#9ca3af] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => retryMessage(i)}
                      disabled={loading}
                      title="Retry"
                      className="p-1 rounded text-[#9ca3af] hover:text-[#3ecf8e] hover:bg-[#3ecf8e]/10 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {draft.citations && draft.citations.length > 0 && (
                  <div className="w-full space-y-2">
                    <p className="text-xs text-[#9ca3af] px-1">Sources</p>
                    {draft.citations.map((c, j) => (
                      <CitationCard key={j} citation={c} index={j} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0f1117] border border-[#2a2d3e] px-4 py-3 rounded-2xl flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-[#2a2d3e] flex gap-3 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question... (Enter to send)"
          rows={1}
          disabled={loading}
          className="flex-1 bg-[#0f1117] border border-[#2a2d3e] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#9ca3af] resize-none focus:outline-none focus:border-[#3ecf8e] transition-colors disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-[#3ecf8e] text-[#0f1117] font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-[#34b87a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
