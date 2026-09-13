import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { prisma } from "../lib/prisma";
import {
  TEST_BASE_URL,
  createAuthedUser,
  createTestConversation,
  createTestMessage,
  resetTestDatabase,
} from "./setup";

describe("conversations", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await prisma.$disconnect();
  });

  describe("GET /api/conversations", () => {
    it("401s with no auth", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/conversations`);

      expect(response.status).toBe(401);
    });

    it("returns an empty list for a fresh user", async () => {
      const { headers } = await createAuthedUser("empty-list@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/conversations`, { headers });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversations).toEqual([]);
    });

    it("returns only the caller's own conversations, ordered by updatedAt desc", async () => {
      const { user, headers } = await createAuthedUser("owner@example.com");
      const { user: otherUser } = await createAuthedUser("other@example.com");

      const older = await createTestConversation(user.id, { title: "Older" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const newer = await createTestConversation(user.id, { title: "Newer" });
      const notMine = await createTestConversation(otherUser.id, { title: "Not mine" });

      const response = await fetch(`${TEST_BASE_URL}/api/conversations`, { headers });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversations).toHaveLength(2);
      expect(data.conversations[0].id).toBe(newer.id);
      expect(data.conversations[1].id).toBe(older.id);
      expect(data.conversations.some((c: { id: string }) => c.id === notMine.id)).toBe(false);
    });

    it("returns nested messages in ascending order", async () => {
      const { user, headers } = await createAuthedUser("with-messages@example.com");
      const conversation = await createTestConversation(user.id);
      const first = await createTestMessage(conversation.id, { content: "First" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await createTestMessage(conversation.id, { content: "Second" });

      const response = await fetch(`${TEST_BASE_URL}/api/conversations`, { headers });
      const data = await response.json();

      const messages = data.conversations[0].messages;
      expect(messages.map((m: { id: string }) => m.id)).toEqual([first.id, second.id]);
    });
  });

  describe("GET /api/conversations/[id]", () => {
    it("401s with no auth", async () => {
      const { user } = await createAuthedUser("owner2@example.com");
      const conversation = await createTestConversation(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`);

      expect(response.status).toBe(401);
    });

    it("returns the conversation with messages for the owner", async () => {
      const { user, headers } = await createAuthedUser("get-owner@example.com");
      const conversation = await createTestConversation(user.id, { title: "Mine" });
      await createTestMessage(conversation.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, { headers });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversation.title).toBe("Mine");
      expect(data.conversation.messages).toHaveLength(1);
    });

    it("404s for a nonexistent conversation", async () => {
      const { headers } = await createAuthedUser("get-missing@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/does-not-exist`, { headers });

      expect(response.status).toBe(404);
    });

    it("404s when requesting another user's conversation", async () => {
      const { user: owner } = await createAuthedUser("get-victim@example.com");
      const { headers: attackerHeaders } = await createAuthedUser("get-attacker@example.com");
      const conversation = await createTestConversation(owner.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        headers: attackerHeaders,
      });

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/conversations/[id]", () => {
    it("401s with no auth", async () => {
      const { user } = await createAuthedUser("patch-owner@example.com");
      const conversation = await createTestConversation(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New title" }),
      });

      expect(response.status).toBe(401);
    });

    it("renames the conversation and persists it", async () => {
      const { user, headers } = await createAuthedUser("patch-success@example.com");
      const conversation = await createTestConversation(user.id, { title: "Old title" });

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title: "New title" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe("New title");

      const dbConversation = await prisma.conversation.findUnique({ where: { id: conversation.id } });
      expect(dbConversation?.title).toBe("New title");
    });

    it("400s on an empty/whitespace-only title", async () => {
      const { user, headers } = await createAuthedUser("patch-empty@example.com");
      const conversation = await createTestConversation(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title: "   " }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when title is missing", async () => {
      const { user, headers } = await createAuthedUser("patch-missing-title@example.com");
      const conversation = await createTestConversation(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it("404s for a nonexistent conversation", async () => {
      const { headers } = await createAuthedUser("patch-missing@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/does-not-exist`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title: "New title" }),
      });

      expect(response.status).toBe(404);
    });

    it("404s and leaves the title unchanged when renaming another user's conversation", async () => {
      const { user: owner } = await createAuthedUser("patch-victim@example.com");
      const { headers: attackerHeaders } = await createAuthedUser("patch-attacker@example.com");
      const conversation = await createTestConversation(owner.id, { title: "Untouched" });

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: attackerHeaders,
        body: JSON.stringify({ title: "Hijacked" }),
      });

      expect(response.status).toBe(404);
      expect(
        (await prisma.conversation.findUnique({ where: { id: conversation.id } }))?.title,
      ).toBe("Untouched");
    });
  });

  describe("DELETE /api/conversations/[id]", () => {
    it("401s with no auth", async () => {
      const { user } = await createAuthedUser("delete-owner@example.com");
      const conversation = await createTestConversation(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "DELETE",
      });

      expect(response.status).toBe(401);
    });

    it("deletes the conversation and cascades to its messages", async () => {
      const { user, headers } = await createAuthedUser("delete-success@example.com");
      const conversation = await createTestConversation(user.id);
      await createTestMessage(conversation.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(await prisma.conversation.findUnique({ where: { id: conversation.id } })).toBeNull();
      expect(
        await prisma.message.findMany({ where: { conversationId: conversation.id } }),
      ).toHaveLength(0);
    });

    it("404s for a nonexistent/already-deleted conversation", async () => {
      const { headers } = await createAuthedUser("delete-missing@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/does-not-exist`, {
        method: "DELETE",
        headers,
      });

      expect(response.status).toBe(404);
    });

    it("404s and leaves another user's conversation intact", async () => {
      const { user: owner } = await createAuthedUser("delete-victim@example.com");
      const { headers: attackerHeaders } = await createAuthedUser("delete-attacker@example.com");
      const conversation = await createTestConversation(owner.id);

      const response = await fetch(`${TEST_BASE_URL}/api/conversations/${conversation.id}`, {
        method: "DELETE",
        headers: attackerHeaders,
      });

      expect(response.status).toBe(404);
      expect(await prisma.conversation.findUnique({ where: { id: conversation.id } })).not.toBeNull();
    });
  });
});
