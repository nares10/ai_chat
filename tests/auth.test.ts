import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createHash } from "node:crypto";
import {
  setupTestDatabase,
  createTestUser,
  loginUser,
  cleanupTestDatabase,
  getAuthHeaders,
} from "./setup";
import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

const BASE_URL = "http://localhost:3010";

describe("Authentication API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should reject registration when passwords do not match", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          confirmPassword: "different123",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Passwords do not match");
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
          password: "password123",
          confirmPassword: "password123",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("User already exists");
    });

    it("should reject registration with missing fields", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test2@example.com",
          password: "password123",
          confirmPassword: "password123",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("required");
    });

    it("should reject registration with short password", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test3@example.com",
          password: "short",
          confirmPassword: "short",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("8 characters");
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("should create a verified user after a valid code", async () => {
      const email = "verified@example.com";
      const code = "123456";
      await prisma.pendingRegistration.create({
        data: {
          email,
          name: "Verified User",
          passwordHash: await hashPassword("password123"),
          codeHash: createHash("sha256").update(code).digest("hex"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user.email).toBe(email);
      expect(data.user.name).toBe("Verified User");

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.emailVerified).toBe(true);
      expect(await prisma.pendingRegistration.findUnique({ where: { email } })).toBeNull();
    });

    it("should reject an invalid verification code", async () => {
      const email = "invalid-code@example.com";
      await prisma.pendingRegistration.create({
        data: {
          email,
          name: "Invalid Code User",
          passwordHash: await hashPassword("password123"),
          codeHash: createHash("sha256").update("123456").digest("hex"),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      const response = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: "000000" }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("invalid or expired");
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