ALTER TABLE "users" ADD COLUMN "pending_request" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pending_request_expires_at" timestamp with time zone;