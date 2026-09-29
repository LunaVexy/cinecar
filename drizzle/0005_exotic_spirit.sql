CREATE TABLE `email_login_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`sent_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`send_count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_login_limits` (
	`ip_hash` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`send_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_login_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_email_login_sessions_expires` ON `email_login_sessions` (`expires_at`);