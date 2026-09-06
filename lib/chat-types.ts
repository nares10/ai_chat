export type Provider = "openrouter" | "openai" | "anthropic";

export type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  conversationId?: string;
};

export type Conversation = {
  id: string;
  title: string;
  provider: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
  }>;
};

export type ChatUser = {
  id: string;
  email: string;
  name: string;
  freeMessagesUsed: number;
};

export type ApiKey = {
  id: string;
  name: string;
  provider: string;
  key: string;
};
