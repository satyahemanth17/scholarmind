'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { Copy, Check, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Send, FileText, X, Pencil, Plus, Pin, Trash2 } from 'lucide-react';
import { queryDocuments, uploadDocument, UploadResult, Citation } from '@/lib/api';
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

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  drafts?: Draft[];
  activeDraftIndex?: number;
}

interface Props {
  userId: string;
  docs: UploadedDoc[];
  onDeleteDoc: (id: string) => void;
  onUploadSuccess: (result: UploadResult, filename: string) => void;
  username?: string;
  pendingMessage?: string | null;
  onPendingConsumed?: () => void;
  sessionId: string | null;
  sessionTitle?: string;
  onSessionUpdate?: (title: string, preview: string) => void;
  onMessagesChange?: (messages: Message[]) => void;
  onPinSession?: () => void;
  onRenameSession?: (newTitle: string) => void;
  onDeleteSession?: () => void;
}

export default function ChatWindow({
  userId,
  docs,
  onDeleteDoc,
  onUploadSuccess,
  username,
  pendingMessage,
  onPendingConsumed,
  sessionId,
  sessionTitle,
  onSessionUpdate,
  onMessagesChange,
  onPinSession,
  onRenameSession,
  onDeleteSession,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedUserIndex, setCopiedUserIndex] = useState<number | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [renameTitleValue, setRenameTitleValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleMenuRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);

  const initials = username ? username.slice(0, 2).toUpperCase() : 'U';
  const hasDoc = docs.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Load messages when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      messagesRef.current = [];
      setMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`scholarmind-session-msgs-${userId}-${sessionId}`);
      const loaded: Message[] = saved ? JSON.parse(saved) : [];
      messagesRef.current = loaded;
      setMessages(loaded);
    } catch {
      messagesRef.current = [];
      setMessages([]);
    }
    setEditingIndex(null);
    setExpandedCitations(new Set());
  }, [sessionId, userId]);

  // Save messages whenever they change (localStorage + notify parent for Supabase sync)
  useEffect(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem(`scholarmind-session-msgs-${userId}-${sessionId}`, JSON.stringify(messages));
    } catch {}
    onMessagesChange?.(messages);
  // onMessagesChange excluded intentionally — it's a stable callback ref from page.tsx
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, userId, sessionId]);

  useEffect(() => {
    if (!titleMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (titleMenuRef.current && !titleMenuRef.current.contains(e.target as Node)) {
        setTitleMenuOpen(false);
      }
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setTitleMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [titleMenuOpen]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
    }
  }, [input]);

  const sendMessage = useCallback(async (overrideContent?: string) => {
    const query = overrideContent ?? input.trim();
    if (!query || loading || !hasDoc || sendingRef.current) return;
    sendingRef.current = true;
    if (!overrideContent) setInput('');

    let baseMessages = messagesRef.current;
    if (editingIndex !== null) {
      baseMessages = messagesRef.current.slice(0, editingIndex);
      setEditingIndex(null);
    }

    const newMessages = [...baseMessages, { role: 'user' as const, content: query }];
    setMessages(newMessages);
    setLoading(true);

    // On first message, set session title from first 6 words
    if (baseMessages.length === 0 && onSessionUpdate) {
      const title = query.trim().split(/\s+/).slice(0, 6).join(' ');
      onSessionUpdate(title, query.slice(0, 120));
    }

    try {
      const docIds = docs.map((d) => d.documentId);
      const result = await queryDocuments(query, userId, docIds);
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
      sendingRef.current = false;
    }
  }, [input, loading, hasDoc, editingIndex, userId, docs, onSessionUpdate]);

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
      const result = await queryDocuments(userQuery, userId, docs.map((d) => d.documentId));
      const newDraft: Draft = { content: result.answer, citations: result.citations };
      setMessages((prev) =>
        prev.map((msg, i) => {
          if (i !== msgIndex) return msg;
          const existingDrafts = msg.drafts ?? [{ content: msg.content, citations: msg.citations }];
          const drafts = [...existingDrafts, newDraft];
          return { ...msg, drafts, activeDraftIndex: drafts.length - 1, content: newDraft.content, citations: newDraft.citations };
        })
      );
    } catch {}
    finally { setLoading(false); }
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

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape' && editingIndex !== null) cancelEdit();
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

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const result = await uploadDocument(file, userId);
        onUploadSuccess(result, file.name);
      } catch {}
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const truncateName = (name: string) => name.length > 20 ? name.slice(0, 20) + '…' : name;

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden border border-[#2a2a2a]"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center gap-2 shrink-0">
        <div ref={titleMenuRef} className="relative flex items-center gap-1 group">
          {renamingTitle ? (
            <input
              autoFocus
              value={renameTitleValue}
              onChange={(e) => setRenameTitleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (renameTitleValue.trim()) onRenameSession?.(renameTitleValue.trim());
                  setRenamingTitle(false);
                }
                if (e.key === 'Escape') setRenamingTitle(false);
              }}
              onBlur={() => {
                if (renameTitleValue.trim()) onRenameSession?.(renameTitleValue.trim());
                setRenamingTitle(false);
              }}
              className="bg-transparent text-[14px] text-[#8a8a8a] focus:outline-none border-b border-white/30 min-w-[120px]"
            />
          ) : (
            <button
              onClick={() => setTitleMenuOpen((v) => !v)}
              className="flex items-center gap-1 text-[14px] text-[#8a8a8a] hover:text-white transition-colors cursor-pointer"
            >
              <span>{sessionTitle || 'New conversation'}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}

          {titleMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-36 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
              <button
                onClick={() => { onPinSession?.(); setTitleMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#9b9b9b] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Pin className="w-3 h-3" />
                Pin
              </button>
              <button
                onClick={() => {
                  setRenameTitleValue(sessionTitle || '');
                  setRenamingTitle(true);
                  setTitleMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#9b9b9b] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                Rename
              </button>
              <button
                onClick={() => {
                  setTitleMenuOpen(false);
                  if (window.confirm('Delete this chat?')) onDeleteSession?.();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages — centered column */}
      <div className="flex-1 overflow-y-auto py-6">
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

        <div className="max-w-3xl mx-auto px-6 space-y-8">
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
                        <div className="bg-[#1c1c1c] border border-[#2a2a2a] text-white px-4 py-3 rounded-2xl rounded-br-sm text-base leading-relaxed max-w-xl">
                          {msg.content}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mb-0.5">
                          <span className="text-white text-xs font-semibold">{initials}</span>
                        </div>
                      </div>
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
                    <div className="flex flex-col gap-2">
                      <div className="pl-3 border-l-2 border-white/20 text-white text-base leading-relaxed">
                        {draft.content}
                      </div>

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
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Input area — centered */}
      <div className="border-t border-[#2a2a2a] shrink-0 py-3 px-4">
        <div className="max-w-3xl mx-auto space-y-2 px-2">
          {/* PDF pills */}
          {docs.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {docs.map((doc) => (
                <div
                  key={doc.documentId}
                  className="flex items-center gap-1.5 shrink-0 rounded-full border px-2 py-1 text-xs bg-white/10 border-white/30 text-white"
                >
                  <FileText className="w-3 h-3 shrink-0" />
                  <span>{truncateName(doc.filename)}</span>
                  <button
                    onClick={() => onDeleteDoc(doc.documentId)}
                    className="text-[#6b6b6b] hover:text-red-400 transition-colors ml-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
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
            className={`flex items-end gap-3 bg-[#141414] border rounded-3xl px-4 py-4 transition-colors min-h-[56px] ${
              hasDoc ? 'border-[#2a2a2a] focus-within:border-white/30' : 'border-[#2a2a2a] opacity-60'
            } ${editingIndex !== null ? 'border-white/25' : ''}`}
          >
            {/* + Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload PDF"
              className="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#6b6b6b] hover:text-white transition-colors cursor-pointer disabled:opacity-40 mb-0.5"
            >
              {uploading
                ? <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : <Plus className="w-3.5 h-3.5 text-white" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={hasDoc ? 'Ask anything about your document...' : 'Upload or select a document first...'}
              rows={1}
              disabled={loading || !hasDoc}
              className="flex-1 bg-transparent text-base text-white placeholder-[#6b6b6b] resize-none focus:outline-none min-h-[28px] py-0 disabled:opacity-50"
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
            Enter to send · Shift+Enter for new line{editingIndex !== null ? ' · Esc to cancel' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
