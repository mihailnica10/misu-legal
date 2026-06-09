import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SignJWT, jwtVerify } from 'jose';
import { getDb } from './db';
import * as schema from './db/schema';
import { eq, desc } from 'drizzle-orm';

export type Env = {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  JWT_SECRET?: string;
  FRONTEND_URL?: string;
  ENVIRONMENT?: string;
};

const JWT_ALG = 'HS256';
const JWT_EXPIRES = '7d';

const app = new Hono<{ Bindings: Env }>();

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
      .where(eq(schema.account.userId, user.id))
      .where(eq(schema.account.providerId, 'credential')).get();

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
const users = new Hono<{ Bindings: Env }>();
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
app.route('/user', users);
app.route('/users', users);

// -----------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------
const projectsRoutes = new Hono<{ Bindings: Env }>();
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
app.route('/projects', projectsRoutes);

// -----------------------------------------------------------------------
// Documents
// -----------------------------------------------------------------------
const docs = new Hono<{ Bindings: Env }>();
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
app.route('/single-documents', docs);

// -----------------------------------------------------------------------
// Chats
// -----------------------------------------------------------------------
const cr = new Hono<{ Bindings: Env }>();
cr.get('/:id/messages', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const id = c.req.param('id');
  return c.json(await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.chatId, id)).orderBy(schema.chatMessages.createdAt).all());
});
cr.post('/:id/generate-title', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const id = c.req.param('id'); const body = await c.req.json();
  await db.update(schema.chats).set({ title: body.title }).where(eq(schema.chats.id, id)).run();
  return c.json({ ok: true });
});
app.route('/chat', cr);

// -----------------------------------------------------------------------
// Workflows
// -----------------------------------------------------------------------
const wr = new Hono<{ Bindings: Env }>();
wr.get('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId');
  return c.json(await db.select().from(schema.workflows).where(eq(schema.workflows.userId, userId)).orderBy(desc(schema.workflows.createdAt)).all());
});
wr.post('/', requireAuth, async (c) => {
  const db = getDb(c.env.DB); const userId = c.get('userId'); const body = await c.req.json();
  const wf = await db.insert(schema.workflows).values({ userId, title: body.title, type: body.type, promptMd: body.promptMd, columnsConfig: body.columnsConfig ? JSON.stringify(body.columnsConfig) : undefined, practice: body.practice }).returning().get();
  return c.json(wf, 201);
});
app.route('/workflows', wr);

export default app;
