import {
  pgTable,
  text,
  timestamp,
  integer,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  authReference: text("auth_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const wallets = pgTable("wallets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  privyWalletId: text("privy_wallet_id").notNull(),
  address: text("address").notNull(),
  chainId: integer("chain_id").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const automations = pgTable("automations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  walletId: text("wallet_id").notNull().references(() => wallets.id),
  action: text("action").notNull(),
  asset: text("asset").notNull(),
  destination: text("destination").notNull(),
  amount: text("amount").notNull(),
  schedule: text("schedule").notNull(),
  conditions: text("conditions").notNull(),
  status: text("status").notNull(),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  executionCount: integer("execution_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const executions = pgTable("executions", {
  id: text("id").primaryKey(),
  automationId: text("automation_id").notNull().references(() => automations.id),
  executionKey: text("execution_key").notNull(),
  status: text("status").notNull(),
  txHash: text("tx_hash"),
  errorCode: text("error_code"),
  executedAt: timestamp("executed_at").defaultNow().notNull()
}, (table) => ({
  executionKeyIdx: uniqueIndex("executions_execution_key_idx").on(table.executionKey)
}));

export const confirmations = pgTable("confirmations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  intentHash: text("intent_hash").notNull(),
  payload: text("payload").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  expiresAt: timestamp("expires_at").notNull()
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  eventType: text("event_type").notNull(),
  metadata: text("metadata").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
