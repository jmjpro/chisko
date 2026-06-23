export const SESSION_TOKEN_STORAGE_KEY = "ec2-session-token";

// Shared across the wizard and standalone plans page, so both resolve to
// the same underlying session — a session is not limited to one surface.
export function getOrCreateSessionToken(): string {
  const existing = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  if (existing) return existing;
  const token = generateSessionToken();
  localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  return token;
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
