CREATE TABLE `imports` (
	`owner` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `digest`)
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`owner` text PRIMARY KEY NOT NULL,
	`budget_cents` integer DEFAULT 12000000 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `records` (
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `kind`, `id`)
);
