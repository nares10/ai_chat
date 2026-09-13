import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail, normalizeEmail, readRequestBody } from "@/lib/auth-input";
import {
	MAX_CODE_ATTEMPTS,
	VERIFIED_TOKEN_TTL_MS,
	generateVerificationToken,
	hashCode,
	hashToken,
	isValidCodeFormat,
	safeCompare,
} from "@/lib/verification";

const INVALID_CODE_ERROR = "That code is invalid or expired";

/**
 * Step 2 of registration: confirm the emailed code. On success the pending
 * registration is marked verified and a short-lived token is handed back, which
 * /api/auth/complete-registration requires to set the password.
 */
export async function POST(request: Request) {
	try {
		const body = await readRequestBody(request);

		const email = normalizeEmail(body.email);
		const code = typeof body.code === "string" ? body.code.trim() : "";

		if (!email || !code) {
			return NextResponse.json(
				{ error: "Email and code are required" },
				{ status: 400 }
			);
		}

		if (!isValidEmail(email) || !isValidCodeFormat(code)) {
			return NextResponse.json({ error: INVALID_CODE_ERROR }, { status: 400 });
		}

		const pending = await prisma.pendingRegistration.findUnique({
			where: { email },
		});

		if (!pending || pending.expiresAt < new Date()) {
			return NextResponse.json({ error: INVALID_CODE_ERROR }, { status: 400 });
		}

		if (pending.attempts >= MAX_CODE_ATTEMPTS) {
			return NextResponse.json(
				{ error: "Too many incorrect attempts. Request a new code." },
				{ status: 429 }
			);
		}

		if (!safeCompare(hashCode(code), pending.codeHash)) {
			await prisma.pendingRegistration.update({
				where: { email },
				data: { attempts: { increment: 1 } },
			});

			return NextResponse.json({ error: INVALID_CODE_ERROR }, { status: 400 });
		}

		const verificationToken = generateVerificationToken();

		await prisma.pendingRegistration.update({
			where: { email },
			data: {
				attempts: 0,
				verifiedAt: new Date(),
				verificationTokenHash: hashToken(verificationToken),
				expiresAt: new Date(Date.now() + VERIFIED_TOKEN_TTL_MS),
			},
		});

		return NextResponse.json(
			{
				email,
				name: pending.name,
				verificationToken,
				expiresInSeconds: Math.floor(VERIFIED_TOKEN_TTL_MS / 1000),
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
