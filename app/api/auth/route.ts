import { env } from "cloudflare:workers";
import { expiredSessionCookie, getSessionToken, getVoterIdentity, normalizeEmail, randomCode, randomHex, sessionCookie, sessionExpiry, sha256, voterIdFor } from "@/lib/email-auth";

const noStore = { "cache-control": "no-store" };
const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function GET(request: Request) {
  const identity = await getVoterIdentity(request);
  return identity ? Response.json(identity, { headers: noStore }) : Response.json({ error: "Faça a verificação do e-mail." }, { status: 401, headers: noStore });
}

export async function POST(request: Request) {
  const db = env.DB;
  if (!db) return Response.json({ error: "O login está indisponível agora." }, { status: 503 });
  let payload: { action?: string; email?: string; code?: string };
  try { payload = await request.json(); } catch { return Response.json({ error: "Pedido inválido." }, { status: 400 }); }

  if (payload.action === "logout") {
    const token = getSessionToken(request);
    if (token) await db.prepare("DELETE FROM email_login_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return Response.json({ ok: true }, { headers: { ...noStore, "set-cookie": expiredSessionCookie(request) } });
  }

  const email = normalizeEmail(payload.email);
  if (!email) return Response.json({ error: "Digite um e-mail válido." }, { status: 400 });

  if (payload.action === "send") {
    if (!env.EMAILJS_SERVICE_ID || !env.EMAILJS_TEMPLATE_ID || !env.EMAILJS_PUBLIC_KEY || !env.EMAILJS_PRIVATE_KEY) {
      return Response.json({ error: "A verificação por e-mail ainda está sendo configurada." }, { status: 503 });
    }
    const now = nowSeconds();
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const ipHash = await sha256(ip);
    const limit = await db.prepare(
      "INSERT INTO email_login_limits (ip_hash, window_start, send_count) VALUES (?, ?, 1) ON CONFLICT(ip_hash) DO UPDATE SET window_start = CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END, send_count = CASE WHEN window_start <= ? THEN 1 ELSE send_count + 1 END RETURNING send_count AS sendCount",
    ).bind(ipHash, now, now - 3600, now - 3600).first<{sendCount: number}>();
    if ((limit?.sendCount ?? 99) > 12) return Response.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });

    const code = randomCode();
    const salt = randomHex(16);
    const codeHash = await sha256(salt + ":" + code);
    const claimed = await db.prepare(
      "INSERT INTO email_login_codes (email, salt, code_hash, expires_at, sent_at, attempts, window_start, send_count) VALUES (?, ?, ?, ?, ?, 0, ?, 1) ON CONFLICT(email) DO UPDATE SET salt=excluded.salt, code_hash=excluded.code_hash, expires_at=excluded.expires_at, sent_at=excluded.sent_at, attempts=0, window_start=CASE WHEN window_start <= ? THEN excluded.window_start ELSE window_start END, send_count=CASE WHEN window_start <= ? THEN 1 ELSE send_count + 1 END WHERE sent_at <= ? AND (window_start <= ? OR send_count < 8)",
    ).bind(email, salt, codeHash, now + 600, now, now, now - 3600, now - 3600, now - 60, now - 3600).run();
    if (!claimed.meta.changes) return Response.json({ error: "Aguarde um minuto antes de pedir outro código." }, { status: 429 });

    try {
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          service_id: env.EMAILJS_SERVICE_ID,
          template_id: env.EMAILJS_TEMPLATE_ID,
          user_id: env.EMAILJS_PUBLIC_KEY,
          accessToken: env.EMAILJS_PRIVATE_KEY,
          template_params: { to_email: email, code, expires_minutes: "10" },
        }),
      });
      if (!response.ok) throw new Error(`EmailJS ${response.status}`);
      return Response.json({ ok: true }, { headers: noStore });
    } catch (error) {
      console.error("Falha no envio do código:", error);
      await db.prepare("DELETE FROM email_login_codes WHERE email = ? AND code_hash = ?").bind(email, codeHash).run();
      return Response.json({ error: "Não consegui enviar o código agora. Tente novamente." }, { status: 503 });
    }
  }

  if (payload.action === "verify") {
    const code = typeof payload.code === "string" ? payload.code.trim() : "";
    if (!/^\d{6}$/.test(code)) return Response.json({ error: "Digite os seis números do código." }, { status: 400 });
    const row = await db.prepare("SELECT salt, code_hash AS codeHash, expires_at AS expiresAt, attempts FROM email_login_codes WHERE email = ?")
      .bind(email).first<{ salt: string; codeHash: string; expiresAt: number; attempts: number }>();
    if (!row || row.expiresAt <= nowSeconds() || row.attempts >= 5) {
      return Response.json({ error: "Código expirado. Peça um novo código." }, { status: 401 });
    }
    const attempt = await db.prepare("UPDATE email_login_codes SET attempts = attempts + 1 WHERE email = ? AND code_hash = ? AND attempts < 5 AND expires_at > ?")
      .bind(email, row.codeHash, nowSeconds()).run();
    if (!attempt.meta.changes) return Response.json({ error: "Código expirado. Peça um novo código." }, { status: 401 });
    if (await sha256(row.salt + ":" + code) !== row.codeHash) return Response.json({ error: "Código incorreto. Confira o e-mail e tente novamente." }, { status: 401 });
    const consumed = await db.prepare("DELETE FROM email_login_codes WHERE email = ? AND code_hash = ?").bind(email, row.codeHash).run();
    if (!consumed.meta.changes) return Response.json({ error: "Este código já foi usado. Peça outro." }, { status: 401 });
    const token = randomHex(32);
    await db.prepare("INSERT INTO email_login_sessions (token_hash, email, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256(token), email, sessionExpiry()).run();
    return Response.json({ email, voterId: await voterIdFor(email) }, { headers: { ...noStore, "set-cookie": sessionCookie(request, token) } });
  }

  return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
}
