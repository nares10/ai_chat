import type { Message } from "@/lib/chat-types";
import MarkdownMessage from "@/components/MarkdownMessage";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}

export default function ChatMessages({ messages, isLoading, bottomRef }: ChatMessagesProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8 xl:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 2xl:max-w-7xl">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
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
  );
}
