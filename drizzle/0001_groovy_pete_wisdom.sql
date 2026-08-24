CREATE TABLE `dictionary_entries` (
	`word` text PRIMARY KEY NOT NULL,
	`phonetic` text DEFAULT '' NOT NULL,
	`translation` text NOT NULL,
	`definition` text DEFAULT '' NOT NULL,
	`pos` text DEFAULT '' NOT NULL,
	`exchange` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'ECDICT' NOT NULL,
	`updated_at` text NOT NULL
);
