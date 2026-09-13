import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";

export const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3010";

function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname : "";

  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      "Refusing to clean the database. DATABASE_URL must point to a database containing 'test'.",
    );
  }
}

export async function resetTestDatabase() {
  assertTestDatabase();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestUser(email: string, name = "Test User") {
  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword("password123"),
      emailVerified: true,
    },
  });
}

export async function createSession(userId: string, expiresAt?: Date) {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return session.id;
}

export async function createExpiredSession(userId: string) {
  return createSession(userId, new Date(Date.now() - 60 * 60 * 1000));
}

export function authHeaders(sessionId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Cookie: `session_id=${sessionId}`,
  };
}

export async function createAuthedUser(email: string, name = "Test User") {
  const user = await createTestUser(email, name);
  const sessionId = await createSession(user.id);

  return { user, sessionId, headers: authHeaders(sessionId) };
}

export async function createTestConversation(
  userId: string,
  overrides: { title?: string; provider?: string; model?: string } = {},
) {
  return prisma.conversation.create({
    data: {
      userId,
      title: overrides.title ?? "Test conversation",
      provider: overrides.provider ?? "openai",
      model: overrides.model,
    },
  });
}

export async function createTestMessage(
  conversationId: string,
  overrides: { role?: string; content?: string } = {},
) {
  return prisma.message.create({
    data: {
      conversationId,
      role: overrides.role ?? "user",
      content: overrides.content ?? "Test message",
    },
  });
}

export async function createTestApiKey(
  userId: string,
  overrides: { key?: string; name?: string; provider?: string } = {},
) {
  return prisma.apiKey.create({
    data: {
      userId,
      key: overrides.key ?? `test-key-${crypto.randomUUID()}`,
      name: overrides.name ?? "Test key",
      provider: overrides.provider ?? "openai",
    },
  });
}

export async function setFreeMessagesUsed(userId: string, count: number) {
  return prisma.user.update({
    where: { id: userId },
    data: { freeMessagesUsed: count },
  });
}
