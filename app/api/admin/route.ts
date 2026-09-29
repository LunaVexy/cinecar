import { env } from "cloudflare:workers";
import { starterFilms, genres } from "@/lib/films";

const COOKIE = "cinecar_admin";
const duration = 7 * 24 * 60 * 60;
const db = () => { if (!env.DB) throw new Error("Banco indisponível"); return env.DB; };
const now = () => Math.floor(Date.now() / 1000);
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");
const cookie = (request: Request) => request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";

async function authorized(request: Request) {
  const token = cookie(request);
  if (!/^[a-f0-9-]{72}$/.test(token)) return false;
  const row = await db().prepare("SELECT expires_at AS expiresAt FROM admin_tokens WHERE token_hash = ?").bind(await hash(token)).first<{ expiresAt: number }>();
  return Boolean(row && row.expiresAt > now());
}
async function seed() {
  const state = await db().prepare("SELECT value FROM site_state WHERE key = 'catalog_seeded'").first();
  if (state) return;
  const statements = starterFilms.map((f, i) => db().prepare("INSERT OR IGNORE INTO catalog_films (id,title,year,genre,wiki,poster,synopsis,trailer,emoji,tone,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(f.id,f.title,f.year,f.genre,f.wiki,null,f.synopsis,f.trailer,f.emoji,f.tone,i));
  statements.push(db().prepare("INSERT OR REPLACE INTO site_state (key,value) VALUES ('catalog_seeded','1')"));
  await db().batch(statements);
}
const filmRows = () => db().prepare("SELECT id,title,year,genre,wiki,poster,synopsis,trailer,emoji,tone,sort_order AS sortOrder FROM catalog_films ORDER BY sort_order, title").all();

export async function GET(request: Request) {
  try {
    if (!await authorized(request)) return fail("Acesse o painel com a senha.", 401);
    await seed();
    const films = await filmRows();
    const active = await db().prepare("SELECT value FROM site_state WHERE key = 'active_session'").first<{value:string}>();
    const activeSession = active?.value || null;
    const count = activeSession ? await db().prepare("SELECT COUNT(*) AS total FROM votes WHERE session_id = ?").bind(activeSession).first<{total:number}>() : null;
    const video = activeSession ? await db().prepare("SELECT drive_file_id AS fileId, drive_resource_key AS resourceKey FROM sessions WHERE id = ?").bind(activeSession).first<{fileId:string|null;resourceKey:string|null}>() : null;
    const driveUrl = video?.fileId ? "https://drive.google.com/file/d/" + video.fileId + "/view" + (video.resourceKey ? "?resourcekey=" + encodeURIComponent(video.resourceKey) : "") : null;
    return Response.json({ films: films.results || [], activeSession, totalVotes: count?.total || 0, finished: (count?.total || 0) >= 3, driveUrl }, { headers: { "cache-control": "no-store" } });
  } catch { return fail("O painel não está disponível agora.", 503); }
}

export async function POST(request: Request) {
  try {
    const data = await request.json() as Record<string, unknown>;
    const action = data.action;
    if (action === "login") {
      const ip = (request.headers.get("cf-connecting-ip") || "unknown").slice(0, 80);
      const current = await db().prepare("SELECT count,reset_at AS resetAt FROM admin_attempts WHERE ip = ?").bind(ip).first<{count:number;resetAt:number}>();
      if (current && current.resetAt > now() && current.count >= 5) return fail("Muitas tentativas. Tente novamente em 15 minutos.", 429);
      const pin = (env as unknown as {CINECAR_ADMIN_PIN?:string}).CINECAR_ADMIN_PIN;
      if (!pin) return fail("A senha do painel ainda não foi configurada.", 503);
      const supplied = String(data.pin || "");
      if (supplied.length !== pin.length || await hash(supplied) !== await hash(pin)) {
        await db().prepare("INSERT INTO admin_attempts (ip,count,reset_at) VALUES (?,?,?) ON CONFLICT(ip) DO UPDATE SET count = CASE WHEN reset_at < ? THEN 1 ELSE count + 1 END, reset_at = CASE WHEN reset_at < ? THEN ? ELSE reset_at END").bind(ip,1,now()+900,now(),now(),now()+900).run();
        return fail("Senha incorreta.", 401);
      }
      await db().prepare("DELETE FROM admin_attempts WHERE ip = ?").bind(ip).run();
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db().prepare("INSERT INTO admin_tokens (token_hash,expires_at) VALUES (?,?)").bind(await hash(token),now()+duration).run();
      return Response.json({ ok:true }, { headers: { "set-cookie": `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/api/admin; Max-Age=${duration}`, "cache-control":"no-store" } });
    }
    if (!await authorized(request)) return fail("Sua sessão do painel expirou. Entre novamente.", 401);
    if (action === "logout") {
      await db().prepare("DELETE FROM admin_tokens WHERE token_hash = ?").bind(await hash(cookie(request))).run();
      return Response.json({ok:true}, {headers:{"set-cookie":`${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/admin; Max-Age=0`}});
    }
    await seed();
    if (action === "save-film") {
      const raw = data.film as Record<string,unknown> | undefined;
      if (!raw) return fail("Preencha o filme.");
      const id = typeof raw.id === "string" && /^[a-zA-Z0-9-]{3,60}$/.test(raw.id) ? raw.id : "film-" + crypto.randomUUID().slice(0,12);
      const title = String(raw.title || "").trim().slice(0,100);
      const synopsis = String(raw.synopsis || "").trim().slice(0,1200);
      const genre = String(raw.genre || "");
      const trailer = String(raw.trailer || "").trim().slice(0,400);
      const poster = String(raw.poster || "").trim().slice(0,500);
      const year = Number(raw.year) || new Date().getFullYear();
      if (title.length < 2 || synopsis.length < 20 || !genres.includes(genre) || year < 1900 || year > 2100) return fail("Confira nome, categoria, ano e sinopse (mínimo de 20 caracteres).");
      try { const u = new URL(trailer); if (u.protocol !== "https:" || !["youtube.com","www.youtube.com","youtu.be","m.youtube.com"].includes(u.hostname)) throw 0; } catch { return fail("Use um link HTTPS do YouTube para o trailer."); }
      if (poster) { try { const u = new URL(poster); if (u.protocol !== "https:" || u.hostname !== "i.imgur.com" || !/\.(png|jpe?g|webp)(\?.*)?$/i.test(u.pathname)) throw 0; } catch { return fail("Use o link direto da imagem no Imgur (i.imgur.com/...jpg ou .png)."); } }
      const old = await db().prepare("SELECT id,wiki,emoji,tone,sort_order AS sortOrder FROM catalog_films WHERE id = ?").bind(id).first<{id:string;wiki:string|null;emoji:string;tone:string;sortOrder:number}>();
      const next = await db().prepare("SELECT COALESCE(MAX(sort_order),0)+1 AS value FROM catalog_films").first<{value:number}>();
      const looks:Record<string,{emoji:string;tone:string}> = {"Terror":{emoji:"🌙",tone:"plum"},"Ação":{emoji:"⚡",tone:"orange"},"Comédia":{emoji:"🎭",tone:"pink"},"Ficção":{emoji:"🪐",tone:"cyan"},"Animação":{emoji:"✨",tone:"violet"}};
      await db().prepare("INSERT INTO catalog_films (id,title,year,genre,wiki,poster,synopsis,trailer,emoji,tone,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,year=excluded.year,genre=excluded.genre,poster=excluded.poster,synopsis=excluded.synopsis,trailer=excluded.trailer,emoji=excluded.emoji,tone=excluded.tone").bind(id,title,year,genre,old?.wiki||null,poster||null,synopsis,trailer,old?.emoji||looks[genre].emoji,looks[genre].tone,old?.sortOrder??next?.value??0).run();
      return Response.json({ok:true,id});
    }
    if (action === "delete-film") {
      const id = String(data.id || "");
      await db().prepare("DELETE FROM catalog_films WHERE id = ?").bind(id).run();
      return Response.json({ok:true});
    }
    if (action === "cancel") {
      const active = await db().prepare("SELECT value FROM site_state WHERE key = 'active_session'").first<{value:string}>();
      if (!active || active.value !== data.sessionId) return fail("Esta sessão já não está ativa.",409);
      await db().batch([
        db().prepare("UPDATE sessions SET cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(active.value),
        db().prepare("DELETE FROM site_state WHERE key = 'active_session' AND value = ?").bind(active.value),
      ]);
      return Response.json({ok:true});
    }
    if (action === "set-drive") {
      const active = await db().prepare("SELECT value FROM site_state WHERE key = 'active_session'").first<{value:string}>();
      if (!active || active.value !== data.sessionId) return fail("Esta sessão já não está ativa.",409);
      const count = await db().prepare("SELECT COUNT(*) AS total FROM votes WHERE session_id = ?").bind(active.value).first<{total:number}>();
      if ((count?.total || 0) < 3) return fail("Espere os três votos antes de adicionar o filme.",409);
      let fileId:string|null=null,resourceKey:string|null=null;
      if (data.driveUrl) {
        try {
          const url = new URL(String(data.driveUrl));
          if (url.protocol !== "https:" || !["drive.google.com","www.drive.google.com"].includes(url.hostname)) throw 0;
          const match = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]{10,200})(?:\/|$)/);
          fileId = match?.[1] || (url.pathname === "/open" ? url.searchParams.get("id") : null);
          if (!fileId || !/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) throw 0;
          resourceKey = url.searchParams.get("resourcekey");
          if (resourceKey && !/^[a-zA-Z0-9_-]{5,200}$/.test(resourceKey)) throw 0;
        } catch { return fail("Cole o link de um arquivo do Google Drive, como drive.google.com/file/d/.../view."); }
      }
      await db().prepare("UPDATE sessions SET drive_file_id = ?, drive_resource_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND cancelled_at IS NULL").bind(fileId,resourceKey,active.value).run();
      return Response.json({ok:true});
    }
    if (action === "start") {
      const ids = Array.isArray(data.filmIds) ? [...new Set(data.filmIds.filter(x => typeof x === "string"))] as string[] : [];
      if (ids.length < 2 || ids.length > 30) return fail("Selecione de 2 a 30 filmes para a sessão.");
      const rows = await filmRows();
      const available = new Set((rows.results || []).map(x => x.id));
      if (ids.some(id => !available.has(id))) return fail("Um dos filmes selecionados não está no catálogo.");
      const id = "cc-" + crypto.randomUUID().replaceAll("-","").slice(0,20);
      const ops = [db().prepare("INSERT INTO sessions (id) VALUES (?)").bind(id),...ids.map(f => db().prepare("INSERT INTO session_films (session_id,id,title,year,genre,wiki,poster,synopsis,trailer,emoji,tone) SELECT ?,id,title,year,genre,wiki,poster,synopsis,trailer,emoji,tone FROM catalog_films WHERE id = ?").bind(id,f)),db().prepare("INSERT INTO site_state (key,value) VALUES ('active_session',?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(id)];
      await db().batch(ops);
      return Response.json({ok:true,sessionId:id});
    }
    return fail("Ação não reconhecida.");
  } catch { return fail("Não foi possível salvar a alteração. Tente novamente.",503); }
}
