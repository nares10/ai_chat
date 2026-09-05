import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  setupTestDatabase,
  createTestUser,
  loginUser,
  cleanupTestDatabase,
  getAuthHeaders,
} from "./setup";
import { prisma } from "../lib/prisma";

describe("Conversations and Message History", () => {
  let testUser: any;
  let sessionId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    testUser = await createTestUser("conv@example.com", "password123", "Conversation User");
    sessionId = await loginUser(testUser);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /api/conversations", () => {
    it("should return empty array for user with no conversations", async () => {
      const response = await fetch("http://localhost:3000/api/conversations", {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversations).toEqual([]);
    });

    it("should return user's conversations with messages", async () => {
      // Create a conversation via chat API
      const chatResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "First conversation message",
          provider: "openrouter",
        }),
      });

      expect(chatResponse.status).toBe(200);

      // Get conversations
      const response = await fetch("http://localhost:3000/api/conversations", {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversations).toHaveLength(1);
      expect(data.conversations[0].messages).toBeDefined();
      expect(data.conversations[0].messages.length).toBeGreaterThan(0);
    });

    it("should return conversations ordered by updated date", async () => {
      // Create multiple conversations
      for (let i = 1; i <= 3; i++) {
        await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: getAuthHeaders(sessionId),
          body: JSON.stringify({
            message: `Conversation ${i} message`,
            provider: "openrouter",
          }),
        });
      }

      const response = await fetch("http://localhost:3000/api/conversations", {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversations.length).toBeGreaterThan(0);
      
      // Most recent should be first
      const timestamps = data.conversations.map((c: any) => new Date(c.updatedAt).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch("http://localhost:3000/api/conversations", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("GET /api/conversations/[id]", () => {
    it("should return specific conversation with messages", async () => {
      // Create a conversation
      const chatResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Specific conversation test",
          provider: "openrouter",
        }),
      });

      expect(chatResponse.status).toBe(200);

      // Extract conversation ID
      const reader = chatResponse.body?.getReader();
      const decoder = new TextDecoder();
      let conversationId = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.replace(/^data:\s*/, "").trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const payload = JSON.parse(raw);
              if (payload.conversationId) {
                conversationId = payload.conversationId;
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }

      // Get specific conversation
      const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}`, {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.conversation).toBeDefined();
      expect(data.conversation.id).toBe(conversationId);
      expect(data.conversation.messages).toBeDefined();
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await fetch("http://localhost:3000/api/conversations/non-existent-id", {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Conversation not found");
    });

    it("should prevent access to another user's conversation", async () => {
      const otherUser = await createTestUser("otherconv@example.com", "password123", "Other Conv User");
      const otherSessionId = await loginUser(otherUser);

      // Create conversation for other user
      const otherChatResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(otherSessionId),
        body: JSON.stringify({
          message: "Other user's conversation",
          provider: "openrouter",
        }),
      });

      // Extract conversation ID
      const reader = otherChatResponse.body?.getReader();
      const decoder = new TextDecoder();
      let conversationId = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.replace(/^data:\s*/, "").trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const payload = JSON.parse(raw);
              if (payload.conversationId) {
                conversationId = payload.conversationId;
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }

      // Try to access with first user
      const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}`, {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Conversation not found");
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch("http://localhost:3000/api/conversations/some-id", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Message Persistence", () => {
    it("should save user messages to database", async () => {
      const userMessage = "Test user message persistence";
      
      const chatResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: userMessage,
          provider: "openrouter",
        }),
      });

      expect(chatResponse.status).toBe(200);

      // Check database for user message
      const messages = await prisma.message.findMany({
        where: {
          conversation: {
            userId: testUser.id,
          },
          role: "user",
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content).toBe(userMessage);
    });

    it("should save assistant messages to database", async () => {
      const chatResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test assistant message",
          provider: "openrouter",
        }),
      });

      expect(chatResponse.status).toBe(200);

      // Check database for assistant message
      const messages = await prisma.message.findMany({
        where: {
          conversation: {
            userId: testUser.id,
          },
          role: "assistant",
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content.length).toBeGreaterThan(0);
    });

    it("should associate messages with correct conversation", async () => {
      const chatResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test conversation association",
          provider: "openrouter",
        }),
      });

      expect(chatResponse.status).toBe(200);

      // Extract conversation ID
      const reader = chatResponse.body?.getReader();
      const decoder = new TextDecoder();
      let conversationId = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.replace(/^data:\s*/, "").trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const payload = JSON.parse(raw);
              if (payload.conversationId) {
                conversationId = payload.conversationId;
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }

      // Check that messages are associated with this conversation
      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversationId,
        },
      });

      expect(messages.length).toBeGreaterThanOrEqual(2); // At least user + assistant
      messages.forEach(msg => {
        expect(msg.conversationId).toBe(conversationId);
      });
    });
  });

  describe("Conversation Context", () => {
    it("should include conversation history in AI context", async () => {
      // Create a conversation with multiple messages
      const firstResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "First message for context",
          provider: "openrouter",
        }),
      });

      expect(firstResponse.status).toBe(200);

      // Extract conversation ID
      const reader = firstResponse.body?.getReader();
      const decoder = new TextDecoder();
      let conversationId = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const raw = line.replace(/^data:\s*/, "").trim();
            if (!raw || raw === "[DONE]") continue;

            try {
              const payload = JSON.parse(raw);
              if (payload.conversationId) {
                conversationId = payload.conversationId;
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }

      // Send second message to same conversation
      const secondResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Second message for context",
          provider: "openrouter",
          conversationId: conversationId,
        }),
      });

      expect(secondResponse.status).toBe(200);

      // Verify conversation has multiple messages
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: true,
        },
      });

      expect(conversation?.messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
    });
  });
});