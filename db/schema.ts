import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import type { AutomationCondition, AutomationSchedule } from "../lib/automation-types";

// PRD v2.2 §18. Amounts are exact decimals (numeric(20,6), read as strings).
// No column may ever hold a private key or seed phrase.

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const usdcAmount = (name: string) => numeric(name, { precision: 20, scale: 6 });

export const accountType = pgEnum("account_type", ["INDIVIDUAL", "BUSINESS"]);
export const walletStatus = pgEnum("wallet_status", ["ACTIVE", "DISABLED"]);
export const signerStatus = pgEnum("signer_status", ["NOT_GRANTED", "GRANTED", "REVOKED"]);
export const destinationCategory = pgEnum("destination_category", [
  "SAVINGS",
  "PERSONAL",
  "VENDOR",
  "CONTRACTOR",
  "EMPLOYEE",
  "TREASURY",
  "OTHER"
]);
export const automationStatus = pgEnum("automation_status", ["ACTIVE", "PAUSED", "CANCELLED", "COMPLETED"]);
export const executionStatus = pgEnum("execution_status", [
  "PENDING",
  "SUBMITTED",
  "CONFIRMED",
  "FAILED",
  "SKIPPED",
  "REJECTED",
  "UNKNOWN"
]);
export const executionTrigger = pgEnum("execution_trigger", ["SCHEDULED", "MANUAL"]);
export const confirmationKind = pgEnum("confirmation_kind", ["AUTOMATION", "DESTINATION"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramId: text("telegram_id").unique(),
  telegramChatId: text("telegram_chat_id"),
  privyUserId: text("privy_user_id").unique(),
  timezone: text("timezone").default("UTC").notNull(),
  // Last request awaiting a clarification answer in Telegram (PRD §7.3 "ask, never guess").
  pendingRequest: text("pending_request"),
  pendingRequestExpiresAt: timestamp("pending_request_expires_at", { withTimezone: true }),
  createdAt: createdAt()
});

// One-time tokens that link a Telegram user to a Privy login (PRD §6 step 2).
export const linkTokens = pgTable("link_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt()
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // One account per owner in the MVP; multi-member businesses are future work.
    ownerUserId: uuid("owner_user_id").notNull().unique().references(() => users.id),
    type: accountType("type").notNull(),
    businessName: text("business_name"),
    createdAt: createdAt()
  },
  (table) => [
    check(
      "accounts_business_name_check",
      sql`(${table.type} = 'BUSINESS' AND ${table.businessName} IS NOT NULL) OR (${table.type} = 'INDIVIDUAL' AND ${table.businessName} IS NULL)`
    )
  ]
);

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  // One execution wallet per account in the MVP.
  accountId: uuid("account_id").notNull().unique().references(() => accounts.id),
  privyWalletId: text("privy_wallet_id").notNull().unique(),
  address: text("address").notNull().unique(),
  chainId: integer("chain_id").notNull(),
  status: walletStatus("status").default("ACTIVE").notNull(),
  signerStatus: signerStatus("signer_status").default("NOT_GRANTED").notNull(),
  privyPolicyId: text("privy_policy_id"),
  balanceFloor: usdcAmount("balance_floor"),
  createdAt: createdAt()
}, (table) => [check("wallets_chain_check", sql`${table.chainId} = 10143`)]);

export const destinations = pgTable(
  "destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    label: text("label").notNull(),
    // Lower-cased, whitespace-collapsed label used for lookups.
    labelKey: text("label_key").notNull(),
    address: text("address").notNull(),
    category: destinationCategory("category").default("OTHER").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt()
  },
  (table) => [
    // Archived destinations don't block re-saving the same name or address.
    uniqueIndex("destinations_account_label_idx").on(table.accountId, table.labelKey).where(sql`${table.archivedAt} IS NULL`),
    uniqueIndex("destinations_account_address_idx").on(table.accountId, table.address).where(sql`${table.archivedAt} IS NULL`)
  ]
);

export const confirmations = pgTable("confirmations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: confirmationKind("kind").notNull(),
  intentHash: text("intent_hash").notNull(),
  payload: jsonb("payload").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt()
});

export const automations = pgTable(
  "automations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    walletId: uuid("wallet_id").notNull().references(() => wallets.id),
    destinationId: uuid("destination_id").notNull().references(() => destinations.id),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
    action: text("action").$type<"TRANSFER">().notNull(),
    asset: text("asset").$type<"USDC">().notNull(),
    amount: usdcAmount("amount").notNull(),
    schedule: jsonb("schedule").$type<AutomationSchedule>().notNull(),
    timezone: text("timezone").notNull(),
    conditions: jsonb("conditions").$type<AutomationCondition[]>().notNull(),
    memo: text("memo"),
    status: automationStatus("status").default("ACTIVE").notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    executionCount: integer("execution_count").default(0).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("automations_due_idx").on(table.status, table.nextRunAt),
    check("automations_action_check", sql`${table.action} = 'TRANSFER'`),
    check("automations_asset_check", sql`${table.asset} = 'USDC'`),
    check("automations_amount_check", sql`${table.amount} > 0`),
    check("automations_memo_check", sql`${table.memo} IS NULL OR length(${table.memo}) <= 140`)
  ]
);

export const executions = pgTable(
  "executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    automationId: uuid("automation_id").notNull().references(() => automations.id),
    accountId: uuid("account_id").notNull().references(() => accounts.id),
    executionKey: text("execution_key").notNull(),
    trigger: executionTrigger("trigger").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: executionStatus("status").default("PENDING").notNull(),
    // Snapshots, so history stays accurate if a destination is later archived.
    amount: usdcAmount("amount").notNull(),
    destinationAddress: text("destination_address").notNull(),
    txHash: text("tx_hash"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: createdAt(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("executions_execution_key_idx").on(table.executionKey),
    index("executions_account_created_idx").on(table.accountId, table.createdAt),
    index("executions_status_idx").on(table.status)
  ]
);

export const telegramUpdates = pgTable("telegram_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id),
  userId: uuid("user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  createdAt: createdAt()
});
