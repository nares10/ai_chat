import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { prisma } from "../lib/prisma";
import { TEST_BASE_URL, createAuthedUser, createTestApiKey, resetTestDatabase } from "./setup";

describe("api keys", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await prisma.$disconnect();
  });

  describe("GET /api/keys", () => {
    it("401s with no auth", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/keys`);

      expect(response.status).toBe(401);
    });

    it("returns an empty list for a fresh user", async () => {
      const { headers } = await createAuthedUser("keys-empty@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, { headers });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toEqual([]);
    });

    it("returns only the caller's own keys", async () => {
      const { user, headers } = await createAuthedUser("keys-owner@example.com");
      const { user: otherUser } = await createAuthedUser("keys-other@example.com");

      await createTestApiKey(user.id, { name: "Mine" });
      await createTestApiKey(otherUser.id, { name: "Not mine" });

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, { headers });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toHaveLength(1);
      expect(data.apiKeys[0].name).toBe("Mine");
    });

    it("returns the raw, unmasked key value (documents current behavior)", async () => {
      const { user, headers } = await createAuthedUser("keys-raw@example.com");
      await createTestApiKey(user.id, { key: "sk-raw-value-123" });

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, { headers });
      const data = await response.json();

      expect(data.apiKeys[0].key).toBe("sk-raw-value-123");
    });
  });

  describe("POST /api/keys", () => {
    it("401s with no auth", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sk-test", name: "Test", provider: "openai" }),
      });

      expect(response.status).toBe(401);
    });

    it("creates a key persisted with the correct userId", async () => {
      const { user, headers } = await createAuthedUser("keys-create@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({ key: "sk-created-key", name: "My Key", provider: "openai" }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.apiKey.userId).toBe(user.id);

      const dbKey = await prisma.apiKey.findUnique({ where: { id: data.apiKey.id } });
      expect(dbKey?.userId).toBe(user.id);
    });

    it("400s when key is missing", async () => {
      const { headers } = await createAuthedUser("keys-missing-key@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Test", provider: "openai" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when name is missing", async () => {
      const { headers } = await createAuthedUser("keys-missing-name@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({ key: "sk-test", provider: "openai" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when provider is missing", async () => {
      const { headers } = await createAuthedUser("keys-missing-provider@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({ key: "sk-test", name: "Test" }),
      });

      expect(response.status).toBe(400);
    });

    it("409s when the same key value is already used by a different user", async () => {
      const { user: firstUser } = await createAuthedUser("keys-dup-first@example.com");
      const { headers: secondHeaders } = await createAuthedUser("keys-dup-second@example.com");

      await createTestApiKey(firstUser.id, { key: "sk-shared-value" });

      const response = await fetch(`${TEST_BASE_URL}/api/keys`, {
        method: "POST",
        headers: secondHeaders,
        body: JSON.stringify({ key: "sk-shared-value", name: "Duplicate", provider: "openai" }),
      });

      expect(response.status).toBe(409);
    });
  });

  describe("DELETE /api/keys/[id]", () => {
    it("401s with no auth", async () => {
      const { user } = await createAuthedUser("keys-delete-owner@example.com");
      const apiKey = await createTestApiKey(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/keys/${apiKey.id}`, { method: "DELETE" });

      expect(response.status).toBe(401);
    });

    it("deletes the caller's own key", async () => {
      const { user, headers } = await createAuthedUser("keys-delete-success@example.com");
      const apiKey = await createTestApiKey(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/keys/${apiKey.id}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(await prisma.apiKey.findUnique({ where: { id: apiKey.id } })).toBeNull();
    });

    it("404s for a nonexistent key", async () => {
      const { headers } = await createAuthedUser("keys-delete-missing@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/keys/does-not-exist`, {
        method: "DELETE",
        headers,
      });

      expect(response.status).toBe(404);
    });

    it("404s and leaves another user's key intact", async () => {
      const { user: owner } = await createAuthedUser("keys-delete-victim@example.com");
      const { headers: attackerHeaders } = await createAuthedUser("keys-delete-attacker@example.com");
      const apiKey = await createTestApiKey(owner.id);

      const response = await fetch(`${TEST_BASE_URL}/api/keys/${apiKey.id}`, {
        method: "DELETE",
        headers: attackerHeaders,
      });

      expect(response.status).toBe(404);
      expect(await prisma.apiKey.findUnique({ where: { id: apiKey.id } })).not.toBeNull();
    });
  });
});
