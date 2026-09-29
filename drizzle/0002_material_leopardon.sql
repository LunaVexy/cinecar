CREATE TABLE `admin_attempts` (
	`ip` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_films` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`year` integer NOT NULL,
	`genre` text NOT NULL,
	`wiki` text,
	`poster` text,
	`synopsis` text NOT NULL,
	`trailer` text NOT NULL,
	`emoji` text NOT NULL,
	`tone` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_films` (
	`session_id` text NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`year` integer NOT NULL,
	`genre` text NOT NULL,
	`wiki` text,
	`poster` text,
	`synopsis` text NOT NULL,
	`trailer` text NOT NULL,
	`emoji` text NOT NULL,
	`tone` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_session_films_session_id` ON `session_films` (`session_id`,`id`);--> statement-breakpoint
CREATE TABLE `site_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
