'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { queryDocuments, Citation } from '@/lib/api';
import CitationCard from './CitationCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface Props {
  userId: string;
  documentId: string | null;
}

export default function ChatWindow({ userId, documentId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const result = await queryDocuments(input, userId);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.answer, citations: result.citations },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error generating answer. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#3ecf8e] text-[#0f1117] font-medium'
                    : 'bg-[#0f1117] text-white border border-[#2a2d3e]'
                }`}
              >
                {msg.content}
              </div>
              {msg.citations && msg.citations.length > 0 && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-[#9ca3af] px-1">Sources</p>
                  {msg.citations.map((c, j) => (
                    <CitationCard key={j} citation={c} index={j} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
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
          className="bg-[#3ecf8e] text-[#0f1117] font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-[#34b87a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
