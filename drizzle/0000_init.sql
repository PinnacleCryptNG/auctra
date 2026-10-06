CREATE TYPE "public"."account_type" AS ENUM('INDIVIDUAL', 'BUSINESS');--> statement-breakpoint
CREATE TYPE "public"."automation_status" AS ENUM('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."confirmation_kind" AS ENUM('AUTOMATION', 'DESTINATION');--> statement-breakpoint
CREATE TYPE "public"."destination_category" AS ENUM('SAVINGS', 'PERSONAL', 'VENDOR', 'CONTRACTOR', 'EMPLOYEE', 'TREASURY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."execution_status" AS ENUM('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'SKIPPED', 'REJECTED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."execution_trigger" AS ENUM('SCHEDULED', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."signer_status" AS ENUM('NOT_GRANTED', 'GRANTED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."wallet_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"type" "account_type" NOT NULL,
	"business_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_owner_user_id_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "accounts_business_name_check" CHECK (("accounts"."type" = 'BUSINESS' AND "accounts"."business_name" IS NOT NULL) OR ("accounts"."type" = 'INDIVIDUAL' AND "accounts"."business_name" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"asset" text NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"schedule" jsonb NOT NULL,
	"timezone" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"memo" text,
	"status" "automation_status" DEFAULT 'ACTIVE' NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automations_action_check" CHECK ("automations"."action" = 'TRANSFER'),
	CONSTRAINT "automations_asset_check" CHECK ("automations"."asset" = 'USDC'),
	CONSTRAINT "automations_amount_check" CHECK ("automations"."amount" > 0),
	CONSTRAINT "automations_memo_check" CHECK ("automations"."memo" IS NULL OR length("automations"."memo") <= 140)
);
--> statement-breakpoint
CREATE TABLE "confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "confirmation_kind" NOT NULL,
	"intent_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"confirmed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"label" text NOT NULL,
	"label_key" text NOT NULL,
	"address" text NOT NULL,
	"category" "destination_category" DEFAULT 'OTHER' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"execution_key" text NOT NULL,
	"trigger" "execution_trigger" NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "execution_status" DEFAULT 'PENDING' NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"destination_address" text NOT NULL,
	"tx_hash" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "link_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" text,
	"telegram_chat_id" text,
	"privy_user_id" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id"),
	CONSTRAINT "users_privy_user_id_unique" UNIQUE("privy_user_id")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"privy_wallet_id" text NOT NULL,
	"address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"status" "wallet_status" DEFAULT 'ACTIVE' NOT NULL,
	"signer_status" "signer_status" DEFAULT 'NOT_GRANTED' NOT NULL,
	"privy_policy_id" text,
	"balance_floor" numeric(20, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_account_id_unique" UNIQUE("account_id"),
	CONSTRAINT "wallets_privy_wallet_id_unique" UNIQUE("privy_wallet_id"),
	CONSTRAINT "wallets_address_unique" UNIQUE("address"),
	CONSTRAINT "wallets_chain_check" CHECK ("wallets"."chain_id" = 10143)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automations_due_idx" ON "automations" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "destinations_account_label_idx" ON "destinations" USING btree ("account_id","label_key") WHERE "destinations"."archived_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "destinations_account_address_idx" ON "destinations" USING btree ("account_id","address") WHERE "destinations"."archived_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "executions_execution_key_idx" ON "executions" USING btree ("execution_key");--> statement-breakpoint
CREATE INDEX "executions_account_created_idx" ON "executions" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "executions_status_idx" ON "executions" USING btree ("status");