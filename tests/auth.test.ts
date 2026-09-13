import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  TEST_BASE_URL,
  authHeaders,
  createExpiredSession,
  createPendingRegistration,
  createSession,
  createTestUser,
  resetTestDatabase,
  verifyPendingRegistration,
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
    it("400s when name or email is missing", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "missing-name@example.com" }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("required");
    });

    it("400s on an invalid email", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", name: "Test User" }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("valid email");
    });

    it("409s when the email is already registered", async () => {
      await createTestUser("duplicate@example.com");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "duplicate@example.com", name: "Duplicate" }),
      });

      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("User already exists");
    });

    it("creates a pending registration without creating a user", async () => {
      const email = "pending@example.com";

      const response = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: "Pending User" }),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).email).toBe(email);

      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      expect(pending?.name).toBe("Pending User");
      expect(pending?.verifiedAt).toBeNull();
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it("rate limits an immediate resend", async () => {
      const email = "rate-limited@example.com";
      const body = JSON.stringify({ email, name: "Rate Limited" });

      const first = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(first.status).toBe(200);

      const second = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      expect(second.status).toBe(429);
      expect((await second.json()).retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("verifies a valid code and returns a verification token", async () => {
      const email = "verify@example.com";
      const code = "123456";
      await createPendingRegistration(email, "Verify User", code);

      const response = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      expect(response.status).toBe(200);
      expect((await response.json()).verificationToken).toBeTruthy();

      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      expect(pending?.verifiedAt).not.toBeNull();

      // The account is only created once a password is chosen.
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it("rejects an invalid code and counts the attempt", async () => {
      const email = "invalid-code@example.com";
      await createPendingRegistration(email, "Invalid Code User", "123456");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: "000000" }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("invalid or expired");

      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      expect(pending?.attempts).toBe(1);
    });

    it("rejects an expired code", async () => {
      const email = "expired-code@example.com";
      const code = "123456";
      await createPendingRegistration(email, "Expired Code User", code, {
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("invalid or expired");
    });
  });

  describe("POST /api/auth/complete-registration", () => {
    it("creates a verified user and a session", async () => {
      const email = "completed@example.com";
      const verificationToken = await verifyPendingRegistration(email, "Completed User");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationToken,
          password: "password123",
          confirmPassword: "password123",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user.email).toBe(email);
      expect(data.user.name).toBe("Completed User");
      expect(response.headers.get("set-cookie")).toContain("session_id");

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.emailVerified).toBe(true);
      expect(await prisma.pendingRegistration.findUnique({ where: { email } })).toBeNull();
    });

    it("rejects a wrong verification token", async () => {
      const email = "wrong-token@example.com";
      await verifyPendingRegistration(email, "Wrong Token User");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationToken: "not-the-right-token",
          password: "password123",
          confirmPassword: "password123",
        }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("invalid or expired");
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it("rejects an unverified email", async () => {
      const email = "unverified@example.com";
      await createPendingRegistration(email, "Unverified User", "123456");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationToken: "some-token",
          password: "password123",
          confirmPassword: "password123",
        }),
      });

      expect(response.status).toBe(400);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it("rejects mismatched passwords", async () => {
      const email = "mismatch@example.com";
      const verificationToken = await verifyPendingRegistration(email, "Mismatch User");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationToken,
          password: "password123",
          confirmPassword: "different123",
        }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("Passwords do not match");
    });

    it("rejects a short password", async () => {
      const email = "short-password@example.com";
      const verificationToken = await verifyPendingRegistration(email, "Short Password User");

      const response = await fetch(`${TEST_BASE_URL}/api/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationToken,
          password: "short",
          confirmPassword: "short",
        }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("8 characters");
    });
  });

  describe("registration flow end to end", () => {
    it("goes from name and email through the code to a usable login", async () => {
      const email = "flow@example.com";
      const code = "654321";

      const registerResponse = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: "Flow User" }),
      });
      expect(registerResponse.status).toBe(200);

      // The emailed code never reaches the test, so swap in a known one.
      await prisma.pendingRegistration.update({
        where: { email },
        data: { codeHash: createHash("sha256").update(code).digest("hex") },
      });

      const verifyResponse = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      expect(verifyResponse.status).toBe(200);
      const { verificationToken } = await verifyResponse.json();

      const completeResponse = await fetch(`${TEST_BASE_URL}/api/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          verificationToken,
          password: "password123",
          confirmPassword: "password123",
        }),
      });
      expect(completeResponse.status).toBe(201);

      const loginResponse = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });

      expect(loginResponse.status).toBe(200);
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
