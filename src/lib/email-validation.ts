/** Practical email syntax check — not a guarantee the mailbox exists. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return EMAIL_PATTERN.test(trimmed);
}

export function emailValidationMessage(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email is required";
  if (!isValidEmail(trimmed)) return "Enter a valid email address (e.g. name@organization.org)";
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
