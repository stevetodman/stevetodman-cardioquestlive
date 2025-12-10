import React, { useState, useRef, useEffect, useMemo } from "react";
import { TeamMessage } from "../hooks/useTeamChat";

interface TeamChatProps {
  teamName: string;
  messages: TeamMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => Promise<{ success: boolean; error?: string }>;
  loading?: boolean;
  error?: string | null;
  unreadCount?: number;
  onMarkAsRead?: () => void;
  compact?: boolean;
}

// Format time for display (e.g., "2:34 PM" or "Just now")
function formatMessageTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;

  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Get initials from name
function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Generate consistent color based on user ID
function getUserColor(userId: string): string {
  const colors = [
    "bg-sky-600",
    "bg-emerald-600",
    "bg-violet-600",
    "bg-amber-600",
    "bg-rose-600",
    "bg-cyan-600",
    "bg-indigo-600",
    "bg-pink-600",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function TeamChat({
  teamName,
  messages,
  currentUserId,
  onSendMessage,
  loading = false,
  error,
  unreadCount = 0,
  onMarkAsRead,
  compact = false,
}: TeamChatProps) {
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isCollapsed && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isCollapsed]);

  // Mark as read when expanded
  useEffect(() => {
    if (!isCollapsed && unreadCount > 0 && onMarkAsRead) {
      onMarkAsRead();
    }
  }, [isCollapsed, unreadCount, onMarkAsRead]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError(null);

    const result = await onSendMessage(text);
    if (result.success) {
      setInputText("");
    } else {
      setSendError(result.error || "Failed to send");
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group consecutive messages from same user
  const groupedMessages = useMemo(() => {
    const groups: { userId: string; senderName?: string; messages: TeamMessage[] }[] = [];

    messages.forEach((msg) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.userId === msg.userId) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({
          userId: msg.userId,
          senderName: msg.senderName,
          messages: [msg],
        });
      }
    });

    return groups;
  }, [messages]);

  return (
    <div className={`bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden ${compact ? "text-xs" : ""}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700 hover:bg-slate-800/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
          <span className="text-[11px] font-semibold text-slate-200">
            Team Chat
          </span>
          <span className="text-[10px] text-slate-400">
            {teamName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && isCollapsed && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-sky-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
          <span className="text-slate-500 text-sm">{isCollapsed ? "+" : "−"}</span>
        </div>
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <>
          {/* Messages area */}
          <div className={`overflow-y-auto ${compact ? "max-h-32" : "max-h-48"} p-2 space-y-2`}>
            {loading ? (
              <div className="text-center text-slate-500 text-[11px] py-4">
                Loading messages...
              </div>
            ) : error ? (
              <div className="text-center text-rose-400 text-[11px] py-4">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-slate-500 text-[11px] py-4">
                No messages yet. Start the conversation!
              </div>
            ) : (
              groupedMessages.map((group, groupIndex) => {
                const isOwnMessage = group.userId === currentUserId;
                return (
                  <div
                    key={`${group.userId}-${groupIndex}`}
                    className={`flex gap-2 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    {!isOwnMessage && (
                      <div
                        className={`w-6 h-6 rounded-full ${getUserColor(group.userId)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}
                      >
                        {getInitials(group.senderName)}
                      </div>
                    )}

                    {/* Message bubbles */}
                    <div className={`flex flex-col gap-0.5 ${isOwnMessage ? "items-end" : "items-start"} max-w-[80%]`}>
                      {!isOwnMessage && (
                        <span className="text-[9px] text-slate-400 px-1">
                          {group.senderName || "Anonymous"}
                        </span>
                      )}
                      {group.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] ${
                            isOwnMessage
                              ? "bg-sky-600 text-white rounded-br-sm"
                              : "bg-slate-700 text-slate-100 rounded-bl-sm"
                          }`}
                        >
                          <div>{msg.text}</div>
                          <div className={`text-[8px] mt-0.5 ${isOwnMessage ? "text-sky-200" : "text-slate-400"}`}>
                            {formatMessageTime(msg.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-2 border-t border-slate-700">
            {sendError && (
              <div className="text-[10px] text-rose-400 mb-1 px-1">
                {sendError}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message your team..."
                maxLength={500}
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-[11px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                disabled={sending}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-medium rounded-lg transition-colors"
              >
                {sending ? "..." : "Send"}
              </button>
            </div>
            <div className="text-[9px] text-slate-500 mt-1 px-1">
              {inputText.length}/500 characters
            </div>
          </div>
        </>
      )}
    </div>
  );
}
