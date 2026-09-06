"use client";

import { useRef, useState } from "react";
import type { Conversation } from "@/lib/chat-types";

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onNewConversation: () => void;
  onSelectConversation: (conversation: Conversation) => void;
  onRenameConversation: (conversation: Conversation, title: string) => void;
  onDeleteConversation: (conversation: Conversation) => void;
}

export default function ChatSidebar({
  conversations,
  currentConversationId,
  isLoading,
  isOpen,
  onClose,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}: ChatSidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [openMenuConversationId, setOpenMenuConversationId] = useState<string | null>(null);
  const isResizing = useRef(false);

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    isResizing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizing.current) return;

    const minWidth = 160;
    const maxWidth = Math.floor(window.innerWidth * 0.3);
    setSidebarWidth(Math.min(Math.max(event.clientX, minWidth), maxWidth));
  };

  const handleResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    isResizing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close conversation sidebar"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity duration-1000 ease-in-out md:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {isOpen && (
        <div
          role="separator"
          aria-label="Resize conversation sidebar"
          aria-orientation="vertical"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResize}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          style={{ left: sidebarWidth === null ? "calc(20vw - 6px)" : `${sidebarWidth - 6}px` }}
          className="fixed inset-y-0 z-50 hidden w-3 cursor-col-resize touch-none select-none bg-transparent transition-colors hover:bg-zinc-600/70 md:block"
        />
      )}
      <aside
        style={{ width: isOpen ? (sidebarWidth === null ? "20vw" : `${sidebarWidth}px`) : undefined }}
        className={
          isOpen
            ? "relative fixed inset-y-0 left-0 z-40 flex h-full shrink-0 flex-col overflow-hidden overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4 opacity-100 transition-[transform,opacity,padding] duration-300 ease-in-out md:static md:z-auto md:bg-zinc-950/50"
            : "relative fixed inset-y-0 left-0 z-40 flex h-full w-64 -translate-x-full shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950 p-4 opacity-0 transition-[transform,opacity,padding] duration-300 ease-in-out md:static md:w-0 md:translate-x-0 md:border-0 md:p-0 md:bg-zinc-950/50"
        }
      >
      <div className="mb-4">
        <button
          onClick={onNewConversation}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
        >
          + New Chat
        </button>
      </div>

      <div className="space-y-2">
        <p className="px-2 text-xs font-medium text-zinc-500">History</p>
        {isLoading ? (
          <p className="px-2 text-xs text-zinc-400">Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="px-2 text-xs text-zinc-400">No conversations yet</p>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group relative flex w-full items-center gap-1 rounded-lg px-2 py-2 text-sm transition ${
                currentConversationId === conversation.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {editingConversationId === conversation.id ? (
                <form
                  className="min-w-0 flex-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const title = editingTitle.trim();
                    if (!title) return;
                    onRenameConversation(conversation, title);
                    setEditingConversationId(null);
                  }}
                >
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    className="w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm text-white outline-none focus:border-zinc-400"
                    aria-label="Conversation name"
                  />
                  <div className="mt-1 flex gap-2">
                    <button type="submit" className="text-xs text-white hover:text-zinc-300">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingConversationId(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSelectConversation(conversation);
                    onClose();
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate font-medium">{conversation.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">{conversation.provider}</div>
                </button>
              )}
              {editingConversationId !== conversation.id && (
                <button
                  type="button"
                  aria-label={`Actions for ${conversation.title}`}
                  aria-expanded={openMenuConversationId === conversation.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMenuConversationId((current) =>
                      current === conversation.id ? null : conversation.id,
                    );
                  }}
                  className="rounded px-2 py-1 text-sm leading-none text-zinc-500 hover:bg-zinc-700 hover:text-white"
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    ⋮
                  </span>
                </button>
              )}
              {openMenuConversationId === conversation.id && editingConversationId !== conversation.id && (
                <div className="absolute right-2 top-10 z-20 min-w-28 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuConversationId(null);
                      setEditingConversationId(conversation.id);
                      setEditingTitle(conversation.title);
                    }}
                    className="block w-full rounded px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuConversationId(null);
                      onDeleteConversation(conversation);
                    }}
                    className="block w-full rounded px-3 py-2 text-left text-xs text-red-300 hover:bg-red-950/60"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      </aside>
    </>
  );
}
