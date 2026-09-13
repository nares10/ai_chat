const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function readRequestBody(request: Request): Promise<Record<string, string>> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    return await request.json();
  }

  return Object.fromEntries((await request.formData()).entries()) as Record<string, string>;
}

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}
