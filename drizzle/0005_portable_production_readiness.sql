CREATE TABLE IF NOT EXISTS `dictionary_cache` (
	`word` text PRIMARY KEY NOT NULL,
	`payload_json` text,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dictionary_cache_expiry` ON `dictionary_cache` (`expires_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `infrastructure_state` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `published_vocabulary_terms_staging` (
	`card_id` text NOT NULL,
	`lexeme` text NOT NULL,
	`surface_form` text NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`media_json` text DEFAULT '{}' NOT NULL,
	`membership` text NOT NULL,
	`source_slug` text NOT NULL,
	`source_title` text DEFAULT '' NOT NULL,
	`source_theme` text DEFAULT '' NOT NULL,
	`source_image` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`card_id`, `lexeme`)
);
