import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION
  );

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();

  cookieStore.set("session_id", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return session;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();

  const sessionId = cookieStore.get("session_id")?.value;

  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });

    return null;
  }

  return session.user;
}
