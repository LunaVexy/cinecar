CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`city` text,
	`latitude` real,
	`longitude` real,
	`selected_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`name` text NOT NULL,
	`film_id` text NOT NULL,
	`ticket_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_votes_session_voter` ON `votes` (`session_id`,`voter_id`);