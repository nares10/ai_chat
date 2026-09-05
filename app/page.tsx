"use client";

import { useEffect, useRef, useState } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";

type Provider = "openrouter" | "openai" | "anthropic";

type Message = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

const initialMessages: Message[] = [
  {
    id: 1,
    role: "assistant",
    text: "Hello! I’m ready to help. Ask me anything.",
  },
  {
    id: 2,
    role: "user",
    text: "Can you build a simple chat UI for me?",
  },
  {
    id: 3,
    role: "assistant",
    text: "Absolutely — here’s a clean AI-style interface with a composer at the bottom.",
  },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>("openrouter");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async () => {
    const trimmed = input.trim();

    if (!trimmed || isLoading) {
      inputRef.current?.focus();
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      text: trimmed,
    };

    const assistantId = Date.now() + 1;

    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", text: "" }]);
    setInput("");
    setIsLoading(true);
    inputRef.current?.focus();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed, provider }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to get a response from the AI.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;

          const rawPayload = trimmedLine.replace(/^data:\s*/, "").trim();
          if (!rawPayload || rawPayload === "[DONE]") continue;

          try {
            const payload = JSON.parse(rawPayload) as { text?: string };
            const textChunk = payload.text ?? "";

            if (!textChunk) continue;

            fullText += textChunk;
            setMessages((current) => {
              const lastMessage = current[current.length - 1];
              if (!lastMessage || lastMessage.role !== "assistant") {
                return [...current, { id: assistantId, role: "assistant", text: fullText }];
              }

              return [
                ...current.slice(0, -1),
                { ...lastMessage, text: fullText },
              ];
            });
          } catch {
            // ignore malformed stream chunks
          }
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now() + 2,
        role: "assistant",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      };

      setMessages((current) => [...current, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0b0f] text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-950">
              AI
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Assistant</p>
              <p className="text-xs text-zinc-400">Online</p>
            </div>
          </div>

          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as Provider)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none"
            aria-label="Select AI provider"
          >
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Claude</option>
          </select>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-md bg-white px-4 py-3 text-sm text-zinc-900"
                    : "max-w-[80%] rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-3 text-sm text-zinc-100"
                }
              >
                <MarkdownMessage text={message.text} />
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-3 text-sm text-zinc-300">
                Thinking...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-zinc-800 bg-zinc-950/80 p-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-2 shadow-lg shadow-black/20">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={input}
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={isLoading ? "Waiting for response..." : "Message Assistant..."}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              void handleSubmit();
            }}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}
