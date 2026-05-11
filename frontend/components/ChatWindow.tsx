'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Copy, Check, RefreshCw, ChevronLeft, ChevronRight, SquarePen, Send, FileText } from 'lucide-react';
import { queryDocuments, Citation } from '@/lib/api';
import CitationCard from './CitationCard';
import ScholarMindLogo from './ScholarMindLogo';

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
  username?: string;
  documentName?: string;
}

export default function ChatWindow({ userId, documentId, username, documentName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedForRef = useRef<string | null>(null);

  const initials = username ? username.slice(0, 2).toUpperCase() : 'G';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    loadedForRef.current = null;
    if (!documentId) {
      setMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`scholarmind-chat-${userId}-${documentId}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
    loadedForRef.current = documentId;
  }, [documentId, userId]);

  useEffect(() => {
    const docId = loadedForRef.current;
    if (!docId || messages.length === 0) return;
    try {
      localStorage.setItem(`scholarmind-chat-${userId}-${docId}`, JSON.stringify(messages));
    } catch {}
  }, [messages, userId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const query = input;
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
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
      // silent
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

  function handleNewChat() {
    if (messages.length > 0 && !window.confirm('Clear chat history for this document?')) return;
    if (documentId) localStorage.removeItem(`scholarmind-chat-${userId}-${documentId}`);
    setMessages([]);
    setExpandedCitations(new Set());
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function toggleCitations(index: number) {
    setExpandedCitations((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function getActiveDraft(msg: Message): Draft {
    if (msg.drafts && msg.activeDraftIndex !== undefined) {
      return msg.drafts[msg.activeDraftIndex];
    }
    return { content: msg.content, citations: msg.citations };
  }

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border border-[#2a2d3e]"
      style={{ background: 'linear-gradient(180deg, #0f1117 0%, #13151f 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#2a2d3e] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${documentId ? 'bg-[#3ecf8e]' : 'bg-[#9ca3af]'}`} />
          <span className="text-sm font-medium text-white">
            {documentId ? (documentName || 'Document loaded') : 'Upload a document to start'}
          </span>
        </div>
        {documentId && (
          <button
            onClick={handleNewChat}
            title="New chat"
            className="p-1.5 rounded-lg text-[#9ca3af] hover:text-white hover:bg-[#2a2d3e] transition-colors cursor-pointer"
          >
            <SquarePen className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 pb-16">
            <ScholarMindLogo size={48} />
            <p className="text-[#9ca3af] text-sm text-center max-w-xs leading-relaxed">
              {documentId
                ? "Ask anything about your document — I'll find the answer and cite my sources."
                : 'Upload a PDF to start asking questions.'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const draft = getActiveDraft(msg);
          const draftCount = msg.drafts?.length ?? 0;
          const activeDraft = msg.activeDraftIndex ?? 0;
          const hasCitations = (draft.citations?.length ?? 0) > 0;
          const isExpanded = expandedCitations.has(i);

          return (
            <div key={i} className="flex gap-3 items-start animate-fadeIn">
              {msg.role === 'assistant' && (
                <div className="shrink-0 mt-0.5">
                  <ScholarMindLogo size={24} />
                </div>
              )}

              <div className={`flex-1 flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'user' ? (
                  <div className="flex items-end gap-2.5">
                    <div className="bg-[#3ecf8e] text-[#0f1117] font-medium px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed max-w-[70%]">
                      {msg.content}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#3ecf8e]/20 flex items-center justify-center shrink-0 mb-0.5">
                      <span className="text-[#3ecf8e] text-xs font-semibold">{initials}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-w-[85%]">
                    <div className="pl-3 border-l-2 border-[#3ecf8e]/50 text-white text-sm leading-relaxed">
                      {draft.content}
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center gap-0.5 pl-3 flex-wrap">
                      <button
                        onClick={() => copyMessage(draft.content, i)}
                        title="Copy"
                        className="p-1 rounded text-[#9ca3af] hover:text-[#3ecf8e] hover:bg-[#3ecf8e]/10 transition-colors cursor-pointer"
                      >
                        {copiedIndex === i
                          ? <Check className="w-3.5 h-3.5 text-[#3ecf8e]" />
                          : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {draftCount > 1 && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => changeDraft(i, -1)}
                            disabled={activeDraft === 0}
                            title="Previous"
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
                            title="Next"
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

                      {hasCitations && (
                        <button
                          onClick={() => toggleCitations(i)}
                          className="ml-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-[#3ecf8e]/30 text-[#3ecf8e] hover:bg-[#3ecf8e]/10 transition-colors cursor-pointer"
                        >
                          {draft.citations!.length} source{draft.citations!.length !== 1 ? 's' : ''}{' '}
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                    </div>

                    {hasCitations && isExpanded && (
                      <div className="pl-3 space-y-2 mt-1">
                        {draft.citations!.map((c, j) => (
                          <CitationCard key={j} citation={c} index={j} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 items-start animate-fadeIn">
            <div className="shrink-0 mt-0.5">
              <ScholarMindLogo size={24} />
            </div>
            <div className="pl-3 border-l-2 border-[#3ecf8e]/50 py-2 flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e] animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#2a2d3e] shrink-0">
        <div
          className={`flex items-end gap-2 bg-[#1c1e2e] border rounded-2xl px-3 py-2.5 transition-colors ${
            documentId
              ? 'border-[#2a2d3e] focus-within:border-[#3ecf8e]/50'
              : 'border-[#2a2d3e] opacity-60'
          }`}
        >
          {documentId && documentName && (
            <div className="shrink-0 flex items-center gap-1.5 bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 rounded-lg px-2 py-1 mb-0.5">
              <FileText className="w-3 h-3 text-[#3ecf8e]" />
              <span className="text-[#3ecf8e] text-[10px] font-medium max-w-[96px] truncate">
                {documentName}
              </span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={documentId ? 'Ask anything about your document...' : 'Upload a document first...'}
            rows={1}
            disabled={loading || !documentId}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#9ca3af] resize-none focus:outline-none min-h-[36px] py-1 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !documentId}
            className="shrink-0 w-8 h-8 rounded-xl bg-[#3ecf8e] flex items-center justify-center text-[#0f1117] hover:bg-[#34b87a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mb-0.5"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-center text-[#9ca3af] text-[10px] mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
