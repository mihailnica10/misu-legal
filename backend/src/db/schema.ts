import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// Better Auth core tables
// ---------------------------------------------------------------------------
export const user = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  expiresAt: integer('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at'),
  refreshTokenExpiresAt: integer('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

// ---------------------------------------------------------------------------
// Mișu app tables (user_profiles, projects, documents, etc.)
// ---------------------------------------------------------------------------
export const userProfiles = sqliteTable('user_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique(),
  displayName: text('display_name'),
  organisation: text('organisation'),
  tier: text('tier').notNull().default('Free'),
  messageCreditsUsed: integer('message_credits_used').notNull().default(0),
  creditsResetDate: text('credits_reset_date').notNull().$defaultFn(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  }),
  titleModel: text('title_model'),
  tabularModel: text('tabular_model').notNull().default('gemini-3-flash-preview'),
  quoteModel: text('quote_model'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// User API keys
// ---------------------------------------------------------------------------
export const userApiKeys = sqliteTable('user_api_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull().$type<'claude' | 'gemini' | 'openai' | 'openrouter' | 'courtlistener'>(),
  encryptedKey: text('encrypted_key').notNull(),
  iv: text('iv').notNull(),
  authTag: text('auth_tag').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userProviderUnique: uniqueIndex('idx_user_api_keys_user_provider').on(table.userId, table.provider),
}));

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  cmNumber: text('cm_number'),
  visibility: text('visibility').notNull().default('private'),
  sharedWith: text('shared_with').notNull().default('[]'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const projectSubfolders = sqliteTable('project_subfolders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  parentFolderId: text('parent_folder_id').references(() => projectSubfolders.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  status: text('status').notNull().default('pending'),
  folderId: text('folder_id').references(() => projectSubfolders.id, { onDelete: 'set null' }),
  currentVersionId: text('current_version_id'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const documentVersions = sqliteTable('document_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  pdfStoragePath: text('pdf_storage_path'),
  source: text('source').notNull().default('upload'),
  versionNumber: integer('version_number'),
  filename: text('filename'),
  fileType: text('file_type'),
  sizeBytes: integer('size_bytes'),
  pageCount: integer('page_count'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  docVersionUnique: uniqueIndex('idx_doc_versions_unique').on(table.documentId, table.versionNumber),
}));

export const documentEdits = sqliteTable('document_edits', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  chatMessageId: text('chat_message_id'),
  versionId: text('version_id').notNull().references(() => documentVersions.id, { onDelete: 'cascade' }),
  changeId: text('change_id').notNull(),
  delWId: text('del_w_id'),
  insWId: text('ins_w_id'),
  deletedText: text('deleted_text').notNull().default(''),
  insertedText: text('inserted_text').notNull().default(''),
  contextBefore: text('context_before'),
  contextAfter: text('context_after'),
  status: text('status').notNull().default('pending').$type<'pending' | 'accepted' | 'rejected'>(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  resolvedAt: text('resolved_at'),
});

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id'),
  title: text('title').notNull(),
  type: text('type').notNull(),
  promptMd: text('prompt_md'),
  columnsConfig: text('columns_config'),
  practice: text('practice'),
  isSystem: integer('is_system').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const hiddenWorkflows = sqliteTable('hidden_workflows', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  workflowId: text('workflow_id').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  userWorkflowUnique: uniqueIndex('idx_hidden_workflows_unique').on(table.userId, table.workflowId),
}));

export const workflowShares = sqliteTable('workflow_shares', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  sharedByUserId: text('shared_by_user_id').notNull(),
  sharedWithEmail: text('shared_with_email').notNull(),
  allowEdit: integer('allow_edit').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  workflowEmailUnique: uniqueIndex('idx_workflow_shares_unique').on(table.workflowId, table.sharedWithEmail),
}));

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------
export const chats = sqliteTable('chats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  title: text('title'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content'),
  files: text('files'),
  annotations: text('annotations'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Tabular reviews
// ---------------------------------------------------------------------------
export const tabularReviews = sqliteTable('tabular_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  title: text('title'),
  columnsConfig: text('columns_config'),
  documentIds: text('document_ids'),
  workflowId: text('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
  practice: text('practice'),
  sharedWith: text('shared_with').notNull().default('[]'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const tabularCells = sqliteTable('tabular_cells', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  reviewId: text('review_id').notNull().references(() => tabularReviews.id, { onDelete: 'cascade' }),
  documentId: text('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  columnIndex: integer('column_index').notNull(),
  content: text('content'),
  citations: text('citations'),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const tabularReviewChats = sqliteTable('tabular_review_chats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  reviewId: text('review_id').notNull().references(() => tabularReviews.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  title: text('title'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const tabularReviewChatMessages = sqliteTable('tabular_review_chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chat_id').notNull().references(() => tabularReviewChats.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content'),
  annotations: text('annotations'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Romanian legal index (replaces CourtListener)
// ---------------------------------------------------------------------------
export const roLegalIndex = sqliteTable('ro_legal_index', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actNumber: text('act_number'),
  actType: text('act_type'),
  title: text('title'),
  publicationDate: text('publication_date'),
  officialGazette: text('official_gazette'),
  contentSummary: text('content_summary'),
  sourceUrl: text('source_url'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
