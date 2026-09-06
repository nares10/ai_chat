import type { ChatUser } from "@/lib/chat-types";
import Link from "next/link";

interface ChatHeaderProps {
  user: ChatUser | null;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export default function ChatHeader({ user, onLogout, onToggleSidebar }: ChatHeaderProps) {
  return (
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur-sm lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 2xl:max-w-7xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle conversation sidebar"
            onClick={onToggleSidebar}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-lg leading-none text-zinc-200 transition hover:bg-zinc-800"
          >
            ☰
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-950">
            AI
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Assistant</p>
            <p className="text-xs text-zinc-400">Online</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            aria-label="Open profile"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
          >
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </Link>
          <button
            onClick={onLogout}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-800"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
