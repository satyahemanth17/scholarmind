'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Copy, Check, RefreshCw, ChevronLeft, ChevronRight, SquarePen, Send, FileText, X, Pencil } from 'lucide-react';
import { queryDocuments, Citation } from '@/lib/api';
import CitationCard from './CitationCard';
import ScholarMindLogo from './ScholarMindLogo';

interface UploadedDoc {
  documentId: string;
  filename: string;
  chunkCount: number;
}

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
  docs: UploadedDoc[];
  selectedDocIds: string[];
  onToggleDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  username?: string;
  pendingMessage?: string | null;
  onPendingConsumed?: () => void;
}

export default function ChatWindow({
  userId,
  docs,
  selectedDocIds,
  onToggleDoc,
  onDeleteDoc,
  username,
  pendingMessage,
  onPendingConsumed,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedUserIndex, setCopiedUserIndex] = useState<number | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const primaryKeyRef = useRef<string | null>(null);

  const initials = username ? username.slice(0, 2).toUpperCase() : 'G';
  const hasDoc = selectedDocIds.length > 0;
  const primaryDocId = selectedDocIds[0] ?? null;
  const primaryDocName = docs.find((d) => d.documentId === primaryDocId)?.filename;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    primaryKeyRef.current = null;
    if (!primaryDocId) {
      setMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`scholarmind-chat-${userId}-${primaryDocId}`);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
    primaryKeyRef.current = primaryDocId;
  }, [primaryDocId, userId]);

  useEffect(() => {
    const key = primaryKeyRef.current;
    if (!key || messages.length === 0) return;
    try {
      localStorage.setItem(`scholarmind-chat-${userId}-${key}`, JSON.stringify(messages));
    } catch {}
  }, [messages, userId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  async function sendMessage(overrideContent?: string) {
    const query = overrideContent ?? input.trim();
    if (!query || loading || !hasDoc) return;
    if (!overrideContent) setInput('');

    let baseMessages = messages;
    if (editingIndex !== null) {
      baseMessages = messages.slice(0, editingIndex);
      setEditingIndex(null);
    }

    setMessages([...baseMessages, { role: 'user', content: query }]);
    setLoading(true);
    try {
      const result = await queryDocuments(query, userId, selectedDocIds);
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

  useEffect(() => {
    if (!pendingMessage || loading || !hasDoc) return;
    onPendingConsumed?.();
    sendMessage(pendingMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage]);

  async function retryMessage(msgIndex: number) {
    if (loading) return;
    let userQuery = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { userQuery = messages[i].content; break; }
    }
    if (!userQuery) return;
    setLoading(true);
    try {
      const result = await queryDocuments(userQuery, userId, selectedDocIds);
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

  async function copyMessage(content: string, index: number, isUser = false) {
    try {
      await navigator.clipboard.writeText(content);
      if (isUser) {
        setCopiedUserIndex(index);
        setTimeout(() => setCopiedUserIndex(null), 2000);
      } else {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
    } catch {}
  }

  function startEdit(index: number) {
    setInput(messages[index].content);
    setEditingIndex(index);
    textareaRef.current?.focus();
  }

  function cancelEdit() {
    setEditingIndex(null);
    setInput('');
  }

  function handleNewChat() {
    if (messages.length > 0 && !window.confirm('Clear chat history?')) return;
    if (primaryDocId) localStorage.removeItem(`scholarmind-chat-${userId}-${primaryDocId}`);
    setMessages([]);
    setExpandedCitations(new Set());
    setEditingIndex(null);
    setInput('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape' && editingIndex !== null) {
      cancelEdit();
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

  const truncateName = (name: string) =>
    name.length > 20 ? name.slice(0, 20) + '…' : name;

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border border-[#2a2a2a]"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${hasDoc ? 'bg-white' : 'bg-[#2a2a2a]'}`} />
          <span className="text-sm font-medium text-white">
            {hasDoc
              ? selectedDocIds.length === 1
                ? (primaryDocName || 'Document loaded')
                : `${selectedDocIds.length} documents selected`
              : 'Upload or select a document'}
          </span>
        </div>
        {hasDoc && (
          <button
            onClick={handleNewChat}
            title="New chat"
            className="p-1.5 rounded-lg text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
            <p className="text-[#6b6b6b] text-sm text-center max-w-xs leading-relaxed">
              {hasDoc
                ? "Ask anything about your document — I'll find the answer and cite my sources."
                : 'Select or upload a PDF to start asking questions.'}
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
            <div key={i} className="flex gap-3 items-start animate-fadeIn group">
              {msg.role === 'assistant' && (
                <div className="shrink-0 mt-0.5">
                  <ScholarMindLogo size={24} />
                </div>
              )}

              <div className={`flex-1 flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'user' ? (
                  <>
                    <div className="flex items-end gap-2.5">
                      <div className="bg-[#1c1c1c] border border-[#2a2a2a] text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed max-w-[70%]">
                        {msg.content}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mb-0.5">
                        <span className="text-white text-xs font-semibold">{initials}</span>
                      </div>
                    </div>
                    {/* User message actions — appear on hover */}
                    <div className="flex items-center gap-0.5 pr-9 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyMessage(msg.content, i, true)}
                        title="Copy"
                        className="p-1 rounded text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        {copiedUserIndex === i
                          ? <Check className="w-3.5 h-3.5 text-white" />
                          : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => startEdit(i)}
                        title="Edit"
                        className="p-1 rounded text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 max-w-[85%]">
                    <div className="pl-3 border-l-2 border-white/20 text-white text-sm leading-relaxed">
                      {draft.content}
                    </div>

                    {/* AI action bar */}
                    <div className="flex items-center gap-0.5 pl-3 flex-wrap">
                      <button
                        onClick={() => copyMessage(draft.content, i)}
                        title="Copy"
                        className="p-1 rounded text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        {copiedIndex === i
                          ? <Check className="w-3.5 h-3.5 text-white" />
                          : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {draftCount > 1 && (
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => changeDraft(i, -1)}
                            disabled={activeDraft === 0}
                            title="Previous"
                            className="p-1 rounded text-[#6b6b6b] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] text-[#6b6b6b] font-mono px-0.5">
                            {activeDraft + 1}/{draftCount}
                          </span>
                          <button
                            onClick={() => changeDraft(i, 1)}
                            disabled={activeDraft === draftCount - 1}
                            title="Next"
                            className="p-1 rounded text-[#6b6b6b] hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => retryMessage(i)}
                        disabled={loading}
                        title="Retry"
                        className="p-1 rounded text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      {hasCitations && (
                        <button
                          onClick={() => toggleCitations(i)}
                          className="ml-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/20 text-white hover:bg-white/10 transition-colors cursor-pointer"
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
            <div className="pl-3 border-l-2 border-white/20 py-2 flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-[#2a2a2a] shrink-0 space-y-2">
        {/* PDF pills */}
        {docs.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {docs.map((doc) => {
              const isSelected = selectedDocIds.includes(doc.documentId);
              return (
                <div
                  key={doc.documentId}
                  className={`flex items-center gap-1.5 shrink-0 rounded-full border px-2 py-1 text-xs transition-colors ${
                    isSelected
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-[#141414] border-[#2a2a2a] text-[#6b6b6b]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleDoc(doc.documentId)}
                    className="w-3 h-3 cursor-pointer accent-white"
                    title={isSelected ? 'Deselect' : 'Select for chat'}
                  />
                  <FileText className="w-3 h-3 shrink-0" />
                  <span
                    className="cursor-pointer"
                    onClick={() => onToggleDoc(doc.documentId)}
                  >
                    {truncateName(doc.filename)}
                  </span>
                  <button
                    onClick={() => onDeleteDoc(doc.documentId)}
                    className="text-[#6b6b6b] hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                    title="Remove document"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {selectedDocIds.length > 1 && (
              <span className="shrink-0 self-center text-[10px] text-[#6b6b6b] whitespace-nowrap">
                {selectedDocIds.length} docs selected
              </span>
            )}
          </div>
        )}

        {/* Edit mode label */}
        {editingIndex !== null && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-[#6b6b6b]">Editing message</span>
            <button onClick={cancelEdit} className="text-[10px] text-[#6b6b6b] hover:text-white transition-colors cursor-pointer">
              Cancel (Esc)
            </button>
          </div>
        )}

        {/* Input bar */}
        <div
          className={`flex items-end gap-2 bg-[#141414] border rounded-2xl px-4 py-2.5 transition-colors ${
            hasDoc
              ? 'border-[#2a2a2a] focus-within:border-white/30'
              : 'border-[#2a2a2a] opacity-60'
          } ${editingIndex !== null ? 'border-white/25' : ''}`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={hasDoc ? 'Ask anything about your document...' : 'Select a document first...'}
            rows={1}
            disabled={loading || !hasDoc}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#6b6b6b] resize-none focus:outline-none min-h-[36px] py-1 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim() || !hasDoc}
            className="shrink-0 w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#0a0a0a] hover:bg-[#e5e5e5] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mb-0.5"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-center text-[#6b6b6b] text-[10px]">
          Enter to send · Shift+Enter for new line{editingIndex !== null ? ' · Esc to cancel edit' : ''}
        </p>
      </div>
    </div>
  );
}
