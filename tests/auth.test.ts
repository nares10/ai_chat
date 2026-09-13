import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createHash } from "node:crypto";
import {
  setupTestDatabase,
  createTestUser,
  loginUser,
  cleanupTestDatabase,
  getAuthHeaders,
  createPendingRegistration,
  verifyPendingRegistration,
} from "./setup";
import { prisma } from "../lib/prisma";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3010";

describe("Authentication API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should reject registration with missing fields", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "missing-name@example.com",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("required");
    });

    it("should reject registration with an invalid email", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "not-an-email",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("valid email");
    });

    it("should reject registration with an existing email", async () => {
      await createTestUser("test@example.com", "password123", "Test User");
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("User already exists");
    });

    it("should create a pending registration without creating a user", async () => {
      const email = "pending@example.com";

      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name: "Pending User" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.email).toBe(email);

      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      expect(pending?.name).toBe("Pending User");
      expect(pending?.verifiedAt).toBeNull();
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it("should rate limit an immediate resend", async () => {
      const email = "rate-limited@example.com";
      const body = JSON.stringify({ email, name: "Rate Limited" });

      const first = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(first.status).toBe(200);

      const second = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      expect(second.status).toBe(429);
      const data = await second.json();
      expect(data.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("should verify a valid code and return a verification token", async () => {
      const email = "verify@example.com";
      const code = "123456";
      await createPendingRegistration(email, "Verify User", code);

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.verificationToken).toBeTruthy();

      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      expect(pending?.verifiedAt).not.toBeNull();

      // The account is only created once a password is chosen.
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it("should reject an invalid verification code and count the attempt", async () => {
      const email = "invalid-code@example.com";
      await createPendingRegistration(email, "Invalid Code User", "123456");

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: "000000" }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("invalid or expired");

      const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
      expect(pending?.attempts).toBe(1);
    });

    it("should reject an expired verification code", async () => {
      const email = "expired-code@example.com";
      const code = "123456";
      await createPendingRegistration(email, "Expired Code User", code, {
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("invalid or expired");
    });
  });

  describe("POST /api/auth/complete-registration", () => {
    it("should create a verified user and a session", async () => {
      const email = "completed@example.com";
      const verificationToken = await verifyPendingRegistration(email, "Completed User");

      const response = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
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

    it("should reject a wrong verification token", async () => {
      const email = "wrong-token@example.com";
      await verifyPendingRegistration(email, "Wrong Token User");

      const response = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
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

    it("should reject an unverified email", async () => {
      const email = "unverified@example.com";
      await createPendingRegistration(email, "Unverified User", "123456");

      const response = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
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

    it("should reject when passwords do not match", async () => {
      const email = "mismatch@example.com";
      const verificationToken = await verifyPendingRegistration(email, "Mismatch User");

      const response = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
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

    it("should reject a short password", async () => {
      const email = "short-password@example.com";
      const verificationToken = await verifyPendingRegistration(email, "Short Password User");

      const response = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
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
    it("should go from name and email through the code to a usable login", async () => {
      const email = "flow@example.com";
      const code = "654321";

      const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
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

      const verifyResponse = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      expect(verifyResponse.status).toBe(200);
      const { verificationToken } = await verifyResponse.json();

      const completeResponse = await fetch(`${BASE_URL}/api/auth/complete-registration`, {
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

      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });

      expect(loginResponse.status).toBe(200);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const user = await createTestUser("login@example.com", "password123", "Login User");
      
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(user.email);
      expect(data.user.name).toBe(user.name);
      expect(response.headers.get("set-cookie")).toContain("session_id");
    });

    it("should reject login with invalid credentials", async () => {
      const user = await createTestUser("login2@example.com", "password123", "Login User 2");
      
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          password: "wrongpassword",
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Invalid credentials");
    });

    it("should reject login with non-existent user", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "password123",
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Invalid credentials");
    });

    it("should reject login with missing fields", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("required");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout authenticated user", async () => {
      const user = await createTestUser("logout@example.com", "password123", "Logout User");
      const sessionId = await loginUser(user);

      const response = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("Logged out successfully");
    });

    it("should handle logout without session", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user for authenticated request", async () => {
      const user = await createTestUser("me@example.com", "password123", "Me User");
      const sessionId = await loginUser(user);

      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(user.email);
      expect(data.user.name).toBe(user.name);
      expect(data.user.freeMessagesUsed).toBeDefined();
    });

    it("should return 401 for unauthenticated request", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Not authenticated");
    });
  });
});