import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  setupTestDatabase,
  createTestUser,
  loginUser,
  cleanupTestDatabase,
  getAuthHeaders,
} from "./setup";

describe("Authentication API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe("test@example.com");
      expect(data.user.name).toBe("Test User");
      expect(data.user.passwordHash).toBeUndefined();
    });

    it("should reject registration with existing email", async () => {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("User already exists");
    });

    it("should reject registration with missing fields", async () => {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test2@example.com",
          password: "password123",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("required");
    });

    it("should reject registration with short password", async () => {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "test3@example.com",
          password: "short",
          name: "Test User",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("8 characters");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const user = await createTestUser("login@example.com", "password123", "Login User");
      
      const response = await fetch("http://localhost:3000/api/auth/login", {
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
      
      const response = await fetch("http://localhost:3000/api/auth/login", {
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
      const response = await fetch("http://localhost:3000/api/auth/login", {
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
      const response = await fetch("http://localhost:3000/api/auth/login", {
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

      const response = await fetch("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(sessionId),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("Logged out successfully");
    });

    it("should handle logout without session", async () => {
      const response = await fetch("http://localhost:3000/api/auth/logout", {
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

      const response = await fetch("http://localhost:3000/api/auth/me", {
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
      const response = await fetch("http://localhost:3000/api/auth/me", {
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