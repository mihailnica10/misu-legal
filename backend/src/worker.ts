import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from './db';
import * as schema from './db/schema';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';

// TanStack AI
import { chat, toServerSentEventsResponse } from '@tanstack/ai';
import { anthropicText } from '@tanstack/ai-anthropic';
import { geminiText } from '@tanstack/ai-gemini';
import { openaiText } from '@tanstack/ai-openai';
import type { UIMessage } from '@tanstack/ai/client';

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
  ENVIRONMENT?: string;
};

type Variables = {
  userId: string;
  userEmail: string;
};

type AppBindings = { Bindings: Env; Variables: Variables };

const JWT_ALG = 'HS256';
const JWT_EXPIRES = '7d';

const app = new Hono<AppBindings>();

// CORS
app.use('/*', cors({
  origin: (origin, c) => c.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Health
app.get('/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

// -----------------------------------------------------------------------
// Auth helpers
// -----------------------------------------------------------------------
async function getJwtSecret(env: Env): Promise<Uint8Array> {
  const secret = env.JWT_SECRET || 'misu-dev-secret';
  return new TextEncoder().encode(secret);
}

async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password + 'misu-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createToken(userId: string, email: string, env: Env): Promise<string> {
  const secret = await getJwtSecret(env);
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES)
    .sign(secret);
}

async function verifyToken(token: string, env: Env): Promise<{ sub: string; email: string } | null> {
  try {
    const secret = await getJwtSecret(env);
    const { payload } = await jwtVerify(token, secret);
    return { sub: payload.sub as string, email: payload.email as string };
  } catch { return null; }
}

async function requireAuth(c: any, next: any) {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401);
  const payload = await verifyToken(auth.slice(7), c.env);
  if (!payload) return c.json({ error: 'Invalid token' }, 401);
  c.set('userId', payload.sub);
  c.set('userEmail', payload.email);
  await next();
}

// -----------------------------------------------------------------------
// Auth routes
// -----------------------------------------------------------------------
app.post('/api/auth/signup', async (c) => {
  try {
    const db = getDb(c.env.DB);
    const { email, password, name } = await c.req.json();
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400);

    const existing = await db.select().from(schema.user)
      .where(eq(schema.user.email, email.toLowerCase())).get();
    if (existing) return c.json({ error: 'User already exists' }, 409);

    const passwordHash = await hashPassword(password);
    const now = Date.now();

    const newUser = await db.insert(schema.user).values({
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    }).returning().get();

    // Store password as an account entry
    await db.insert(schema.account).values({
      userId: newUser.id,
      providerId: 'credential',
      accountId: newUser.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    }).run();

    const token = await createToken(newUser.id, newUser.email, c.env);
    return c.json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/auth/login', async (c) => {
  try {
    const db = getDb(c.env.DB);
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400);

    const user = await db.select().from(schema.user)
      .where(eq(schema.user.email, email.toLowerCase())).get();
    if (!user) return c.json({ error: 'Invalid credentials' }, 401);

    const creds = await db.select().from(schema.account)
      .where(and(eq(schema.account.userId, user.id), eq(schema.account.providerId, 'credential'))).get();

    if (!creds?.password) return c.json({ error: 'Invalid credentials' }, 401);

    const passwordHash = await hashPassword(password);
    if (creds.password !== passwordHash) return c.json({ error: 'Invalid credentials' }, 401);

    const token = await createToken(user.id, user.email, c.env);
    return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/auth/session', requireAuth, async (c) => {
  return c.json({ user: { id: c.get('userId'), email: c.get('userEmail') } });
});

app.post('/api/auth/logout', async (c) => c.json({ ok: true }));

// -----------------------------------------------------------------------
// User routes
// -----------------------------------------------------------------------
const users = new Hono<AppBindings>();
users.get('/me', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const profile = await db.select().from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId)).get();
  return c.json(profile || { userId, email: c.get('userEmail') });
});
users.put('/me', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();
  const updated = await db.update(schema.userProfiles)
    .set({ ...body, updatedAt: Date.now() })
    .where(eq(schema.userProfiles.userId, userId)).returning().get();
  return c.json(updated);
});

// DELETE /user/account
users.delete('/account', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  await db.delete(schema.user).where(eq(schema.user.id, userId)).run();
  return c.body(null, 204);
});

// GET /user/profile
users.get('/profile', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');

  // Get or create profile
  let profile = await db.select().from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId)).get();

  if (!profile) {
    await db.insert(schema.userProfiles).values({ userId }).run();
    profile = await db.select().from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, userId)).get();
  }

  const userRow = await db.select().from(schema.user)
    .where(eq(schema.user.id, userId)).get();

  return c.json({
    displayName: profile?.displayName || null,
    organisation: profile?.organisation || null,
    messageCreditsUsed: profile?.messageCreditsUsed || 0,
    creditsResetDate: profile?.creditsResetDate || null,
    tier: profile?.tier || 'Free',
    titleModel: profile?.titleModel || null,
    tabularModel: profile?.tabularModel || 'gemini-3-flash-preview',
    email: userRow?.email || null,
  });
});

// PATCH /user/profile
users.patch('/profile', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();

  const allowedFields = ['displayName', 'organisation', 'titleModel', 'tabularModel'];
  const invalidField = Object.keys(body).find(key => !allowedFields.includes(key));
  if (invalidField) return c.json({ error: `Unsupported profile field: ${invalidField}` }, 400);

  let profile = await db.select().from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId)).get();
  if (!profile) {
    await db.insert(schema.userProfiles).values({ userId }).run();
  }

  const updateData: Record<string, any> = { updatedAt: Date.now() };
  if (body.displayName !== undefined) updateData.displayName = body.displayName;
  if (body.organisation !== undefined) updateData.organisation = body.organisation;
  if (body.titleModel !== undefined) updateData.titleModel = body.titleModel;
  if (body.tabularModel !== undefined) updateData.tabularModel = body.tabularModel;

  const updated = await db.update(schema.userProfiles)
    .set(updateData)
    .where(eq(schema.userProfiles.userId, userId))
    .returning().get();

  return c.json({
    displayName: updated?.displayName || null,
    organisation: updated?.organisation || null,
    titleModel: updated?.titleModel || null,
    tabularModel: updated?.tabularModel || 'gemini-3-flash-preview',
  });
});

// GET /user/api-keys
users.get('/api-keys', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const keys = await db.select()
    .from(schema.userApiKeys)
    .where(eq(schema.userApiKeys.userId, userId))
    .all();

  const status: Record<string, boolean> = {};
  for (const key of keys) {
    status[key.provider] = true;
  }
  return c.json(status);
});

// PUT /user/api-keys/:provider
users.put('/api-keys/:provider', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const provider = c.req.param('provider');
  const body = await c.req.json();
  const apiKey = body.api_key || null;

  if (!apiKey) return c.json({ error: 'api_key is required' }, 400);

  // Upsert: delete existing then insert
  await db.delete(schema.userApiKeys)
    .where(and(
      eq(schema.userApiKeys.userId, userId),
      eq(schema.userApiKeys.provider, provider as any)
    )).run();

  await db.insert(schema.userApiKeys).values({
    userId,
    provider: provider as any,
    encryptedKey: apiKey,
    iv: '',
    authTag: '',
  }).run();

  const keys = await db.select()
    .from(schema.userApiKeys)
    .where(eq(schema.userApiKeys.userId, userId))
    .all();
  const status: Record<string, boolean> = {};
  for (const key of keys) {
    status[key.provider] = true;
  }
  return c.json(status);
});

app.route('/user', users);
app.route('/users', users);

// -----------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------
const projectsRoutes = new Hono<AppBindings>();
projectsRoutes.get('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId');
  const items = await db.select().from(schema.projects).where(eq(schema.projects.userId, userId)).orderBy(desc(schema.projects.createdAt)).all();
  return c.json(items);
});
projectsRoutes.post('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId'); const body = await c.req.json();
  const project = await db.insert(schema.projects).values({ userId, name: body.name, cmNumber: body.cmNumber, visibility: body.visibility || 'private' }).returning().get();
  return c.json(project, 201);
});
projectsRoutes.get('/:id', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const id = c.req.param('id');
  const project = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  if (!project) return c.json({ error: 'Not found' }, 404); return c.json(project);
});
projectsRoutes.put('/:id', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const id = c.req.param('id'); const body = await c.req.json();
  const updated = await db.update(schema.projects).set({ ...body, updatedAt: Date.now() }).where(eq(schema.projects.id, id)).returning().get();
  return c.json(updated);
});
projectsRoutes.delete('/:id', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const id = c.req.param('id');
  await db.delete(schema.projects).where(eq(schema.projects.id, id)).run();
  return c.json({ ok: true });
});

// PATCH /projects/:id — partial update
projectsRoutes.patch('/:id', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();

  const updates: Record<string, any> = { updatedAt: Date.now() };
  if (body.name != null) updates.name = body.name;
  if (body.cmNumber != null) updates.cmNumber = body.cmNumber;
  if (body.visibility != null) updates.visibility = body.visibility;

  const updated = await db.update(schema.projects)
    .set(updates)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
    .returning().get();
  if (!updated) return c.json({ error: 'Not found' }, 404);

  const docs = await db.select().from(schema.documents)
    .where(eq(schema.documents.projectId, id))
    .orderBy(schema.documents.createdAt).all();
  const folders = await db.select().from(schema.projectSubfolders)
    .where(eq(schema.projectSubfolders.projectId, id))
    .orderBy(schema.projectSubfolders.createdAt).all();

  return c.json({ ...updated, documents: docs, folders });
});

// GET /projects/:id/people
projectsRoutes.get('/:id/people', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const id = c.req.param('id');

  const project = await db.select().from(schema.projects)
    .where(eq(schema.projects.id, id)).get();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  let sharedWith: string[] = [];
  try { sharedWith = JSON.parse(project.sharedWith || '[]'); } catch {}

  const isOwner = project.userId === userId;
  const isShared = userEmail && sharedWith.includes(userEmail.toLowerCase());
  if (!isOwner && !isShared) return c.json({ error: 'Project not found' }, 404);

  const owner = {
    userId: project.userId,
    email: null,
    displayName: null,
  };

  const members = sharedWith.map(email => ({ email, displayName: null }));

  return c.json({ owner, members });
});

// POST /projects/:id/folders
projectsRoutes.post('/:id/folders', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400);

  const project = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId))).get();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  if (body.parentFolderId) {
    const parent = await db.select().from(schema.projectSubfolders)
      .where(and(
        eq(schema.projectSubfolders.id, body.parentFolderId),
        eq(schema.projectSubfolders.projectId, id)
      )).get();
    if (!parent) return c.json({ error: 'Parent folder not found' }, 404);
  }

  const folder = await db.insert(schema.projectSubfolders).values({
    projectId: id,
    userId,
    name: body.name.trim(),
    parentFolderId: body.parentFolderId || null,
  }).returning().get();
  return c.json(folder, 201);
});

// PATCH /projects/:id/folders/:folderId
projectsRoutes.patch('/:id/folders/:folderId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const folderId = c.req.param('folderId');
  const body = await c.req.json();

  const project = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId))).get();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const updates: Record<string, any> = {};
  if (body.name != null) updates.name = body.name.trim();
  if (body.parentFolderId !== undefined) updates.parentFolderId = body.parentFolderId || null;

  const updated = await db.update(schema.projectSubfolders)
    .set(updates)
    .where(and(
      eq(schema.projectSubfolders.id, folderId),
      eq(schema.projectSubfolders.projectId, id)
    ))
    .returning().get();
  if (!updated) return c.json({ error: 'Folder not found' }, 404);
  return c.json(updated);
});

// DELETE /projects/:id/folders/:folderId
projectsRoutes.delete('/:id/folders/:folderId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const folderId = c.req.param('folderId');

  const project = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId))).get();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  // Collect all descendant folder IDs
  const allFolders = await db.select().from(schema.projectSubfolders)
    .where(eq(schema.projectSubfolders.projectId, id)).all();
  const childrenByParent = new Map<string, string[]>();
  for (const f of allFolders) {
    if (f.parentFolderId) {
      const children = childrenByParent.get(f.parentFolderId) || [];
      children.push(f.id);
      childrenByParent.set(f.parentFolderId, children);
    }
  }

  const folderIds = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const fid = stack.pop()!;
    if (folderIds.has(fid)) continue;
    folderIds.add(fid);
    stack.push(...(childrenByParent.get(fid) || []));
  }

  // Move documents out of deleted folders
  await db.update(schema.documents)
    .set({ folderId: null, updatedAt: Date.now() })
    .where(and(
      eq(schema.documents.projectId, id),
      inArray(schema.documents.folderId, [...folderIds])
    )).run();

  await db.delete(schema.projectSubfolders)
    .where(and(
      eq(schema.projectSubfolders.id, folderId),
      eq(schema.projectSubfolders.projectId, id)
    )).run();

  return c.body(null, 204);
});

// PATCH /projects/:id/documents/:documentId/folder — move doc to folder
projectsRoutes.patch('/:id/documents/:documentId/folder', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param('id');
  const documentId = c.req.param('documentId');
  const body = await c.req.json();
  const folderId = body.folder_id || null;

  if (folderId) {
    const folder = await db.select().from(schema.projectSubfolders)
      .where(and(
        eq(schema.projectSubfolders.id, folderId),
        eq(schema.projectSubfolders.projectId, id)
      )).get();
    if (!folder) return c.json({ error: 'Folder not found' }, 404);
  }

  const updated = await db.update(schema.documents)
    .set({ folderId, updatedAt: Date.now() })
    .where(and(
      eq(schema.documents.id, documentId),
      eq(schema.documents.projectId, id)
    ))
    .returning().get();
  if (!updated) return c.json({ error: 'Document not found' }, 404);
  return c.json(updated);
});

// POST /projects/:id/documents/:documentId — add existing doc to project
projectsRoutes.post('/:id/documents/:documentId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id');
  const documentId = c.req.param('documentId');

  const project = await db.select().from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId))).get();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const doc = await db.select().from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.userId, userId))).get();
  if (!doc) return c.json({ error: 'Document not found' }, 404);

  if (doc.projectId === id) return c.json(doc);

  const updated = await db.update(schema.documents)
    .set({ projectId: id, updatedAt: Date.now() })
    .where(eq(schema.documents.id, documentId))
    .returning().get();
  return c.json(updated);
});

// GET /projects/:id/chats
projectsRoutes.get('/:id/chats', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const id = c.req.param('id');
  const chats = await db.select().from(schema.chats)
    .where(eq(schema.chats.projectId, id))
    .orderBy(desc(schema.chats.createdAt))
    .all();
  return c.json(chats);
});

app.route('/projects', projectsRoutes);

// -----------------------------------------------------------------------
// Documents
// -----------------------------------------------------------------------
const docs = new Hono<AppBindings>();
docs.get('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId'); const projectId = c.req.query('project_id');
  let q: any = db.select().from(schema.documents).where(eq(schema.documents.userId, userId));
  if (projectId) q = q.where(eq(schema.documents.projectId, projectId));
  return c.json(await q.orderBy(desc(schema.documents.createdAt)).all());
});
docs.post('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId'); const body = await c.req.json();
  const doc = await db.insert(schema.documents).values({ userId, projectId: body.projectId, status: 'pending' }).returning().get();
  return c.json(doc, 201);
});
docs.post('/:id/versions', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const r2 = c.env.R2; const id = c.req.param('id');
  const body = await c.req.parseBody(); const file = body['file'] as File;
  if (!file) return c.json({ error: 'No file' }, 400);
  const storagePath = `documents/${id}/${crypto.randomUUID()}_${file.name}`;
  await r2.put(storagePath, file, { httpMetadata: { contentType: file.type } });
  const version = await db.insert(schema.documentVersions).values({ documentId: id, storagePath, filename: file.name, fileType: file.type, sizeBytes: file.size, source: 'upload' }).returning().get();
  await db.update(schema.documents).set({ currentVersionId: version.id, updatedAt: Date.now() }).where(eq(schema.documents.id, id)).run();
  return c.json(version, 201);
});
docs.get('/:id/download', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const r2 = c.env.R2; const id = c.req.param('id');
  const doc = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).get();
  if (!doc?.currentVersionId) return c.json({ error: 'Not found' }, 404);
  const ver = await db.select().from(schema.documentVersions).where(eq(schema.documentVersions.id, doc.currentVersionId)).get();
  if (!ver) return c.json({ error: 'Not found' }, 404);
  const obj = await r2.get(ver.storagePath);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  return new Response(obj.body, { headers: { 'Content-Type': ver.fileType || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${ver.filename}"` } });
});

// DELETE /single-documents/:documentId
docs.delete('/:documentId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');

  const doc = await db.select().from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.userId, userId))).get();
  if (!doc) return c.json({ error: 'Document not found' }, 404);

  await db.delete(schema.documents).where(eq(schema.documents.id, documentId)).run();
  return c.body(null, 204);
});

// GET /single-documents/:documentId/display
docs.get('/:documentId/display', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  const versionIdParam = c.req.query('version_id') || null;

  const doc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, documentId)).get();
  if (!doc || doc.userId !== userId) return c.json({ error: 'Document not found' }, 404);

  const versionId = versionIdParam || doc.currentVersionId;
  if (!versionId) return c.json({ error: 'No file available' }, 404);

  const ver = await db.select().from(schema.documentVersions)
    .where(eq(schema.documentVersions.id, versionId)).get();
  if (!ver) return c.json({ error: 'No file available' }, 404);

  const servePath = ver.pdfStoragePath || ver.storagePath;
  const obj = await r2.get(servePath);
  if (!obj) return c.json({ error: 'Document not found in storage' }, 404);

  const isPdf = ver.fileType === 'pdf' || servePath !== ver.storagePath;
  const contentType = isPdf
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${ver.filename || 'document'}"`,
    },
  });
});

// GET /single-documents/:documentId/url
docs.get('/:documentId/url', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  const versionIdParam = c.req.query('version_id') || null;

  const doc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, documentId)).get();
  if (!doc || doc.userId !== userId) return c.json({ error: 'Document not found' }, 404);

  const versionId = versionIdParam || doc.currentVersionId;
  if (!versionId) return c.json({ error: 'No file available' }, 404);

  const ver = await db.select().from(schema.documentVersions)
    .where(eq(schema.documentVersions.id, versionId)).get();
  if (!ver) return c.json({ error: 'No file available' }, 404);

  const url = await r2.createSignedUrl(ver.storagePath, { signedExpiry: 3600 });
  if (!url) return c.json({ error: 'Storage not configured' }, 503);

  return c.json({
    url,
    documentId,
    filename: ver.filename || 'document',
    versionId: ver.id,
    hasPdfRendition: !!ver.pdfStoragePath,
  });
});

// GET /single-documents/:documentId/docx
docs.get('/:documentId/docx', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  const versionIdParam = c.req.query('version_id') || null;

  const doc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, documentId)).get();
  if (!doc || doc.userId !== userId) return c.json({ error: 'Document not found' }, 404);

  const versionId = versionIdParam || doc.currentVersionId;
  if (!versionId) return c.json({ error: 'No file available' }, 404);

  const ver = await db.select().from(schema.documentVersions)
    .where(eq(schema.documentVersions.id, versionId)).get();
  if (!ver) return c.json({ error: 'No file available' }, 404);

  const obj = await r2.get(ver.storagePath);
  if (!obj) return c.json({ error: 'Document bytes not available' }, 404);

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `inline; filename="${ver.filename || 'document.docx'}"`,
    },
  });
});

// POST /single-documents/download-zip
docs.post('/download-zip', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const userId = c.get('userId');
  const body = await c.req.json();
  const documentIds = body.document_ids;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return c.json({ error: 'document_ids is required' }, 400);
  }

  const docsList = await db.select().from(schema.documents)
    .where(and(
      inArray(schema.documents.id, documentIds),
      eq(schema.documents.userId, userId)
    )).all();

  const files: { filename: string; sizeBytes: number }[] = [];
  for (const d of docsList) {
    if (!d.currentVersionId) continue;
    const ver = await db.select().from(schema.documentVersions)
      .where(eq(schema.documentVersions.id, d.currentVersionId)).get();
    if (!ver) continue;
    const obj = await r2.get(ver.storagePath);
    if (!obj) continue;
    const data = await obj.arrayBuffer();
    files.push({ filename: ver.filename || 'document', sizeBytes: data.byteLength });
  }

  return c.json({ files });
});

// GET /single-documents/:documentId/versions
docs.get('/:documentId/versions', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');

  const doc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, documentId)).get();
  if (!doc || doc.userId !== userId) return c.json({ error: 'Document not found' }, 404);

  const versions = await db.select().from(schema.documentVersions)
    .where(eq(schema.documentVersions.documentId, documentId))
    .orderBy(schema.documentVersions.createdAt)
    .all();

  return c.json({
    currentVersionId: doc.currentVersionId,
    versions: versions.map((v: any) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      source: v.source,
      createdAt: v.createdAt,
      filename: v.filename,
      fileType: v.fileType,
      sizeBytes: v.sizeBytes,
      pageCount: v.pageCount,
    })),
  });
});

// POST /single-documents/:documentId/versions/from-document
docs.post('/:documentId/versions/from-document', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  const body = await c.req.json();
  const sourceDocumentId = body.source_document_id;

  if (!sourceDocumentId) return c.json({ error: 'source_document_id is required' }, 400);
  if (sourceDocumentId === documentId) return c.json({ error: 'Source and target documents must be different' }, 400);

  const targetDoc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, documentId)).get();
  if (!targetDoc || targetDoc.userId !== userId) return c.json({ error: 'Document not found' }, 404);

  const sourceDoc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, sourceDocumentId)).get();
  if (!sourceDoc || sourceDoc.userId !== userId) return c.json({ error: 'Source document not found' }, 404);

  if (!sourceDoc.currentVersionId) return c.json({ error: 'Source document has no active version' }, 404);

  const activeVersion = await db.select().from(schema.documentVersions)
    .where(eq(schema.documentVersions.id, sourceDoc.currentVersionId)).get();
  if (!activeVersion) return c.json({ error: 'Source document has no active version' }, 404);

  const targetActive = targetDoc.currentVersionId
    ? await db.select().from(schema.documentVersions)
        .where(eq(schema.documentVersions.id, targetDoc.currentVersionId)).get()
    : null;
  if (targetActive?.fileType && activeVersion.fileType && targetActive.fileType !== activeVersion.fileType) {
    return c.json({ error: `Source document type (${activeVersion.fileType}) does not match document type (${targetActive.fileType})` }, 400);
  }

  const obj = await r2.get(activeVersion.storagePath);
  if (!obj) return c.json({ error: 'Source document bytes not available' }, 404);
  const bytes = await obj.arrayBuffer();

  const filename = body.filename?.trim() || activeVersion.filename || 'Untitled document';
  const versionSlug = crypto.randomUUID().replace(/-/g, '');
  const key = `documents/${documentId}/${versionSlug}_${filename}`;

  const contentType = filename.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  await r2.put(key, bytes, { httpMetadata: { contentType } });

  const maxRow = await db.select()
    .from(schema.documentVersions)
    .where(and(
      eq(schema.documentVersions.documentId, documentId),
      inArray(schema.documentVersions.source, ['upload', 'user_upload', 'assistant_edit'])
    ))
    .orderBy(desc(schema.documentVersions.versionNumber))
    .limit(1)
    .get();
  const nextVersionNumber = (maxRow?.versionNumber ?? 1) + 1;

  const version = await db.insert(schema.documentVersions).values({
    documentId,
    storagePath: key,
    source: 'user_upload',
    versionNumber: nextVersionNumber,
    filename,
    fileType: activeVersion.fileType,
    sizeBytes: bytes.byteLength,
    pageCount: activeVersion.pageCount,
  }).returning().get();

  await db.update(schema.documents)
    .set({ currentVersionId: version.id, updatedAt: Date.now() })
    .where(eq(schema.documents.id, documentId)).run();

  return c.json(version, 201);
});

// PATCH /single-documents/:documentId/versions/:versionId
docs.patch('/:documentId/versions/:versionId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  const versionId = c.req.param('versionId');
  const body = await c.req.json();

  const doc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, documentId)).get();
  if (!doc || doc.userId !== userId) return c.json({ error: 'Document not found' }, 404);

  const raw = body.filename;
  const filename = typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 200) : null;
  if (!filename) return c.json({ error: 'filename is required' }, 400);

  const updated = await db.update(schema.documentVersions)
    .set({ filename })
    .where(and(
      eq(schema.documentVersions.id, versionId),
      eq(schema.documentVersions.documentId, documentId)
    ))
    .returning().get();
  if (!updated) return c.json({ error: 'Version not found' }, 404);
  return c.json(updated);
});

// DELETE /single-documents/:documentId/versions/:versionId
docs.delete('/:documentId/versions/:versionId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const userId = c.get('userId');
  const documentId = c.req.param('documentId');
  const versionId = c.req.param('versionId');

  const doc = await db.select().from(schema.documents)
    .where(eq(schema.documents.id, documentId)).get();
  if (!doc || doc.userId !== userId) return c.json({ error: 'Document not found' }, 404);

  const version = await db.select().from(schema.documentVersions)
    .where(and(
      eq(schema.documentVersions.id, versionId),
      eq(schema.documentVersions.documentId, documentId)
    )).get();
  if (!version) return c.json({ error: 'Version not found' }, 404);

  await db.delete(schema.documentVersions)
    .where(and(
      eq(schema.documentVersions.id, versionId),
      eq(schema.documentVersions.documentId, documentId)
    )).run();

  let nextCurrentId = doc.currentVersionId;
  if (doc.currentVersionId === versionId) {
    const newest = await db.select()
      .from(schema.documentVersions)
      .where(eq(schema.documentVersions.documentId, documentId))
      .orderBy(desc(schema.documentVersions.createdAt))
      .limit(1)
      .get();
    nextCurrentId = newest?.id || null;
    await db.update(schema.documents)
      .set({ currentVersionId: nextCurrentId, updatedAt: Date.now() })
      .where(eq(schema.documents.id, documentId)).run();
  }

  return c.json({
    deletedVersionId: versionId,
    currentVersionId: nextCurrentId,
  });
});

app.route('/single-documents', docs);

// -----------------------------------------------------------------------
// Chats
// -----------------------------------------------------------------------
const cr = new Hono<AppBindings>();
cr.get('/:id/messages', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const id = c.req.param('id');
  return c.json(await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.chatId, id)).orderBy(schema.chatMessages.createdAt).all());
});
cr.post('/:id/generate-title', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const id = c.req.param('id'); const body = await c.req.json();
  await db.update(schema.chats).set({ title: body.title }).where(eq(schema.chats.id, id)).run();
  return c.json({ ok: true });
});

// GET /chat — list user's own chats + chats in their projects
cr.get('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');

  const ownProjects = await db.select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId))
    .all();
  const ownProjectIds = ownProjects.map((p: any) => p.id);

  let chats;
  if (ownProjectIds.length > 0) {
    chats = await db.select().from(schema.chats)
      .where(or(
        eq(schema.chats.userId, userId),
        inArray(schema.chats.projectId, ownProjectIds)
      ))
      .orderBy(desc(schema.chats.createdAt))
      .all();
  } else {
    chats = await db.select().from(schema.chats)
      .where(eq(schema.chats.userId, userId))
      .orderBy(desc(schema.chats.createdAt))
      .all();
  }
  return c.json(chats);
});

// POST /chat/create — create new chat
cr.post('/create', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();
  const projectId = body.project_id || null;

  if (projectId) {
    const project = await db.select().from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId))).get();
    if (!project) return c.json({ error: 'Project not found' }, 404);
  }

  const chat = await db.insert(schema.chats).values({
    userId,
    projectId,
  }).returning().get();
  return c.json({ id: chat.id }, 201);
});

// GET /chat/:chatId — get chat + messages
cr.get('/:chatId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const chatId = c.req.param('chatId');

  const chat = await db.select().from(schema.chats)
    .where(eq(schema.chats.id, chatId)).get();
  if (!chat) return c.json({ error: 'Chat not found' }, 404);

  const canAccess = chat.userId === userId;
  if (!canAccess && chat.projectId) {
    const project = await db.select().from(schema.projects)
      .where(eq(schema.projects.id, chat.projectId)).get();
    if (!project || project.userId !== userId) {
      return c.json({ error: 'Chat not found' }, 404);
    }
  } else if (!canAccess) {
    return c.json({ error: 'Chat not found' }, 404);
  }

  const messages = await db.select().from(schema.chatMessages)
    .where(eq(schema.chatMessages.chatId, chatId))
    .orderBy(schema.chatMessages.createdAt)
    .all();

  return c.json({ chat, messages });
});

// PATCH /chat/:chatId — update title
cr.patch('/:chatId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const chatId = c.req.param('chatId');
  const body = await c.req.json();
  const title = (body.title || '').trim();

  if (!title) return c.json({ error: 'title is required' }, 400);

  const updated = await db.update(schema.chats)
    .set({ title })
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .returning().get();
  if (!updated) return c.json({ error: 'Chat not found' }, 404);
  return c.json({ id: updated.id, title: updated.title });
});

// DELETE /chat/:chatId — delete chat (owner only)
cr.delete('/:chatId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const chatId = c.req.param('chatId');

  await db.delete(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .run();
  return c.body(null, 204);
});

app.route('/chat', cr);

// -----------------------------------------------------------------------
// Workflows
// -----------------------------------------------------------------------
const wr = new Hono<AppBindings>();
wr.get('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId');
  return c.json(await db.select().from(schema.workflows).where(eq(schema.workflows.userId, userId)).orderBy(desc(schema.workflows.createdAt)).all());
});
wr.post('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId'); const body = await c.req.json();
  const wf = await db.insert(schema.workflows).values({ userId, title: body.title, type: body.type, promptMd: body.promptMd, columnsConfig: body.columnsConfig ? JSON.stringify(body.columnsConfig) : undefined, practice: body.practice }).returning().get();
  return c.json(wf, 201);
});

// GET /workflows/hidden
wr.get('/hidden', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const hidden = await db.select()
    .from(schema.hiddenWorkflows)
    .where(eq(schema.hiddenWorkflows.userId, userId))
    .all();
  return c.json(hidden.map((h: any) => h.workflowId));
});

// POST /workflows/hidden
wr.post('/hidden', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();
  if (!body.workflow_id?.trim()) return c.json({ error: 'workflow_id is required' }, 400);

  await db.insert(schema.hiddenWorkflows).values({
    userId,
    workflowId: body.workflow_id.trim(),
  }).run();
  return c.body(null, 204);
});

// DELETE /workflows/hidden/:workflowId
wr.delete('/hidden/:workflowId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const workflowId = c.req.param('workflowId');
  await db.delete(schema.hiddenWorkflows)
    .where(and(
      eq(schema.hiddenWorkflows.userId, userId),
      eq(schema.hiddenWorkflows.workflowId, workflowId)
    )).run();
  return c.body(null, 204);
});

// GET /workflows/:workflowId
wr.get('/:workflowId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const workflowId = c.req.param('workflowId');
  const wf = await db.select().from(schema.workflows)
    .where(eq(schema.workflows.id, workflowId)).get();
  if (!wf) return c.json({ error: 'Workflow not found' }, 404);
  return c.json(wf);
});

// PUT /workflows/:workflowId
wr.put('/:workflowId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const workflowId = c.req.param('workflowId');
  const body = await c.req.json();

  const updates: Record<string, any> = {};
  if (body.title != null) updates.title = body.title;
  if (body.promptMd != null) updates.promptMd = body.promptMd;
  if (body.columnsConfig != null) updates.columnsConfig = JSON.stringify(body.columnsConfig);
  if (body.practice !== undefined) updates.practice = body.practice ?? null;

  const updated = await db.update(schema.workflows)
    .set(updates)
    .where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.userId, userId)))
    .returning().get();
  if (!updated) return c.json({ error: 'Workflow not found' }, 404);
  return c.json(updated);
});

// PATCH /workflows/:workflowId
wr.patch('/:workflowId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const workflowId = c.req.param('workflowId');
  const body = await c.req.json();

  const updates: Record<string, any> = {};
  if (body.title != null) updates.title = body.title;
  if (body.promptMd != null) updates.promptMd = body.promptMd;
  if (body.columnsConfig != null) updates.columnsConfig = JSON.stringify(body.columnsConfig);
  if (body.practice !== undefined) updates.practice = body.practice ?? null;

  const updated = await db.update(schema.workflows)
    .set(updates)
    .where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.userId, userId)))
    .returning().get();
  if (!updated) return c.json({ error: 'Workflow not found' }, 404);
  return c.json(updated);
});

// DELETE /workflows/:workflowId
wr.delete('/:workflowId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const workflowId = c.req.param('workflowId');
  await db.delete(schema.workflows)
    .where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.userId, userId)))
    .run();
  return c.body(null, 204);
});

// GET /workflows/:workflowId/shares
wr.get('/:workflowId/shares', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const workflowId = c.req.param('workflowId');

  const wf = await db.select().from(schema.workflows)
    .where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.userId, userId))).get();
  if (!wf) return c.json({ error: 'Workflow not found' }, 404);

  const shares = await db.select()
    .from(schema.workflowShares)
    .where(eq(schema.workflowShares.workflowId, workflowId))
    .orderBy(schema.workflowShares.createdAt)
    .all();

  return c.json(shares.map((s: any) => ({
    id: s.id,
    sharedWithEmail: s.sharedWithEmail,
    allowEdit: !!s.allowEdit,
    createdAt: s.createdAt,
  })));
});

// POST /workflows/:workflowId/share
wr.post('/:workflowId/share', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const workflowId = c.req.param('workflowId');
  const body = await c.req.json();
  const emails = body.emails;

  if (!Array.isArray(emails) || emails.length === 0) {
    return c.json({ error: 'emails is required' }, 400);
  }

  const wf = await db.select().from(schema.workflows)
    .where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.userId, userId))).get();
  if (!wf) return c.json({ error: 'Workflow not found' }, 404);

  const normalizedEmails = [...new Set(
    emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean)
  )];

  if (userEmail && normalizedEmails.includes(userEmail.trim().toLowerCase())) {
    return c.json({ error: 'You cannot share a workflow with yourself' }, 400);
  }

  for (const email of normalizedEmails) {
    // Delete first for upsert behavior
    await db.delete(schema.workflowShares)
      .where(and(
        eq(schema.workflowShares.workflowId, workflowId),
        eq(schema.workflowShares.sharedWithEmail, email)
      )).run();
    await db.insert(schema.workflowShares).values({
      workflowId,
      sharedByUserId: userId,
      sharedWithEmail: email,
      allowEdit: body.allow_edit ? 1 : 0,
    }).run();
  }
  return c.body(null, 204);
});

// DELETE /workflows/:workflowId/shares/:shareId
wr.delete('/:workflowId/shares/:shareId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const workflowId = c.req.param('workflowId');
  const shareId = c.req.param('shareId');

  const wf = await db.select().from(schema.workflows)
    .where(and(eq(schema.workflows.id, workflowId), eq(schema.workflows.userId, userId))).get();
  if (!wf) return c.json({ error: 'Workflow not found' }, 404);

  await db.delete(schema.workflowShares)
    .where(and(
      eq(schema.workflowShares.id, shareId),
      eq(schema.workflowShares.workflowId, workflowId)
    )).run();
  return c.body(null, 204);
});

app.route('/workflows', wr);

// -----------------------------------------------------------------------
// Tabular Reviews (new CRUD routes under /tabular)
// -----------------------------------------------------------------------
const tabularRoutes = new Hono<{ Bindings: Env }>();

// GET /tabular/reviews — list user's reviews
tabularRoutes.get('/reviews', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  return c.json(await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.userId, userId))
    .orderBy(desc(schema.tabularReviews.createdAt)).all());
});

// POST /tabular/reviews — create
tabularRoutes.post('/reviews', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();
  const review = await db.insert(schema.tabularReviews).values({
    userId, title: body.title, projectId: body.projectId,
    columnsConfig: body.columnsConfig ? JSON.stringify(body.columnsConfig) : undefined,
    documentIds: body.documentIds ? JSON.stringify(body.documentIds) : undefined,
    workflowId: body.workflowId, practice: body.practice,
  }).returning().get();
  return c.json(review, 201);
});

// GET /tabular/reviews/:id
tabularRoutes.get('/reviews/:id', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const review = await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.id, c.req.param('id'))).get();
  if (!review) return c.json({ error: 'Not found' }, 404);
  const cells = await db.select().from(schema.tabularCells)
    .where(eq(schema.tabularCells.reviewId, review.id)).all();
  return c.json({ ...review, cells });
});

// PATCH /tabular/reviews/:id
tabularRoutes.patch('/reviews/:id', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const updated = await db.update(schema.tabularReviews).set({ ...body, updatedAt: Date.now() })
    .where(eq(schema.tabularReviews.id, c.req.param('id'))).returning().get();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

// DELETE /tabular/reviews/:id
tabularRoutes.delete('/reviews/:id', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  await db.delete(schema.tabularReviews).where(eq(schema.tabularReviews.id, c.req.param('id'))).run();
  return c.json({ ok: true });
});

// POST /tabular/reviews/:id/cells — update cell content
tabularRoutes.post('/reviews/:id/cells', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const { cells } = body as { cells: Array<{ documentId: string; columnIndex: number; content?: string; citations?: string; status?: string }> };
  if (!cells?.length) return c.json({ error: 'cells required' }, 400);
  const reviewId = c.req.param('id');
  const results = [];
  for (const cell of cells) {
    const existing = await db.select().from(schema.tabularCells)
      .where(and(eq(schema.tabularCells.reviewId, reviewId), eq(schema.tabularCells.documentId, cell.documentId), eq(schema.tabularCells.columnIndex, cell.columnIndex))).get();
    if (existing) {
      results.push(await db.update(schema.tabularCells).set({ content: cell.content, citations: cell.citations, status: (cell.status as any) || 'pending' })
        .where(eq(schema.tabularCells.id, existing.id)).returning().get());
    } else {
      results.push(await db.insert(schema.tabularCells).values({ reviewId, documentId: cell.documentId, columnIndex: cell.columnIndex, content: cell.content, citations: cell.citations, status: (cell.status as any) || 'pending' }).returning().get());
    }
  }
  return c.json(results);
});

// Tabular review chats
tabularRoutes.get('/reviews/:id/chats', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  return c.json(await db.select().from(schema.tabularReviewChats)
    .where(eq(schema.tabularReviewChats.reviewId, c.req.param('id')))
    .orderBy(desc(schema.tabularReviewChats.createdAt)).all());
});

tabularRoutes.get('/reviews/:id/chats/:chatId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const chat = await db.select().from(schema.tabularReviewChats)
    .where(eq(schema.tabularReviewChats.id, c.req.param('chatId'))).get();
  if (!chat) return c.json({ error: 'Not found' }, 404);
  const messages = await db.select().from(schema.tabularReviewChatMessages)
    .where(eq(schema.tabularReviewChatMessages.chatId, chat.id))
    .orderBy(schema.tabularReviewChatMessages.createdAt).all();
  return c.json({ ...chat, messages });
});

app.route('/tabular', tabularRoutes);

// -----------------------------------------------------------------------
// CaseLaw
// -----------------------------------------------------------------------
app.post('/case-law/case-opinions', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const clusterId = body.clusterId ?? body.cluster_id;
    if (!clusterId) return c.json({ error: 'cluster_id is required' }, 400);
    // Simplified — returns empty list; full CourtListener integration
    // requires the courtlistener lib which has Node dependencies
    return c.json({ opinions: [] });
  } catch (e: any) {
    return c.json({ error: e.message }, 502);
  }
});

// -----------------------------------------------------------------------
// Downloads
// -----------------------------------------------------------------------
app.get('/download/:token', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const token = c.req.param('token');

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return c.json({ error: 'Invalid link' }, 404);

    const enc = parts[0];
    const decoded = JSON.parse(atob(enc.replace(/-/g, '+').replace(/_/g, '/')));
    const storagePath: string = decoded.p;
    const filename: string = decoded.f || 'file';

    if (!storagePath) return c.json({ error: 'Invalid link' }, 404);

    // Verify storage path exists as a document version
    const ver = await db.select().from(schema.documentVersions)
      .where(eq(schema.documentVersions.storagePath, storagePath))
      .get();

    if (!ver) return c.json({ error: 'File not found' }, 404);

    const obj = await r2.get(storagePath);
    if (!obj) return c.json({ error: 'File not found' }, 404);

    const contentType = filename.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : filename.toLowerCase().endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/octet-stream';

    return new Response(obj.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return c.json({ error: 'Invalid link' }, 404);
  }
});

// -----------------------------------------------------------------------
// TanStack AI — streaming chat
// -----------------------------------------------------------------------
app.post('/api/chat/stream', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { messages, model, apiKeys } = body as {
      messages: UIMessage[];
      model?: string;
      apiKeys?: Record<string, string>;
    };

    if (!messages?.length) return c.json({ error: 'messages required' }, 400);

    const modelName = model || 'claude-sonnet-4-20250514';
    let adapter: any;

    if (modelName.includes('claude') || modelName.includes('anthropic')) {
      adapter = anthropicText(modelName, {
        apiKey: apiKeys?.claude || apiKeys?.anthropic,
      });
    } else if (modelName.includes('gemini')) {
      adapter = geminiText(modelName, {
        apiKey: apiKeys?.gemini,
      });
    } else if (modelName.includes('gpt') || modelName.includes('o1') || modelName.includes('o3')) {
      adapter = openaiText(modelName, {
        apiKey: apiKeys?.openai,
      });
    } else {
      adapter = openaiText(modelName, {
        apiKey: apiKeys?.openrouter || apiKeys?.openai,
        baseUrl: modelName.includes('openrouter') || apiKeys?.openrouter
          ? 'https://openrouter.ai/api/v1' : undefined,
      });
    }

    const systemPrompt = 'Ești un asistent juridic expert în legislația românească. ' +
      'Ajuți utilizatorii să găsească informații legale, să analizeze documente și ' +
      'să pregătească documente juridice. Răspunde în limba în care utilizatorul ' +
      'scrie. Fii precis, citează articole de lege când e relevant.';

    const result = await chat({
      adapter,
      messages,
      system: systemPrompt,
      maxTokens: 8192,
    });

    return toServerSentEventsResponse(result);
  } catch (e: any) {
    console.error('[chat/stream] error:', e);
    return c.json({ error: e.message || 'Stream error' }, 500);
  }
});

// -----------------------------------------------------------------------
// Tabular Reviews
// -----------------------------------------------------------------------
const tr = new Hono<AppBindings>();

// GET /tabular-review
tr.get('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const projectId = c.req.query('project_id') || null;

  // Own reviews + reviews in projects user has access to
  // For simplicity, fetch own reviews + reviews in user's projects
  const ownReviews = await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.userId, userId))
    .orderBy(desc(schema.tabularReviews.createdAt))
    .all();

  // Also fetch reviews in user's projects
  const myProjects = await db.select({ id: schema.projects.id })
    .from(schema.projects)
    .where(eq(schema.projects.userId, userId))
    .all();
  const myProjectIds = myProjects.map((p: any) => p.id);

  let sharedReviews: any[] = [];
  if (myProjectIds.length > 0) {
    let q: any = db.select().from(schema.tabularReviews)
      .where(inArray(schema.tabularReviews.projectId, myProjectIds));
    if (projectId) q = q.where(eq(schema.tabularReviews.projectId, projectId));
    sharedReviews = await q.orderBy(desc(schema.tabularReviews.createdAt)).all();
  }

  // Filter by project_id if specified
  const allReviews = projectId
    ? [...ownReviews, ...sharedReviews].filter(
        (r: any) => r.projectId === projectId || (projectId && r.projectId === null && false)
      )
    : [...ownReviews, ...sharedReviews];

  // Deduplicate
  const seen = new Set<string>();
  const reviews: any[] = [];
  for (const r of allReviews) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    reviews.push(r);
  }

  // Get document counts per review
  const reviewIds = reviews.map((r: any) => r.id);
  let docCounts: Record<string, number> = {};
  if (reviewIds.length > 0) {
    const cells = await db.select()
      .from(schema.tabularCells)
      .where(inArray(schema.tabularCells.reviewId, reviewIds))
      .all();
    const docCountMap = new Map<string, Set<string>>();
    for (const cell of cells) {
      if (!docCountMap.has(cell.reviewId)) docCountMap.set(cell.reviewId, new Set());
      docCountMap.get(cell.reviewId)!.add(cell.documentId);
    }
    for (const [reviewId, docs] of docCountMap) {
      docCounts[reviewId] = docs.size;
    }
  }

  return c.json(reviews.map((r: any) => ({ ...r, document_count: docCounts[r.id] || 0 })));
});

// POST /tabular-review — create review
tr.post('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const body = await c.req.json();
  const { title, document_ids, columns_config, workflow_id, project_id } = body;

  if (!Array.isArray(document_ids) || document_ids.length === 0) {
    return c.json({ error: 'document_ids is required' }, 400);
  }
  if (!Array.isArray(columns_config) || columns_config.length === 0) {
    return c.json({ error: 'columns_config is required' }, 400);
  }

  // Verify document access
  const myDocs = await db.select({ id: schema.documents.id })
    .from(schema.documents)
    .where(and(
      inArray(schema.documents.id, document_ids),
      eq(schema.documents.userId, userId)
    ))
    .all();
  const allowedIds = myDocs.map((d: any) => d.id);

  if (allowedIds.length === 0) {
    return c.json({ error: 'No accessible documents' }, 400);
  }

  const review = await db.insert(schema.tabularReviews).values({
    userId,
    title: title || null,
    columnsConfig: JSON.stringify(columns_config),
    documentIds: JSON.stringify(allowedIds),
    projectId: project_id || null,
    workflowId: workflow_id || null,
  }).returning().get();

  // Create cells
  const cells = allowedIds.flatMap((docId: string) =>
    columns_config.map((col: any) => ({
      reviewId: review.id,
      documentId: docId,
      columnIndex: col.index,
      status: 'pending' as const,
    }))
  );
  if (cells.length > 0) {
    await db.insert(schema.tabularCells).values(cells).run();
  }

  return c.json(review, 201);
});

// GET /tabular-review/:reviewId
tr.get('/:reviewId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const reviewId = c.req.param('reviewId');
  const review = await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.id, reviewId)).get();
  if (!review) return c.json({ error: 'Not found' }, 404);

  const cells = await db.select().from(schema.tabularCells)
    .where(eq(schema.tabularCells.reviewId, reviewId))
    .orderBy(schema.tabularCells.columnIndex)
    .all();

  return c.json({ ...review, cells });
});

// DELETE /tabular-review/:reviewId
tr.delete('/:reviewId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const reviewId = c.req.param('reviewId');

  const review = await db.select().from(schema.tabularReviews)
    .where(and(eq(schema.tabularReviews.id, reviewId), eq(schema.tabularReviews.userId, userId))).get();
  if (!review) return c.json({ error: 'Not found' }, 404);

  await db.delete(schema.tabularReviews).where(eq(schema.tabularReviews.id, reviewId)).run();
  return c.body(null, 204);
});

// PATCH /tabular-review/:reviewId
tr.patch('/:reviewId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const reviewId = c.req.param('reviewId');
  const body = await c.req.json();

  const review = await db.select().from(schema.tabularReviews)
    .where(and(eq(schema.tabularReviews.id, reviewId), eq(schema.tabularReviews.userId, userId))).get();
  if (!review) return c.json({ error: 'Not found' }, 404);

  const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.columnsConfig !== undefined) updates.columnsConfig = JSON.stringify(body.columnsConfig);
  if (body.documentIds !== undefined) updates.documentIds = JSON.stringify(body.documentIds);
  if (body.practice !== undefined) updates.practice = body.practice ?? null;

  const updated = await db.update(schema.tabularReviews)
    .set(updates)
    .where(eq(schema.tabularReviews.id, reviewId))
    .returning().get();
  return c.json(updated);
});

// GET /tabular-review/:reviewId/people
tr.get('/:reviewId/people', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const reviewId = c.req.param('reviewId');
  const review = await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.id, reviewId)).get();
  if (!review) return c.json({ error: 'Not found' }, 404);

  let sharedWith: string[] = [];
  try { sharedWith = JSON.parse(review.sharedWith || '[]'); } catch {}

  return c.json({
    owner: { userId: review.userId, email: null, displayName: null },
    members: sharedWith.map((email: string) => ({ email, displayName: null })),
  });
});

// PATCH /tabular-review/:reviewId/cells/:cellId
tr.patch('/:reviewId/cells/:cellId', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const reviewId = c.req.param('reviewId');
  const cellId = c.req.param('cellId');
  const body = await c.req.json();

  const updates: Record<string, any> = {};
  if (body.content !== undefined) updates.content = body.content;
  if (body.citations !== undefined) updates.citations = body.citations;
  if (body.status !== undefined) updates.status = body.status;

  const updated = await db.update(schema.tabularCells)
    .set(updates)
    .where(and(eq(schema.tabularCells.id, cellId), eq(schema.tabularCells.reviewId, reviewId)))
    .returning().get();
  if (!updated) return c.json({ error: 'Cell not found' }, 404);
  return c.json(updated);
});

// GET /tabular-review/:reviewId/cells
tr.get('/:reviewId/cells', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const reviewId = c.req.param('reviewId');
  const cells = await db.select().from(schema.tabularCells)
    .where(eq(schema.tabularCells.reviewId, reviewId))
    .orderBy(schema.tabularCells.columnIndex)
    .all();
  return c.json(cells);
});

// POST /tabular-review/:reviewId/chat/create
tr.post('/:reviewId/chat/create', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const reviewId = c.req.param('reviewId');
  const body = await c.req.json();

  const review = await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.id, reviewId)).get();
  if (!review) return c.json({ error: 'Review not found' }, 404);

  const chat = await db.insert(schema.tabularReviewChats).values({
    reviewId,
    userId,
    title: body.title || null,
  }).returning().get();
  return c.json({ id: chat.id }, 201);
});

// GET /tabular-review/:reviewId/chats
tr.get('/:reviewId/chats', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const reviewId = c.req.param('reviewId');
  const chats = await db.select().from(schema.tabularReviewChats)
    .where(eq(schema.tabularReviewChats.reviewId, reviewId))
    .orderBy(desc(schema.tabularReviewChats.createdAt))
    .all();
  return c.json(chats);
});

// GET /tabular-review/:reviewId/chat/:chatId/messages
tr.get('/:reviewId/chat/:chatId/messages', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const chatId = c.req.param('chatId');
  const messages = await db.select().from(schema.tabularReviewChatMessages)
    .where(eq(schema.tabularReviewChatMessages.chatId, chatId))
    .orderBy(schema.tabularReviewChatMessages.createdAt)
    .all();
  return c.json(messages);
});

app.route('/tabular-review', tr);

// -----------------------------------------------------------------------
// Project chat streaming
// -----------------------------------------------------------------------
app.post('/projects/:projectId/chat', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const { messages, model, chat_id } = body as {
    messages: any[];
    model?: string;
    chat_id?: string;
  };

  // Verify project access
  const project = await db.select().from(schema.projects)
    .where(eq(schema.projects.id, projectId)).get();
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const isOwner = project.userId === userId;
  let sharedWith: string[] = [];
  try { sharedWith = JSON.parse(project.sharedWith || '[]'); } catch {}
  const isShared = userEmail && sharedWith.includes(userEmail.toLowerCase());
  if (!isOwner && !isShared) return c.json({ error: 'Project not found' }, 404);

  // Get or create chat
  let chatId = chat_id || null;
  let chatTitle: string | null = null;

  if (chatId) {
    const existingChat = await db.select().from(schema.chats)
      .where(and(eq(schema.chats.id, chatId), eq(schema.chats.projectId, projectId))).get();
    if (!existingChat) chatId = null;
    else chatTitle = existingChat.title;
  }

  if (!chatId) {
    const newChat = await db.insert(schema.chats).values({
      userId,
      projectId,
    }).returning().get();
    chatId = newChat.id;
  }

  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
  if (lastUser) {
    await db.insert(schema.chatMessages).values({
      chatId,
      role: 'user',
      content: lastUser.content,
      files: lastUser.files ? JSON.stringify(lastUser.files) : null,
    }).run();
  }

  // Project docs context
  const projectDocs = await db.select().from(schema.documents)
    .where(eq(schema.documents.projectId, projectId))
    .all();

  const docContext = projectDocs.map((d: any) => ({
    doc_id: d.id,
    filename: d.status,
  }));

  // Use TanStack AI (non-streaming) to get the full response
  const modelName = model || 'claude-sonnet-4-20250514';
  let adapter: any;

  if (modelName.includes('claude') || modelName.includes('anthropic')) {
    adapter = anthropicText(modelName, { apiKey: body.apiKeys?.claude });
  } else if (modelName.includes('gemini')) {
    adapter = geminiText(modelName, { apiKey: body.apiKeys?.gemini });
  } else {
    adapter = openaiText(modelName, {
      apiKey: body.apiKeys?.openai || body.apiKeys?.openrouter,
      baseUrl: body.apiKeys?.openrouter ? 'https://openrouter.ai/api/v1' : undefined,
    });
  }

  const systemPrompt = `Ești un asistent juridic expert în legislația românească. Ajuți utilizatorii să analizeze documente și să pregătească documente juridice. Răspunde în limba în care utilizatorul scrie.

PROJECT CONTEXT:
You are operating within project "${project.name}". Available documents:
${docContext.map((d: any) => `- ${d.doc_id}: ${d.filename}`).join('\n')}

Use the context above to help the user with their project documents.`;

  // @ts-ignore
  const fullText: string = await chat({
    adapter,
    stream: false,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
    system: systemPrompt,
    maxTokens: 8192,
  });

  await db.insert(schema.chatMessages).values({
    chatId,
    role: 'assistant',
    content: fullText,
  }).run();

  // Generate title from first message
  if (!chatTitle && lastUser?.content) {
    const title = lastUser.content.slice(0, 120);
    await db.update(schema.chats)
      .set({ title })
      .where(eq(schema.chats.id, chatId))
      .run();
  }

  // Stream as SSE
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  c.executionCtx.waitUntil((async () => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'chat_id', chatId })}\n\n`));
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'content_delta', text: fullText })}\n\n`));
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      console.error('[projectChat] stream error:', e);
    } finally {
      await writer.close();
    }
  })());

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// -----------------------------------------------------------------------
// Tabular review streaming chat
// -----------------------------------------------------------------------
app.post('/tabular-review/:reviewId/chat', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const reviewId = c.req.param('reviewId');
  const body = await c.req.json();
  const { messages, model } = body;

  const review = await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.id, reviewId)).get();
  if (!review) return c.json({ error: 'Review not found' }, 404);

  // Get or create chat
  let chatId = body.chat_id || null;
  if (chatId) {
    const existing = await db.select().from(schema.tabularReviewChats)
      .where(and(eq(schema.tabularReviewChats.id, chatId), eq(schema.tabularReviewChats.reviewId, reviewId))).get();
    if (!existing) chatId = null;
  }

  if (!chatId) {
    const newChat = await db.insert(schema.tabularReviewChats).values({
      reviewId,
      userId,
    }).returning().get();
    chatId = newChat.id;
  }

  const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
  if (lastUser) {
    await db.insert(schema.tabularReviewChatMessages).values({
      chatId,
      role: 'user',
      content: lastUser.content,
    }).run();
  }

  // TanStack AI non-streaming
  const modelName = model || 'gemini-3-flash-preview';
  let adapter: any;
  if (modelName.includes('gemini')) {
    adapter = geminiText(modelName, { apiKey: body.apiKeys?.gemini });
  } else if (modelName.includes('claude')) {
    adapter = anthropicText(modelName, { apiKey: body.apiKeys?.claude });
  } else {
    adapter = openaiText(modelName, { apiKey: body.apiKeys?.openai });
  }

  const reviewInfo = `Tabular Review: ${review.title || 'Untitled'}`;
  // @ts-ignore
  const fullText: string = await chat({
    adapter,
    stream: false,
    messages,
    system: `Ești un asistent juridic expert. Ajuți utilizatorul să analizeze documente în cadrul unui review tabular.\n\n${reviewInfo}`,
    maxTokens: 4096,
  });

  await db.insert(schema.tabularReviewChatMessages).values({
    chatId,
    role: 'assistant',
    content: fullText,
  }).run();

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  c.executionCtx.waitUntil((async () => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'content_delta', text: fullText })}\n\n`));
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      console.error('[tabularChat] stream error:', e);
    } finally {
      await writer.close();
    }
  })());

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// -----------------------------------------------------------------------
// Tabular review generate endpoint
// -----------------------------------------------------------------------
app.post('/tabular-review/:reviewId/generate', requireAuth, async (c) => {
  const db = getDb(c.env.DB);
  const r2 = c.env.R2;
  const userId = c.get('userId');
  const reviewId = c.req.param('reviewId');
  const body = await c.req.json();
  const { columns, model } = body;

  const review = await db.select().from(schema.tabularReviews)
    .where(eq(schema.tabularReviews.id, reviewId)).get();
  if (!review) return c.json({ error: 'Review not found' }, 404);

  let docIds: string[] = [];
  try { docIds = JSON.parse(review.documentIds || '[]'); } catch {}

  if (docIds.length === 0) return c.json({ error: 'No documents in review' }, 400);

  const docs = await db.select().from(schema.documents)
    .where(inArray(schema.documents.id, docIds))
    .all();

  const columnList = Array.isArray(columns) ? columns : [];
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  c.executionCtx.waitUntil((async () => {
    try {
      for (const doc of docs as any[]) {
        // Get document text via R2
        let docText = '';
        if (doc.currentVersionId) {
          const ver = await db.select().from(schema.documentVersions)
            .where(eq(schema.documentVersions.id, doc.currentVersionId)).get();
          if (ver) {
            const obj = await r2.get(ver.storagePath);
            if (obj) {
              const buf = await obj.arrayBuffer();
              docText = new TextDecoder().decode(buf).slice(0, 10000);
            }
          }
        }

        for (const col of columnList) {
          const prompt = col.prompt
            ? `${col.prompt}\n\nDocument content:\n${docText.slice(0, 4000)}`
            : `Based on this document, provide a ${col.name} analysis.\n\nDocument: ${docText.slice(0, 4000)}`;

          const modelName = model || 'gemini-3-flash-preview';
          let adapter: any;
          if (modelName.includes('gemini')) {
            adapter = geminiText(modelName, { apiKey: body.apiKeys?.gemini });
          } else {
            adapter = openaiText(modelName, { apiKey: body.apiKeys?.openai });
          }

          // @ts-ignore
          const content: string = await chat({
            adapter,
            stream: false,
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 1024,
          });

          // Upsert cell
          const existingCell = await db.select().from(schema.tabularCells)
            .where(and(
              eq(schema.tabularCells.reviewId, reviewId),
              eq(schema.tabularCells.documentId, doc.id),
              eq(schema.tabularCells.columnIndex, col.index)
            )).get();

          if (existingCell) {
            await db.update(schema.tabularCells)
              .set({ content, citations: null, status: 'completed' })
              .where(eq(schema.tabularCells.id, existingCell.id))
              .run();
          } else {
            await db.insert(schema.tabularCells).values({
              reviewId,
              documentId: doc.id,
              columnIndex: col.index,
              content,
              status: 'completed',
            }).run();
          }

          await writer.write(encoder.encode(`data: ${JSON.stringify({
            type: 'cell_complete',
            documentId: doc.id,
            columnIndex: col.index,
            content,
          })}\n\n`));
        }
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (e) {
      console.error('[generate] error:', e);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(e) })}\n\n`));
    } finally {
      await writer.close();
    }
  })());

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
});

// -----------------------------------------------------------------------
// Tabular review prompt generation
// -----------------------------------------------------------------------
app.post('/tabular-review/prompt', requireAuth, async (c) => {
  const body = await c.req.json();
  const title = (body.title || '').trim();
  if (!title) return c.json({ error: 'title is required' }, 400);

  const format: string = body.format || 'text';
  const documentName: string = (body.documentName || '').trim();
  const tags: string[] = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [];

  const formatDescriptions: Record<string, string> = {
    text: 'free-form text',
    bulleted_list: 'a bulleted list',
    number: 'a single number',
    percentage: 'a percentage value',
    monetary_amount: 'a monetary amount',
    currency: 'a currency code',
    yes_no: 'Yes or No',
    date: 'a date',
    tag: tags.length ? `one of these tags: ${tags.join(', ')}` : 'a tag',
  };
  const formatHint = formatDescriptions[format] || 'free-form text';
  const tagsNote = format === 'tag' && tags.length ? `\nAvailable tags: ${tags.join(', ')}` : '';
  const docNote = documentName ? `\nDocument type/name: ${documentName}` : '';

  const prompt = `You are a legal document reviewer. For each document, output ${formatHint} based on the column title "${title}".${tagsNote}${docNote}`;
  return c.json({ prompt });
});

export default app;
