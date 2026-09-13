import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { prisma } from "../lib/prisma";
import {
  TEST_BASE_URL,
  authHeaders,
  createExpiredSession,
  createSession,
  createTestUser,
  resetTestDatabase,
} from "./setup";

describe("auth", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await resetTestDatabase();
    await prisma.$disconnect();
  });

  describe("POST /api/auth/register", () => {
    it("creates a user and never returns the password hash", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new.user@example.com",
          password: "password123",
          confirmPassword: "password123",
          name: "New User",
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user).toMatchObject({ email: "new.user@example.com", name: "New User" });
      expect(data.user.passwordHash).toBeUndefined();

      const dbUser = await prisma.user.findUnique({ where: { email: "new.user@example.com" } });
      expect(dbUser?.emailVerified).toBe(true);
      expect(dbUser?.passwordHash).not.toBe("password123");
    });

    it("allows registering without confirmPassword", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "no-confirm@example.com",
          password: "password123",
          name: "No Confirm",
        }),
      });

      expect(response.status).toBe(201);
    });

    it("400s when email is missing", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "password123", name: "No Email" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when password is missing", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "no-password@example.com", name: "No Password" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when name is missing", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "no-name@example.com", password: "password123" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when name is shorter than 2 characters", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "short-name@example.com", password: "password123", name: "A" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when password is shorter than 8 characters", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "short-pass@example.com", password: "short1", name: "Short Pass" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when confirmPassword does not match password", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "mismatch@example.com",
          password: "password123",
          confirmPassword: "different123",
          name: "Mismatch",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("409s when the email is already registered", async () => {
      await createTestUser("duplicate@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "password123",
          name: "Duplicate",
        }),
      });

      expect(response.status).toBe(409);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with correct credentials and sets a session cookie", async () => {
      const user = await createTestUser("login@example.com", "Login User");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "login@example.com", password: "password123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toMatchObject({ email: "login@example.com", name: "Login User" });
      expect(response.headers.get("set-cookie")).toContain("session_id=");

      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions).toHaveLength(1);
    });

    it("logs in with a form-data body", async () => {
      await createTestUser("login-form@example.com");

      const form = new FormData();
      form.set("email", "login-form@example.com");
      form.set("password", "password123");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: "POST",
        body: form,
      });

      expect(response.status).toBe(200);
    });

    it("401s on wrong password", async () => {
      await createTestUser("wrong-pass@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "wrong-pass@example.com", password: "incorrect" }),
      });

      expect(response.status).toBe(401);
    });

    it("401s on unknown email", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "unknown@example.com", password: "password123" }),
      });

      expect(response.status).toBe(401);
    });

    it("400s when email is missing", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "password123" }),
      });

      expect(response.status).toBe(400);
    });

    it("400s when password is missing", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "someone@example.com" }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("deletes the session and clears the cookie", async () => {
      const user = await createTestUser("logout@example.com");
      const sessionId = await createSession(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: authHeaders(sessionId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(await prisma.session.findUnique({ where: { id: sessionId } })).toBeNull();
    });

    it("is a no-op with no cookie", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/logout`, { method: "POST" });

      expect(response.status).toBe(200);
    });

    it("is idempotent when called twice with an already-invalidated cookie", async () => {
      const user = await createTestUser("logout-twice@example.com");
      const sessionId = await createSession(user.id);

      await fetch(`${TEST_BASE_URL}/api/auth/logout`, { method: "POST", headers: authHeaders(sessionId) });
      const secondResponse = await fetch(`${TEST_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: authHeaders(sessionId),
      });

      expect(secondResponse.status).toBe(200);
    });
  });

  describe("GET /api/auth/me", () => {
    it("401s with no cookie", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/me`);

      expect(response.status).toBe(401);
    });

    it("401s with a garbage session id", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/me`, {
        headers: authHeaders("not-a-real-session-id"),
      });

      expect(response.status).toBe(401);
    });

    it("401s with an expired session", async () => {
      const user = await createTestUser("expired@example.com");
      const sessionId = await createExpiredSession(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/auth/me`, {
        headers: authHeaders(sessionId),
      });

      expect(response.status).toBe(401);
    });

    it("returns the current user without the password hash", async () => {
      const user = await createTestUser("me@example.com", "Me User");
      const sessionId = await createSession(user.id);

      const response = await fetch(`${TEST_BASE_URL}/api/auth/me`, {
        headers: authHeaders(sessionId),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toMatchObject({ email: "me@example.com", name: "Me User" });
      expect(data.user.passwordHash).toBeUndefined();
    });
  });
});
