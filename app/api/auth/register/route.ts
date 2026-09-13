import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canRevealCode, sendVerificationCodeEmail } from "@/lib/email";
import { isValidEmail, normalizeEmail, readRequestBody } from "@/lib/auth-input";
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  generateVerificationCode,
  hashCode,
} from "@/lib/verification";

/**
 * Step 1 of registration: collect name and email, then mail a verification code.
 * The account itself is only created once the code is confirmed and a password
 * is chosen (see /api/auth/verify-email and /api/auth/complete-registration).
 * Calling this again for the same email resends a fresh code.
 */
export async function POST(request: Request) {
	try {
		const body = await readRequestBody(request);

		const email = normalizeEmail(body.email);
		const name = body.name?.trim();

		if (!email || !name) {
			return NextResponse.json(
				{ error: "Name and email are required" },
				{ status: 400 }
			);
		}

		if (name.length < 2) {
			return NextResponse.json(
				{ error: "Name must be at least 2 characters" },
				{ status: 400 }
			);
		}

		if (!isValidEmail(email)) {
			return NextResponse.json(
				{ error: "Enter a valid email address" },
				{ status: 400 }
			);
		}

		const existingUser = await prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});

		if (existingUser) {
			return NextResponse.json(
				{ error: "User already exists" },
				{ status: 409 }
			);
		}

		const pending = await prisma.pendingRegistration.findUnique({
			where: { email },
			select: { lastSentAt: true },
		});

		if (pending) {
			const waitMs = pending.lastSentAt.getTime() + RESEND_COOLDOWN_MS - Date.now();

			if (waitMs > 0) {
				return NextResponse.json(
					{
						error: "A code was just sent. Please wait before requesting another one.",
						retryAfterSeconds: Math.ceil(waitMs / 1000),
					},
					{ status: 429 }
				);
			}
		}

		const code = generateVerificationCode();
		const now = new Date();

		const data = {
			name,
			codeHash: hashCode(code),
			expiresAt: new Date(now.getTime() + CODE_TTL_MS),
			attempts: 0,
			lastSentAt: now,
			verifiedAt: null,
			verificationTokenHash: null,
		};

		await prisma.pendingRegistration.upsert({
			where: { email },
			create: { email, ...data },
			update: data,
		});

		await sendVerificationCodeEmail({ to: email, name, code });

		return NextResponse.json(
			{
				email,
				expiresInSeconds: Math.floor(CODE_TTL_MS / 1000),
				resendAfterSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
				// Only present when email is logged instead of delivered (local dev).
				...(canRevealCode() ? { devCode: code } : {}),
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{ error: "Could not send the verification code. Please try again." },
			{ status: 500 }
		);
	}
}
