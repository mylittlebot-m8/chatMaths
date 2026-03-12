CREATE TABLE "chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"pages" jsonb[] DEFAULT '{}' NOT NULL,
	"messages" jsonb[] DEFAULT '{}' NOT NULL,
	"context" jsonb DEFAULT '{"agent":[]}' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
