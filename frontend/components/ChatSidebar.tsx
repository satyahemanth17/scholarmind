'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { PanelLeftClose, PanelLeft, Plus, Search, MessageSquare, MoreHorizontal, Pin, PinOff, Pencil, Trash2 } from 'lucide-react';

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

interface Props {
  sessions: ChatSession[];
  currentSessionId: string | null;
  username: string;
  avatarUrl?: string;
  initials: string;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onPinSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onLogout: () => void;
}

function groupSessions(sessions: ChatSession[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const pinned = sessions.filter((s) => s.pinned);
  const unpinned = sessions.filter((s) => !s.pinned);

  const groups: { label: string; items: ChatSession[]; isPinned?: boolean }[] = [
    { label: 'Pinned', items: pinned, isPinned: true },
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const s of unpinned) {
    const d = new Date(s.updatedAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today) groups[1].items.push(s);
    else if (day >= yesterday) groups[2].items.push(s);
    else if (day >= weekAgo) groups[3].items.push(s);
    else groups[4].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatSidebar({
  sessions,
  currentSessionId,
  username,
  avatarUrl,
  initials,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onPinSession,
  onRenameSession,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpenId(null);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) => s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const groups = useMemo(() => groupSessions(filtered), [filtered]);

  function commitRename(id: string) {
    const name = renameValue.trim();
    if (name) onRenameSession(id, name);
    setRenamingId(null);
  }

  if (!open) {
    return (
      <div className="w-12 flex flex-col items-center py-3 gap-3 border-r border-[#2a2a2a] shrink-0">
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Open sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNewChat}
          className="p-2 rounded-lg text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="New chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[260px] flex flex-col border-r border-[#2a2a2a] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={onNewChat}
          className="flex-1 flex items-center gap-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-[#2a2a2a] rounded-lg px-3 py-2 transition-colors cursor-pointer mr-2"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
        <button
          onClick={() => setOpen(false)}
          className="p-2 rounded-lg text-[#6b6b6b] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title="Close sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-[#6b6b6b] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="flex-1 bg-transparent text-xs text-white placeholder-[#6b6b6b] focus:outline-none"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 py-1">
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8">
            <MessageSquare className="w-8 h-8 text-[#2a2a2a]" />
            <p className="text-[#6b6b6b] text-xs text-center">
              {search ? 'No chats match your search' : 'No chat history yet'}
            </p>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((session) => (
                <div
                  key={session.id}
                  onClick={() => { if (renamingId !== session.id) onSelectSession(session.id); }}
                  className={`relative group flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-white/10 text-white'
                      : 'text-[#9b9b9b] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {renamingId === session.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') commitRename(session.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={() => commitRename(session.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-transparent text-xs text-white focus:outline-none border-b border-white/30 leading-tight pb-0.5"
                      />
                    ) : (
                      <p className="text-xs font-medium truncate leading-tight flex items-center gap-1">
                        {session.pinned && <Pin className="w-2.5 h-2.5 shrink-0 text-[#6b6b6b]" />}
                        {session.title || 'New conversation'}
                      </p>
                    )}
                    <p className="text-[10px] text-[#6b6b6b] mt-0.5 truncate">
                      {relativeTime(session.updatedAt)}
                    </p>
                  </div>

                  {/* Three dots menu */}
                  <div
                    ref={menuOpenId === session.id ? menuRef : undefined}
                    className="relative shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === session.id ? null : session.id)}
                      className="p-1 rounded text-[#6b6b6b] hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="More options"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {menuOpenId === session.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                        <button
                          onClick={() => { onPinSession(session.id); setMenuOpenId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#9b9b9b] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          {session.pinned
                            ? <PinOff className="w-3 h-3" />
                            : <Pin className="w-3 h-3" />}
                          {session.pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          onClick={() => {
                            setRenameValue(session.title || '');
                            setRenamingId(session.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#9b9b9b] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            if (window.confirm('Delete this chat?')) onDeleteSession(session.id);
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
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* User info */}
      <div className="px-3 py-3 border-t border-[#2a2a2a] shrink-0 flex items-center gap-2">
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} className="w-7 h-7 rounded-full shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
        )}
        <span className="text-sm text-white flex-1 truncate">{username}</span>
        <button
          onClick={onLogout}
          className="text-xs text-[#6b6b6b] hover:text-red-400 transition-colors cursor-pointer shrink-0"
          title="Log out"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
