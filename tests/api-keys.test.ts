import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  setupTestDatabase,
  createTestUser,
  loginUser,
  createApiKey,
  cleanupTestDatabase,
  getAuthHeaders,
} from "./setup";

describe("API Key Management API", () => {
  let testUser: any;
  let sessionId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    testUser = await createTestUser("apikey@example.com", "password123", "API Key User");
    sessionId = await loginUser(testUser);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /api/keys", () => {
    it("should return empty array for user with no API keys", async () => {
      const response = await fetch("http://localhost:3000/api/keys", {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.apiKeys).toEqual([]);
    });

    it("should return user's API keys", async () => {
      await createApiKey(testUser.id, "sk-test-key-1", "Test Key 1", "openai");
      await createApiKey(testUser.id, "sk-test-key-2", "Test Key 2", "anthropic");

      const response = await fetch("http://localhost:3000/api/keys", {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.apiKeys).toHaveLength(2);
      expect(data.apiKeys[0].name).toBe("Test Key 2"); // Most recent first
      expect(data.apiKeys[1].name).toBe("Test Key 1");
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch("http://localhost:3000/api/keys", {
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("POST /api/keys", () => {
    it("should create a new API key", async () => {
      const response = await fetch("http://localhost:3000/api/keys", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          key: "sk-test-new-key",
          name: "New Test Key",
          provider: "openrouter",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.apiKey).toBeDefined();
      expect(data.apiKey.key).toBe("sk-test-new-key");
      expect(data.apiKey.name).toBe("New Test Key");
      expect(data.apiKey.provider).toBe("openrouter");
    });

    it("should reject creation with duplicate key", async () => {
      const response = await fetch("http://localhost:3000/api/keys", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          key: "sk-test-new-key", // Already created
          name: "Duplicate Key",
          provider: "openai",
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("API key already exists");
    });

    it("should reject creation with missing fields", async () => {
      const response = await fetch("http://localhost:3000/api/keys", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
        body: JSON.stringify({
          key: "sk-test-incomplete",
          name: "Incomplete Key",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("required");
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch("http://localhost:3000/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "sk-test-unauth",
          name: "Unauthorized Key",
          provider: "openai",
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("DELETE /api/keys/[id]", () => {
    it("should delete an API key", async () => {
      const apiKey = await createApiKey(testUser.id, "sk-test-delete", "Delete Key", "openai");

      const response = await fetch(`http://localhost:3000/api/keys/${apiKey.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("API key deleted successfully");
    });

    it("should return 404 for non-existent key", async () => {
      const response = await fetch("http://localhost:3000/api/keys/non-existent-id", {
        method: "DELETE",
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("API key not found");
    });

    it("should prevent deletion of another user's key", async () => {
      const otherUser = await createTestUser("other@example.com", "password123", "Other User");
      const otherSessionId = await loginUser(otherUser);
      const otherApiKey = await createApiKey(otherUser.id, "sk-test-other", "Other Key", "anthropic");

      const response = await fetch(`http://localhost:3000/api/keys/${otherApiKey.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(sessionId), // Using first user's session
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("API key not found");
    });

    it("should return 401 for unauthenticated request", async () => {
      const apiKey = await createApiKey(testUser.id, "sk-test-unauth-delete", "Unauth Delete", "openai");

      const response = await fetch(`http://localhost:3000/api/keys/${apiKey.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });
  });
});