"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FREE_MESSAGE_LIMIT } from "@/lib/freeMessages";
import type { ApiKey, Conversation } from "@/lib/chat-types";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isCheckingAuth } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    void Promise.all([
      fetch("/api/keys").then((response) => (response.ok ? response.json() : { apiKeys: [] })),
      fetch("/api/conversations").then((response) =>
        response.ok ? response.json() : { conversations: [] },
      ),
    ])
      .then(([keysData, conversationsData]) => {
        setApiKeys(keysData.apiKeys || []);
        setConversations(conversationsData.conversations || []);
      })
      .finally(() => setIsLoadingStats(false));
  }, [user]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isCheckingAuth || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0f] text-white">
        <p className="text-sm text-zinc-400">Loading profile...</p>
      </main>
    );
  }

  const initials = user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase();
  const usagePercent = Math.min(100, (user.freeMessagesUsed / FREE_MESSAGE_LIMIT) * 100);
  const totalMessages = conversations.reduce(
    (total, conversation) => total + conversation.messages.length,
    0,
  );
  const providers = [...new Set(apiKeys.map((apiKey) => apiKey.provider))];

  const maskApiKey = (key: string) => {
    if (key.length <= 5) return key;
    return `${key.slice(0, 5)}••••••••`;
  };

  const copyApiKey = async (apiKey: ApiKey) => {
    try {
      await navigator.clipboard.writeText(apiKey.key);
      setCopiedKeyId(apiKey.id);
      window.setTimeout(() => setCopiedKeyId(null), 1500);
    } catch {
      setCopiedKeyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm text-zinc-400 transition hover:text-white">
            Back to chat
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </header>

        <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-semibold text-zinc-950">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold">{user.name || "Your profile"}</h1>
              <p className="mt-1 truncate text-sm text-zinc-400">{user.email}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Name</p>
              <p className="mt-2 text-sm text-zinc-100">{user.name || "Not provided"}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Email</p>
              <p className="mt-2 truncate text-sm text-zinc-100">{user.email}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Free messages</p>
                <p className="mt-2 text-sm text-zinc-100">
                  {user.freeMessagesUsed} of {FREE_MESSAGE_LIMIT} used
                </p>
              </div>
              <p className="text-sm text-zinc-400">
                {Math.max(0, FREE_MESSAGE_LIMIT - user.freeMessagesUsed)} remaining
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-white transition-[width]"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Conversations</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {isLoadingStats ? "-" : conversations.length}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Messages</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {isLoadingStats ? "-" : totalMessages}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Providers</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {isLoadingStats ? "-" : providers.length}
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-800 pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">API keys</h2>
                <p className="mt-1 text-sm text-zinc-400">Connected providers for your chats</p>
              </div>
              <span className="text-sm text-zinc-500">{apiKeys.length} saved</span>
            </div>

            <div className="mt-4 space-y-3">
              {isLoadingStats ? (
                <p className="text-sm text-zinc-500">Loading API keys...</p>
              ) : apiKeys.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                  No API keys connected.
                </p>
              ) : (
                apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{apiKey.name}</p>
                      <p className="mt-1 capitalize text-xs font-medium text-zinc-100">{apiKey.provider}</p>
                    </div>
                    <code className="justify-self-center text-xs text-zinc-400">
                      {maskApiKey(apiKey.key)}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copyApiKey(apiKey)}
                      className="justify-self-end rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-700"
                    >
                      {copiedKeyId === apiKey.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
