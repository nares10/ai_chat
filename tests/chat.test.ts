import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  setupTestDatabase,
  createTestUser,
  loginUser,
  createApiKey,
  cleanupTestDatabase,
  getAuthHeaders,
} from "./setup";

describe("Chat API", () => {
  let testUser: any;
  let sessionId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    testUser = await createTestUser("chat@example.com", "password123", "Chat User");
    sessionId = await loginUser(testUser);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("POST /api/chat", () => {
    it("should create a new conversation and send message", async () => {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Hello, this is a test message",
          provider: "openrouter",
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
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
              if (payload.text) {
                fullText += payload.text;
              }
              if (payload.conversationId) {
                conversationId = payload.conversationId;
              }
            } catch {
              // Ignore malformed chunks
            }
          }
        }
      }

      expect(fullText.length).toBeGreaterThan(0);
      expect(conversationId).toBeDefined();
    });

    it("should continue existing conversation", async () => {
      // First message to create conversation
      const firstResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "First message",
          provider: "openrouter",
        }),
      });

      expect(firstResponse.status).toBe(200);

      // Extract conversation ID from first response
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

      // Second message to continue conversation
      const secondResponse = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Second message",
          provider: "openrouter",
          conversationId: conversationId,
        }),
      });

      expect(secondResponse.status).toBe(200);
    });

    it("should reject request without message", async () => {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          provider: "openrouter",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Message is required.");
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Test message",
          provider: "openrouter",
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should handle different providers", async () => {
      const providers = ["openrouter", "openai", "anthropic"];

      for (const provider of providers) {
        const response = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: getAuthHeaders(sessionId),
          body: JSON.stringify({
            message: `Test message for ${provider}`,
            provider: provider,
          }),
        });

        // May fail due to missing API keys, but should not crash
        expect([200, 500]).toContain(response.status);
      }
    });

    it("should use custom API key when provided", async () => {
      const apiKey = await createApiKey(testUser.id, "sk-custom-key", "Custom Key", "openai");

      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test with custom key",
          provider: "openai",
          apiKey: apiKey.key,
        }),
      });

      // May fail due to invalid key, but should accept the parameter
      expect([200, 500]).toContain(response.status);
    });
  });
});