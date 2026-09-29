import { env } from "cloudflare:workers";

const TICKETS = new Set(["cobertor", "pipoca"]);
const AVATARS: Record<string, string> = { matheus: "Matheus", hugo: "Hugo", andrey: "Andrey" };

function getDb() {
  if (!env.DB) throw new Error("O quadro da sessão está temporariamente indisponível.");
  return env.DB;
}

function cleanId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9-]{3,60}$/.test(value) ? value : "cinecar";
}

async function resolveSession(id: string) {
  if (id !== "cinecar") return id;
  const row = await getDb().prepare("SELECT value FROM site_state WHERE key = 'active_session'").first<{value:string}>();
  return row?.value || null;
}

function errorMessage(error: unknown) {
  const msg = error instanceof Error ? error.message : "Erro inesperado";
  if (msg.includes("no such table")) return "A sessão está sendo preparada. Atualize a página em instantes.";
  return msg;
}

export async function GET(request: Request) {
  try {
    const id = await resolveSession(cleanId(new URL(request.url).searchParams.get("id")));
    if (!id) return Response.json({ started:false, session:null, films:[], votes:[], tally:[], totalVotes:0, finished:false, winner:null }, {headers:{"cache-control":"no-store"}});
    const db = getDb();
    const session = await db.prepare(
      "SELECT id, city, selected_date AS selectedDate, cancelled_at AS cancelledAt, drive_file_id AS driveFileId, drive_resource_key AS driveResourceKey, created_at AS createdAt FROM sessions WHERE id = ?",
    ).bind(id).first();
    if (!session || session.cancelledAt) return Response.json({ started:false, session:null, films:[], votes:[], tally:[], totalVotes:0, finished:false, winner:null }, {headers:{"cache-control":"no-store"}});
    const films = await db.prepare(
      "SELECT id,title,year,genre,wiki,poster,synopsis,trailer,emoji,tone FROM session_films WHERE session_id = ? ORDER BY genre,title",
    ).bind(id).all();
    if (!films.results?.length) return Response.json({ started:false, session:null, films:[], votes:[], tally:[], totalVotes:0, finished:false, winner:null }, {headers:{"cache-control":"no-store"}});
    const votes = await db.prepare(
      "SELECT voter_id AS voterId, name, avatar, film_id AS filmId, ticket_id AS ticketId, created_at AS createdAt FROM votes WHERE session_id = ? ORDER BY created_at ASC, id ASC",
    ).bind(id).all();
    const countRows = await db.prepare(
      "SELECT film_id AS filmId, COUNT(*) AS total, MIN(created_at) AS firstVote FROM votes WHERE session_id = ? GROUP BY film_id ORDER BY total DESC, firstVote ASC",
    ).bind(id).all();
    const cast = (votes.results || []) as Array<{ voterId: string; name: string; filmId: string; ticketId: string | null; createdAt: string }>;
    const tally = (countRows.results || []) as Array<{ filmId: string; total: number; firstVote: string }>;
    return Response.json({
      session,
      started: true,
      films: films.results || [],
      votes: cast,
      tally,
      totalVotes: cast.length,
      finished: cast.length >= 3,
      winner: cast.length >= 3 ? (tally[0]?.filmId ?? null) : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      action?: string; sessionId?: string; city?: string; latitude?: number;
      longitude?: number; date?: string; voterId?: string; name?: string; email?: string; avatar?: string;
      filmId?: string; ticketId?: string;
    };
    const id = await resolveSession(cleanId(payload.sessionId));
    if (!id) return Response.json({error:"A sessão ainda não foi iniciada."},{status:409});
    const db = getDb();
    const sessionState = await db.prepare("SELECT cancelled_at AS cancelledAt FROM sessions WHERE id = ?").bind(id).first<{cancelledAt:string|null}>();
    if (!sessionState || sessionState.cancelledAt) return Response.json({error:"Esta sessão foi cancelada."},{status:409});

    if (payload.action === "set-date") {
      if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
        return Response.json({ error: "Escolha uma data válida." }, { status: 400 });
      }
      const now = new Date();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const max = new Date(today + "T12:00:00Z"); max.setUTCDate(max.getUTCDate() + 15);
      if (payload.date < today || payload.date > max.toISOString().slice(0,10)) {
        return Response.json({ error: "Escolha um dia dentro dos próximos 16 dias de previsão." }, { status: 400 });
      }
      const existing = await db.prepare("SELECT selected_date AS selectedDate FROM sessions WHERE id = ?").bind(id).first<{ selectedDate: string | null }>();
      if (existing?.selectedDate) return Response.json({ error: "A data desta sessão já foi escolhida." }, { status: 409 });
      await db.prepare(
        "UPDATE sessions SET city = ?, latitude = ?, longitude = ?, selected_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND selected_date IS NULL",
      ).bind(
        (payload.city || "").slice(0, 100),
        Number.isFinite(payload.latitude) ? payload.latitude : null,
        Number.isFinite(payload.longitude) ? payload.longitude : null,
        payload.date, id,
      ).run();
      return Response.json({ ok: true });
    }

    if (typeof payload.voterId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(payload.voterId)) {
      return Response.json({ error: "Atualize a página para iniciar sua participação." }, { status: 400 });
    }

    if (payload.action === "vote") {
      const email = (payload.email || "").trim().toLowerCase().slice(0, 254);
      const avatar = payload.avatar || "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Digite um e-mail válido." }, { status: 400 });
      if (!AVATARS[avatar]) return Response.json({ error: "Escolha seu personagem." }, { status: 400 });
      const name = AVATARS[avatar];
      const chosen = await db.prepare("SELECT id FROM session_films WHERE session_id = ? AND id = ?").bind(id,payload.filmId||"").first();
      if (!chosen) return Response.json({ error: "Escolha um dos filmes em cartaz." }, { status: 400 });
      const session = await db.prepare("SELECT selected_date AS selectedDate FROM sessions WHERE id = ?").bind(id).first<{ selectedDate: string | null }>();
      if (!session?.selectedDate) return Response.json({ error: "A data da sessão ainda não foi escolhida." }, { status: 409 });
      const claimed = await db.prepare("SELECT voter_id AS voterId FROM votes WHERE session_id = ? AND (email = ? OR avatar = ?) AND voter_id != ? LIMIT 1").bind(id,email,avatar,payload.voterId).first();
      if (claimed) return Response.json({ error: "Este e-mail ou personagem já votou nesta sessão." }, { status: 409 });
      await db.prepare(
        "INSERT INTO votes (session_id, voter_id, name, email, avatar, film_id) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM votes WHERE session_id = ?) < 3 ON CONFLICT(session_id, voter_id) DO UPDATE SET name = excluded.name, email = excluded.email, avatar = excluded.avatar, film_id = excluded.film_id WHERE (SELECT COUNT(*) FROM votes WHERE session_id = ?) < 3",
      ).bind(id, payload.voterId, name, email, avatar, payload.filmId, id, id).run();
      const total = await db.prepare("SELECT COUNT(*) AS total FROM votes WHERE session_id = ?").bind(id).first<{ total: number }>();
      return Response.json({ ok: true, totalVotes: total?.total ?? 0, finished: (total?.total ?? 0) >= 3 });
    }

    if (payload.action === "ticket") {
      if (!payload.ticketId || !TICKETS.has(payload.ticketId)) return Response.json({ error: "Escolha um ingresso." }, { status: 400 });
      await db.prepare("UPDATE votes SET ticket_id = ? WHERE session_id = ? AND voter_id = ?")
        .bind(payload.ticketId, id, payload.voterId).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 503 });
  }
}
