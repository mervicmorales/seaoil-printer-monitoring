import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- CORE LOOKUPS USED BY USER PROFILES ----------
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- USERS & ACCESS ----------
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("support"), // 'super_admin' | 'admin' | 'support' | 'employee'
  employeeId: text("employee_id").unique(),
  primaryLocationId: integer("primary_location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  accountStatus: text("account_status").notNull().default("active"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userModuleAccess = pgTable(
  "user_module_access",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(), // See MODULES in src/lib/permissions.ts.
    fullAccess: boolean("full_access").notNull().default(false),
  },
  (t) => [uniqueIndex("user_module_unique").on(t.userId, t.module)],
);

export const manualUserVerificationTokens = pgTable(
  "manual_user_verification_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("manual_user_verification_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_user_idx").on(t.userId)],
);

// ---------- LOOKUP DATABASES ----------
export const itsNames = pgTable("its_names", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  mobile: text("mobile"),
  accountManager: text("account_manager"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tonerTypes = pgTable("toner_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  showAlertCard: boolean("show_alert_card").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tonerInventory = pgTable("toner_inventory", {
  id: serial("id").primaryKey(),
  tonerTypeId: integer("toner_type_id")
    .notNull()
    .unique()
    .references(() => tonerTypes.id, { onDelete: "cascade" }),
  stock: integer("stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  criticalStockThreshold: integer("critical_stock_threshold").notNull().default(2),
  alertState: text("alert_state").notNull().default("normal"),
});

// ---------- CONTRACTS ----------
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  contractNumber: text("contract_number").notNull().unique(),
  vendorId: integer("vendor_id").references(() => vendors.id, {
    onDelete: "set null",
  }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  documentUrl: text("document_url"),
  documentName: text("document_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- PRINTERS ----------
export const printers = pgTable("printers", {
  id: serial("id").primaryKey(),
  assetTag: text("asset_tag"),
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),
  serialNumber: text("serial_number").notNull().unique(),
  model: text("model"),
  monthlyRate: numeric("monthly_rate", { precision: 12, scale: 2 }).default(
    "0",
  ),
  locationId: integer("location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  vendorId: integer("vendor_id").references(() => vendors.id, {
    onDelete: "set null",
  }),
  contractId: integer("contract_id").references(() => contracts.id, {
    onDelete: "set null",
  }),
  assignedUser: text("assigned_user"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const printerTonerTypes = pgTable(
  "printer_toner_types",
  {
    id: serial("id").primaryKey(),
    printerId: integer("printer_id")
      .notNull()
      .references(() => printers.id, { onDelete: "cascade" }),
    tonerTypeId: integer("toner_type_id")
      .notNull()
      .references(() => tonerTypes.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("printer_toner_unique").on(t.printerId, t.tonerTypeId)],
);

// ---------- LIVE PRINTER MONITORING ----------
// An agent key is stable, non-secret identity metadata. Authentication uses
// the bcrypt token hash; plaintext API tokens are never stored.
export const monitoringAgents = pgTable(
  "monitoring_agents",
  {
    id: serial("id").primaryKey(),
    agentKey: text("agent_key").notNull().unique(),
    name: text("name").notNull(),
    locationId: integer("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    hostname: text("hostname"),
    version: text("version"),
    status: text("status").notNull().default("inactive"),
    tokenHash: text("token_hash"),
    tokenCreatedAt: timestamp("token_created_at", { withTimezone: true }),
    tokenRevokedAt: timestamp("token_revoked_at", { withTimezone: true }),
    lastSeen: timestamp("last_seen", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("monitoring_agents_location_idx").on(t.locationId)],
);

// A row enables monitoring for exactly one printer and assigns it to exactly
// one authenticated agent. Removing the row disables future polling while
// preserving the printer's historical readings and alerts.
export const printerMonitoringAssignments = pgTable(
  "printer_monitoring_assignments",
  {
    printerId: integer("printer_id")
      .primaryKey()
      .references(() => printers.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => monitoringAgents.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("printer_monitoring_assignments_agent_idx").on(t.agentId)],
);

// Explicit per-user printing access. The agent is stored with the printer so
// permissions remain auditable when a printer is reassigned later.
export const userPrinterPermissions = pgTable(
  "user_printer_permissions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => monitoringAgents.id, { onDelete: "cascade" }),
    printerId: integer("printer_id")
      .notNull()
      .references(() => printers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_printer_permissions_user_printer_unique").on(
      t.userId,
      t.printerId,
    ),
    index("user_printer_permissions_agent_idx").on(t.agentId),
  ],
);

export const printerMonitoringReadings = pgTable(
  "printer_monitoring_readings",
  {
    id: serial("id").primaryKey(),
    printerId: integer("printer_id")
      .notNull()
      .references(() => printers.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => monitoringAgents.id),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    online: boolean("online").notNull(),
    printerStatus: text("printer_status"),
    responseTimeMs: integer("response_time_ms"),
    pageCount: bigint("page_count", { mode: "number" }),
    uptimeSeconds: bigint("uptime_seconds", { mode: "number" }),
    errorStatus: text("error_status"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("printer_monitoring_readings_printer_checked_idx").on(
      t.printerId,
      t.checkedAt,
    ),
    index("printer_monitoring_readings_agent_checked_idx").on(
      t.agentId,
      t.checkedAt,
    ),
  ],
);

export const printerConsumableReadings = pgTable(
  "printer_consumable_readings",
  {
    id: serial("id").primaryKey(),
    printerId: integer("printer_id")
      .notNull()
      .references(() => printers.id, { onDelete: "cascade" }),
    monitoringReadingId: integer("monitoring_reading_id")
      .notNull()
      .references(() => printerMonitoringReadings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    levelPercent: integer("level_percent"),
    status: text("status"),
    isUnknown: boolean("is_unknown").notNull().default(false),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("printer_consumable_readings_printer_checked_idx").on(
      t.printerId,
      t.checkedAt,
    ),
    index("printer_consumable_readings_monitoring_reading_idx").on(
      t.monitoringReadingId,
    ),
  ],
);

export const printerAlerts = pgTable(
  "printer_alerts",
  {
    id: serial("id").primaryKey(),
    printerId: integer("printer_id")
      .notNull()
      .references(() => printers.id, { onDelete: "cascade" }),
    agentId: integer("agent_id")
      .notNull()
      .references(() => monitoringAgents.id),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("printer_alerts_printer_started_idx").on(t.printerId, t.startedAt),
    index("printer_alerts_agent_resolved_idx").on(t.agentId, t.resolvedAt),
  ],
);

export type DiscoveredPrinter = {
  ip: string;
  macAddress?: string | null;
  description: string;
  serialNumber: string | null;
  model: string | null;
};

export const printerDiscoveryScans = pgTable(
  "printer_discovery_scans",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id")
      .notNull()
      .references(() => monitoringAgents.id, { onDelete: "cascade" }),
    requestedBy: integer("requested_by")
      .references(() => users.id, { onDelete: "set null" }),
    subnet: text("subnet").notNull(),
    status: text("status").notNull().default("queued"),
    results: jsonb("results").$type<DiscoveredPrinter[]>().notNull().default([]),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("printer_discovery_scans_agent_status_idx").on(t.agentId, t.status),
    index("printer_discovery_scans_requested_at_idx").on(t.requestedAt),
  ],
);

export type PrintOpsCommandPayload = Record<string, unknown>;
export type PrintOpsCommandResult = Record<string, unknown>;

// PrintOps commands are claimed by authenticated office agents. Files are
// base64 encoded so deployments do not need a shared filesystem between the
// central dashboard and each office network.
export const printOpsCommands = pgTable(
  "print_ops_commands",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id")
      .notNull()
      .references(() => monitoringAgents.id, { onDelete: "cascade" }),
    requestedBy: integer("requested_by")
      .references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    status: text("status").notNull().default("queued"),
    payload: jsonb("payload")
      .$type<PrintOpsCommandPayload>()
      .notNull()
      .default({}),
    result: jsonb("result").$type<PrintOpsCommandResult>(),
    inputFileName: text("input_file_name"),
    inputMimeType: text("input_mime_type"),
    inputFileData: text("input_file_data"),
    outputFileName: text("output_file_name"),
    outputMimeType: text("output_mime_type"),
    outputFileData: text("output_file_data"),
    errorMessage: text("error_message"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("print_ops_commands_agent_status_idx").on(t.agentId, t.status),
    index("print_ops_commands_type_requested_idx").on(t.type, t.requestedAt),
    index("print_ops_commands_requested_by_idx").on(t.requestedBy),
  ],
);

// ---------- REPAIR TICKETS ----------
export const repairTickets = pgTable("repair_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(),
  serialNumber: text("serial_number").notNull(),
  printerId: integer("printer_id").references(() => printers.id, {
    onDelete: "set null",
  }),
  requestedDate: date("requested_date").notNull(),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  locationId: integer("location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  problem: text("problem").notNull(),
  vendorId: integer("vendor_id").references(() => vendors.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  resolution: text("resolution"),
  resolutionAttachmentUrl: text("resolution_attachment_url"),
  resolutionAttachmentName: text("resolution_attachment_name"),
  status: text("status").notNull().default("Open"),
  dateClosed: date("date_closed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------- REPLACEMENT HISTORY ----------
export const replacementHistory = pgTable("replacement_history", {
  id: serial("id").primaryKey(),
  printerId: integer("printer_id")
    .notNull()
    .references(() => printers.id, { onDelete: "cascade" }),
  replacementDate: date("replacement_date").notNull(),
  oldSerialNumber: text("old_serial_number").notNull(),
  newSerialNumber: text("new_serial_number").notNull(),
  model: text("model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- TONER TRANSACTIONS ----------
export const tonerTransactions = pgTable("toner_transactions", {
  id: serial("id").primaryKey(),
  groupId: text("group_id").notNull(),
  type: text("type").notNull(), // 'Delivery' | 'Request'
  date: date("date").notNull(),
  ticketReference: text("ticket_reference"),
  tonerTypeId: integer("toner_type_id")
    .notNull()
    .references(() => tonerTypes.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  locationId: integer("location_id").references(() => locations.id, {
    onDelete: "set null",
  }),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  itsNameId: integer("its_name_id").references(() => itsNames.id, {
    onDelete: "set null",
  }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- EMPLOYEE REGISTRATION ----------
export const userRegistrationRequests = pgTable(
  "user_registration_requests",
  {
    id: serial("id").primaryKey(),
    employeeId: text("employee_id"),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    primaryLocationId: integer("primary_location_id")
      .references(() => locations.id),
    departmentId: integer("department_id")
      .references(() => departments.id),
    source: text("source").notNull().default("self_registration"),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending_email"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reviewedBy: integer("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    deletionReason: text("deletion_reason"),
  },
  (t) => [
    index("registration_requests_status_idx").on(t.status),
    index("registration_requests_email_idx").on(t.email),
    index("registration_requests_employee_idx").on(t.employeeId),
    index("registration_requests_user_idx").on(t.userId),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: serial("id").primaryKey(),
    registrationRequestId: integer("registration_request_id")
      .notNull()
      .references(() => userRegistrationRequests.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_verification_registration_idx").on(t.registrationRequestId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

// ---------- NOTIFICATIONS ----------
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- SYSTEM SETTINGS ----------
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  logoUrl: text("logo_url"),
  notificationEmail: text("notification_email")
    .notNull()
    .default("itservicedesk@seaoil.com.ph"),
  defaultLowStockThreshold: integer("default_low_stock_threshold")
    .notNull()
    .default(5),
  emailReminderEnabled: boolean("email_reminder_enabled")
    .notNull()
    .default(true),
  systemNotificationEnabled: boolean("system_notification_enabled")
    .notNull()
    .default(true),
  agentOfflineThresholdMinutes: integer("agent_offline_threshold_minutes")
    .notNull()
    .default(5),
  tonerLowEmailEnabled: boolean("toner_low_email_enabled").notNull().default(true),
  tonerCriticalEmailEnabled: boolean("toner_critical_email_enabled").notNull().default(true),
  tonerEmptyEmailEnabled: boolean("toner_empty_email_enabled").notNull().default(true),
  agentOfflineEmailEnabled: boolean("agent_offline_email_enabled").notNull().default(true),
  agentRecoveredEmailEnabled: boolean("agent_recovered_email_enabled").notNull().default(true),
  registrationEnabled: boolean("registration_enabled").notNull().default(true),
  smtpEnabled: boolean("smtp_enabled").notNull().default(false),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecurity: text("smtp_security").notNull().default("none"),
  smtpUsername: text("smtp_username"),
  smtpPasswordEncrypted: text("smtp_password_encrypted"),
  smtpFrom: text("smtp_from"),
  smtpFromName: text("smtp_from_name"),
  smtpTestRecipient: text("smtp_test_recipient"),
  smtpLastTestedAt: timestamp("smtp_last_tested_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
});
