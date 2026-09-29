import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  city: text("city"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  selectedDate: text("selected_date"),
  cancelledAt: text("cancelled_at"),
  driveFileId: text("drive_file_id"),
  driveResourceKey: text("drive_resource_key"),
  createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
  updatedAt: text("updated_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
});

export const votes = sqliteTable(
  "votes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    voterId: text("voter_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    avatar: text("avatar"),
    filmId: text("film_id").notNull(),
    ticketId: text("ticket_id"),
    createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
  },
  (table) => [uniqueIndex("idx_votes_session_voter").on(table.sessionId, table.voterId)],
);

export const siteState = sqliteTable("site_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const catalogFilms = sqliteTable("catalog_films", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  genre: text("genre").notNull(),
  wiki: text("wiki"),
  poster: text("poster"),
  synopsis: text("synopsis").notNull(),
  trailer: text("trailer").notNull(),
  emoji: text("emoji").notNull(),
  tone: text("tone").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const sessionFilms = sqliteTable("session_films", {
  sessionId: text("session_id").notNull(),
  id: text("id").notNull(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  genre: text("genre").notNull(),
  wiki: text("wiki"),
  poster: text("poster"),
  synopsis: text("synopsis").notNull(),
  trailer: text("trailer").notNull(),
  emoji: text("emoji").notNull(),
  tone: text("tone").notNull(),
}, table => [uniqueIndex("idx_session_films_session_id").on(table.sessionId, table.id)]);

export const adminTokens = sqliteTable("admin_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});

export const adminAttempts = sqliteTable("admin_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});
