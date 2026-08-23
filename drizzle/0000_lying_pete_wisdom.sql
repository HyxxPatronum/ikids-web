CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`series_id` text NOT NULL,
	`course_id` text NOT NULL,
	`topic` text NOT NULL,
	`theme` text NOT NULL,
	`day` integer NOT NULL,
	`level` text NOT NULL,
	`title` text NOT NULL,
	`big_question` text DEFAULT '' NOT NULL,
	`article_structure` text NOT NULL,
	`image` text NOT NULL,
	`content_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cards_slug_unique` ON `cards` (`slug`);--> statement-breakpoint
CREATE TABLE `learning_progress` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`completed_percent` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`)
);
--> statement-breakpoint
CREATE TABLE `recording_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`target_sentence` text NOT NULL,
	`mime` text,
	`size` integer,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
