import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim();

    if (!email || !password || !name) {
      return NextResponse.json(
        {
          error: "Email, password, and name are required",
        },
        { status: 400 }
      );
    }
    if (name.length < 2) {
      return NextResponse.json(
        {
          error: "Name must be at least 2 characters",
        },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Password must be at least 8 characters",
        },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "User already exists",
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return NextResponse.json(
      {
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Something went wrong",
      },
      { status: 500 }
    );
  }
}