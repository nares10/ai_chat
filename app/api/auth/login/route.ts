import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    // Find User
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid credentials",
        },
        { status: 401 }
      );
    }

    // Verify Argon2 password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        {
          error: "Invalid credentials",
        },
        { status: 401 }
      );
    }

    // Create Session
    await createSession(user.id);

    // Authenticated - return user data
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          freeMessagesUsed: user.freeMessagesUsed,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Something went wrong In Login Route",
      },
      { status: 500 }
    );
  }
}