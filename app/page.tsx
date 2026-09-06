"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import ProviderSelectModal from "@/components/ProviderSelectModal";
import ChatComposer from "@/components/ChatComposer";
import ChatHeader from "@/components/ChatHeader";
import ChatMessages from "@/components/ChatMessages";
import ChatSidebar from "@/components/ChatSidebar";
import { useApiKeys } from "@/hooks/useApiKeys";
import { useAuth } from "@/hooks/useAuth";
import { useChatStream } from "@/hooks/useChatStream";
import { useConversations } from "@/hooks/useConversations";
import type { Conversation, Provider } from "@/lib/chat-types";

export default function Home({ conversationId }: { conversationId?: string }) {
  const router = useRouter();
  const { user, setUser, isCheckingAuth } = useAuth();
  const { apiKeys, setApiKeys } = useApiKeys(user);
  const conversationsState = useConversations(user, conversationId);
  const [input, setInput] = useState("");
  const [selectedApiKey, setSelectedApiKey] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const updateConversationUrl = (id: string | null, replace = false) => {
    const url = id ? `/c/${id}` : "/";
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  };

  const { isLoading, submit } = useChatStream({
    input,
    provider: conversationsState.provider,
    selectedApiKey,
    currentConversationId: conversationsState.currentConversationId,
    setInput,
    setMessages: conversationsState.setMessages,
    setUser,
    setCurrentConversationId: conversationsState.setCurrentConversationId,
    updateConversationUrl,
    setShowProviderModal,
    inputRef,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationsState.messages, isLoading]);

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleNewConversation = () => {
    conversationsState.setCurrentConversationId(null);
    conversationsState.setMessages(conversationsState.initialMessages);
    setInput("");
    setSelectedApiKey(null);
    updateConversationUrl(null);
    inputRef.current?.focus();
  };

  const handleRenameConversation = async (conversation: Conversation, title: string) => {
    await conversationsState.renameConversation(conversation, title);
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    setConversationToDelete(conversation);
  };

  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;
    const conversation = conversationToDelete;
    setConversationToDelete(null);
    const deleted = await conversationsState.deleteConversation(conversation);
    if (!deleted || conversationsState.currentConversationId !== conversation.id) return;

    conversationsState.setCurrentConversationId(null);
    conversationsState.setMessages(conversationsState.initialMessages);
    router.push("/");
  };

  const handleProviderSelect = (provider: string, apiKey?: string) => {
    conversationsState.setProvider(provider as Provider);
    setSelectedApiKey(apiKey || null);
    setShowProviderModal(false);
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0f] text-white">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <main className="flex h-screen min-h-0 overflow-hidden bg-[#0b0b0f] text-white">
      <ChatSidebar
        conversations={conversationsState.conversations}
        currentConversationId={conversationsState.currentConversationId}
        isLoading={conversationsState.isLoadingConversations}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewConversation={handleNewConversation}
        onRenameConversation={(conversation, title) => void handleRenameConversation(conversation, title)}
        onDeleteConversation={(conversation) => void handleDeleteConversation(conversation)}
        onSelectConversation={(conversation) => {
          updateConversationUrl(conversation.id);
          conversationsState.setCurrentConversationId(conversation.id);
          conversationsState.setMessages(
            conversation.messages.map((message) => ({
              id: message.id,
              role: message.role as "assistant" | "user",
              text: message.content,
            })),
          );
          conversationsState.setProvider(conversation.provider as Provider);
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader
          user={user}
          onLogout={() => setShowLogoutModal(true)}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        />
        <ChatMessages messages={conversationsState.messages} isLoading={isLoading} bottomRef={bottomRef} />
        <ChatComposer
          provider={conversationsState.provider}
          user={user}
          input={input}
          isLoading={isLoading}
          inputRef={inputRef}
          onInputChange={setInput}
          onSubmit={() => void submit()}
          onOpenProviderModal={() => setShowProviderModal(true)}
        />
      </div>

      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => void confirmLogout()}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
      />
      <ProviderSelectModal
        isOpen={showProviderModal}
        onClose={() => setShowProviderModal(false)}
        onSelect={handleProviderSelect}
        apiKeys={apiKeys}
        isLoading={conversationsState.isLoadingConversations}
        onKeySaved={(apiKey) => setApiKeys((current) => [apiKey, ...current])}
      />
      <ConfirmModal
        isOpen={conversationToDelete !== null}
        onClose={() => setConversationToDelete(null)}
        onConfirm={() => void confirmDeleteConversation()}
        title="Delete conversation"
        message={`Are you sure you want to delete "${conversationToDelete?.title ?? "this conversation"}"?`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </main>
  );
}
