CREATE TABLE `published_vocabulary_terms` (
	`card_id` text NOT NULL,
	`lexeme` text NOT NULL,
	`surface_form` text NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`membership` text NOT NULL,
	`source_slug` text NOT NULL,
	`source_title` text DEFAULT '' NOT NULL,
	`source_theme` text DEFAULT '' NOT NULL,
	`source_image` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`card_id`, `lexeme`)
);
