import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

const TEST_BASE_URL = "http://localhost:3010";

function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname : "";

  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Refusing to clean the database because DATABASE_URL does not point to a test database. Use a database name containing 'test'.",
    );
  }
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  sessionId?: string;
}

export async function setupTestDatabase() {
  assertTestDatabase();

  // Clean up test data
  await prisma.pendingRegistration.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestUser(email: string, password: string, name: string): Promise<TestUser> {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      freeMessagesUsed: 0,
    },
  });

  return {
    id: user.id,
    email: user.email,
    password,
    name: user.name || "",
  };
}

export async function loginUser(user: TestUser): Promise<string> {
  const response = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }

  // Extract session ID from Set-Cookie header
  const setCookieHeader = response.headers.get("set-cookie");
  const sessionIdMatch = setCookieHeader?.match(/session_id=([^;]+)/);
  const sessionId = sessionIdMatch?.[1];

  if (sessionId) {
    user.sessionId = sessionId;
  }

  return sessionId || "";
}

export async function createApiKey(userId: string, key: string, name: string, provider: string) {
  return await prisma.apiKey.create({
    data: {
      userId,
      key,
      name,
      provider,
    },
  });
}

export async function cleanupTestDatabase() {
  assertTestDatabase();

  await prisma.pendingRegistration.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

export function getAuthHeaders(sessionId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Cookie": `session_id=${sessionId}`,
  };
}