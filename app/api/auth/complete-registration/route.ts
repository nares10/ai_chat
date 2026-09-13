import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { normalizeEmail, readRequestBody } from "@/lib/auth-input";
import { hashToken, safeCompare } from "@/lib/verification";

const INVALID_VERIFICATION_ERROR =
	"Email verification is invalid or expired. Start again.";

/**
 * Step 3 of registration: with the email already verified, take the password
 * and create the account. The user is signed in on success.
 */
export async function POST(request: Request) {
	try {
		const body = await readRequestBody(request);

		const email = normalizeEmail(body.email);
		const verificationToken = body.verificationToken;
		const password = body.password;
		const confirmPassword = body.confirmPassword;

		if (!email || !verificationToken || !password) {
			return NextResponse.json(
				{ error: "Email, verification token, and password are required" },
				{ status: 400 }
			);
		}

		if (password.length < 8) {
			return NextResponse.json(
				{ error: "Password must be at least 8 characters" },
				{ status: 400 }
			);
		}

		if (confirmPassword !== undefined && password !== confirmPassword) {
			return NextResponse.json(
				{ error: "Passwords do not match" },
				{ status: 400 }
			);
		}

		const pending = await prisma.pendingRegistration.findUnique({
			where: { email },
		});

		if (
			!pending ||
			!pending.verifiedAt ||
			!pending.verificationTokenHash ||
			pending.expiresAt < new Date() ||
			!safeCompare(hashToken(verificationToken), pending.verificationTokenHash)
		) {
			return NextResponse.json(
				{ error: INVALID_VERIFICATION_ERROR },
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

		const passwordHash = await hashPassword(password);

		const user = await prisma.$transaction(async (tx) => {
			const created = await tx.user.create({
				data: {
					email,
					name: pending.name,
					passwordHash,
					emailVerified: true,
				},
				select: {
					id: true,
					email: true,
					name: true,
					freeMessagesUsed: true,
				},
			});

			await tx.pendingRegistration.delete({ where: { email } });

			return created;
		});

		await createSession(user.id);

		return NextResponse.json({ user }, { status: 201 });
	} catch (error) {
		console.error(error);

		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
