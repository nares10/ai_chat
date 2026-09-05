import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ apiKeys }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { key, name, provider } = body;

    if (!key || !name || !provider) {
      return NextResponse.json(
        { error: "Key, name, and provider are required" },
        { status: 400 }
      );
    }

    // Check if key already exists
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        key,
      },
    });

    if (existingKey) {
      return NextResponse.json(
        { error: "API key already exists" },
        { status: 409 }
      );
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        key,
        name,
        provider,
      },
    });

    return NextResponse.json({ apiKey }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}