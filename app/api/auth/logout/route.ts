import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cookieStore = await cookies();

  const sessionId = cookieStore.get("session_id")?.value;

  if (sessionId) {
    await prisma.session.deleteMany({
      where: {
        id: sessionId,
      },
    });
  }

  cookieStore.delete("session_id");

  return NextResponse.json(
    {
      success: true,
      message: "Logged out successfully",
    },
    { status: 200 }
  );
}