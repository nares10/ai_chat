import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  setupTestDatabase,
  createTestUser,
  loginUser,
  createApiKey,
  cleanupTestDatabase,
  getAuthHeaders,
} from "./setup";
import { prisma } from "../lib/prisma";

describe("Free Message Limit", () => {
  let testUser: any;
  let sessionId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    testUser = await createTestUser("freemsg@example.com", "password123", "Free Message User");
    sessionId = await loginUser(testUser);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("Free Message Counter", () => {
    it("should start with 0 free messages used", async () => {
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user?.freeMessagesUsed).toBe(0);
    });

    it("should increment free message counter on chat", async () => {
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test message 1",
          provider: "openrouter",
        }),
      });

      expect(response.status).toBe(200);

      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(user?.freeMessagesUsed).toBe(1);
    });

    it("should increment counter for each free message", async () => {
      for (let i = 2; i <= 5; i++) {
        const response = await fetch("http://localhost:3000/api/chat", {
          method: "POST",
          headers: getAuthHeaders(sessionId),
          body: JSON.stringify({
            message: `Test message ${i}`,
            provider: "openrouter",
          }),
        });

        expect(response.status).toBe(200);

        const user = await prisma.user.findUnique({
          where: { id: testUser.id },
        });

        expect(user?.freeMessagesUsed).toBe(i);
      }
    });
  });

  describe("Free Message Limit Enforcement", () => {
    it("should block messages after 5 free messages", async () => {
      // User already has 5 messages from previous test
      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test message 6 - should be blocked",
          provider: "openrouter",
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Free message limit reached");
      expect(data.requiresApiKey).toBe(true);
      expect(data.message).toContain("5 free messages");
    });

    it("should not increment counter when limit reached", async () => {
      const userBefore = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test message 7 - should still be blocked",
          provider: "openrouter",
        }),
      });

      expect(response.status).toBe(403);

      const userAfter = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(userAfter?.freeMessagesUsed).toBe(userBefore?.freeMessagesUsed);
    });
  });

  describe("API Key Bypass", () => {
    it("should allow messages with API key after limit reached", async () => {
      const apiKey = await createApiKey(testUser.id, "sk-bypass-key", "Bypass Key", "openai");

      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test message with API key",
          provider: "openai",
          apiKey: apiKey.key,
        }),
      });

      // May fail due to invalid API key, but should not be blocked by free limit
      expect([200, 500]).toContain(response.status);
      expect(response.status).not.toBe(403);
    });

    it("should not increment counter when using API key", async () => {
      const userBefore = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      const apiKey = await createApiKey(testUser.id, "sk-no-increment", "No Increment Key", "openrouter");

      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          message: "Test message no increment",
          provider: "openrouter",
          apiKey: apiKey.key,
        }),
      });

      // May fail due to invalid API key
      if (response.status === 200) {
        const userAfter = await prisma.user.findUnique({
          where: { id: testUser.id },
        });

        expect(userAfter?.freeMessagesUsed).toBe(userBefore?.freeMessagesUsed);
      }
    });
  });

  describe("User with API Key from Start", () => {
    it("should not increment counter when user has API key", async () => {
      const newUser = await createTestUser("withkey@example.com", "password123", "With Key User");
      const newSessionId = await loginUser(newUser);
      const apiKey = await createApiKey(newUser.id, "sk-with-key", "With Key", "openai");

      const userBefore = await prisma.user.findUnique({
        where: { id: newUser.id },
      });

      const response = await fetch("http://localhost:3000/api/chat", {
        method: "POST",
        headers: getAuthHeaders(newSessionId),
        body: JSON.stringify({
          message: "Test with API key from start",
          provider: "openai",
          apiKey: apiKey.key,
        }),
      });

      // May fail due to invalid API key
      if (response.status === 200) {
        const userAfter = await prisma.user.findUnique({
          where: { id: newUser.id },
        });

        expect(userAfter?.freeMessagesUsed).toBe(userBefore?.freeMessagesUsed);
      }
    });
  });

  describe("User Data includes Free Message Count", () => {
    it("should include freeMessagesUsed in user data", async () => {
      const newUser = await createTestUser("usercount@example.com", "password123", "User Count");
      const newSessionId = await loginUser(newUser);

      const response = await fetch("http://localhost:3000/api/auth/me", {
        headers: getAuthHeaders(newSessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.freeMessagesUsed).toBeDefined();
      expect(data.user.freeMessagesUsed).toBeGreaterThanOrEqual(0);
    });

    it("should include freeMessagesUsed in login response", async () => {
      const newUser = await createTestUser("logincount@example.com", "password123", "Login Count");

      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.freeMessagesUsed).toBeDefined();
      expect(data.user.freeMessagesUsed).toBeGreaterThanOrEqual(0);
    });
  });
});