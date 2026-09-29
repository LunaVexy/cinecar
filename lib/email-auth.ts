import { env } from "cloudflare:workers";

const COOKIE = "cinecar_email_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;

export type VoterIdentity = { email: string; voterId: string };

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function randomHex(bytes: number) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function randomCode() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(value % 1_000_000).padStart(6, "0");
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function voterIdFor(email: string) {
  return "email-" + (await sha256(email)).slice(0, 40);
}

export async function getVoterIdentity(request: Request): Promise<VoterIdentity | null> {
  const token = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !env.DB) return null;
  const row = await env.DB.prepare("SELECT email FROM email_login_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(await sha256(token), Math.floor(Date.now() / 1000)).first<{email: string}>();
  if (!row?.email) return null;
  return { email: row.email, voterId: await voterIdFor(row.email) };
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export const sessionExpiry = () => Math.floor(Date.now() / 1000) + SESSION_SECONDS;

export function getSessionToken(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
