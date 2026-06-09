1|/**
2| * Mike API client — all requests to the Node.js backend.
3| * Attaches the Supabase auth token for user authentication.
4| */
5|
6|7|import type {
8|    AssistantEvent,
9|    Chat,
10|    ChatDetailOut,
11|    CitationAnnotation,
12|    Document,
13|    Folder,
14|    Message,
15|    Project,
16|    Workflow,
17|    TabularReview,
18|    TabularReviewDetailOut,
19|} from "@/app/components/shared/types";
20|
21|// Server-side shape before mapping
22|interface ServerMessage {
23|    id: string;
24|    chat_id: string;
25|    role: "user" | "assistant";
26|    content: string | AssistantEvent[] | null;
27|    files?: { filename: string; document_id?: string }[] | null;
28|    workflow?: { id: string; title: string } | null;
29|    annotations?: CitationAnnotation[] | null;
30|    created_at: string;
31|}
32|interface ServerChatDetailOut {
33|    chat: Chat;
34|    messages: ServerMessage[];
35|}
36|
37|const API_BASE =
38|    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
39|
40|async function getAuthHeader(): Promise<Record<string, string>> {
41|    const {
42|        data: { session },
43|    } = await supabase.auth.getSession();
44|    if (!session?.access_token) return {};
45|    return { Authorization: `Bearer ${session.access_token}` };
46|}
47|
48|async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
49|    const authHeaders = await getAuthHeader();
50|    const { headers: initHeaders, ...restInit } = init ?? {};
51|    const response = await fetch(`${API_BASE}${path}`, {
52|        cache: "no-store",
53|        ...restInit,
54|        headers: {
55|            Accept: "application/json",
56|            ...authHeaders,
57|            ...(initHeaders as Record<string, string> | undefined),
58|        },
59|    });
60|
61|    if (!response.ok) {
62|        const detail = await response.text();
63|        throw new Error(detail || `API error: ${response.status}`);
64|    }
65|
66|    if (
67|        response.status === 204 ||
68|        response.headers.get("content-length") === "0"
69|    ) {
70|        return undefined as T;
71|    }
72|
73|    return (await response.json()) as T;
74|}
75|
76|// ---------------------------------------------------------------------------
77|// Projects
78|// ---------------------------------------------------------------------------
79|
80|export async function listProjects(): Promise<Project[]> {
81|    return apiRequest<Project[]>("/projects");
82|}
83|
84|export async function createProject(
85|    name: string,
86|    cm_number?: string,
87|    shared_with?: string[],
88|): Promise<Project> {
89|    return apiRequest<Project>("/projects", {
90|        method: "POST",
91|        headers: { "Content-Type": "application/json" },
92|        body: JSON.stringify({ name, cm_number, shared_with }),
93|    });
94|}
95|
96|export async function deleteAccount(): Promise<void> {
97|    return apiRequest<void>("/user/account", { method: "DELETE" });
98|}
99|
100|export interface UserProfile {
101|    displayName: string | null;
102|    organisation: string | null;
103|    messageCreditsUsed: number;
104|    creditsResetDate: string;
105|    creditsRemaining: number;
106|    tier: string;
107|    titleModel: string;
108|    tabularModel: string;
109|    apiKeyStatus: ApiKeyStatus;
110|}
111|
112|export async function getUserProfile(): Promise<UserProfile> {
113|    return apiRequest<UserProfile>("/user/profile");
114|}
115|
116|export async function updateUserProfile(payload: {
117|    displayName?: string | null;
118|    organisation?: string | null;
119|    titleModel?: string;
120|    tabularModel?: string;
121|}): Promise<UserProfile> {
122|    return apiRequest<UserProfile>("/user/profile", {
123|        method: "PATCH",
124|        headers: { "Content-Type": "application/json" },
125|        body: JSON.stringify(payload),
126|    });
127|}
128|
129|export type ApiKeyProvider =
130|    | "claude"
131|    | "gemini"
132|    | "openai"
133|    | "openrouter"
134|    | "courtlistener";
135|export type ApiKeySource = "user" | "env" | null;
136|export type ApiKeyState = Record<
137|    ApiKeyProvider,
138|    {
139|        configured: boolean;
140|        source: ApiKeySource;
141|    }
142|>;
143|
144|export type ApiKeyStatus = Record<ApiKeyProvider, boolean> & {
145|    sources?: Partial<Record<ApiKeyProvider, ApiKeySource>>;
146|};
147|
148|export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
149|    return apiRequest<ApiKeyStatus>("/user/api-keys");
150|}
151|
152|export async function saveApiKey(
153|    provider: ApiKeyProvider,
154|    apiKey: string | null,
155|): Promise<ApiKeyStatus> {
156|    return apiRequest<ApiKeyStatus>(`/user/api-keys/${provider}`, {
157|        method: "PUT",
158|        headers: { "Content-Type": "application/json" },
159|        body: JSON.stringify({ api_key: apiKey }),
160|    });
161|}
162|
163|export async function getProject(projectId: string): Promise<Project> {
164|    return apiRequest<Project>(`/projects/${projectId}`);
165|}
166|
167|export async function updateProject(
168|    projectId: string,
169|    payload: {
170|        name?: string;
171|        cm_number?: string;
172|        shared_with?: string[];
173|    },
174|): Promise<Project> {
175|    return apiRequest<Project>(`/projects/${projectId}`, {
176|        method: "PATCH",
177|        headers: { "Content-Type": "application/json" },
178|        body: JSON.stringify(payload),
179|    });
180|}
181|
182|export async function deleteProject(projectId: string): Promise<void> {
183|    await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
184|}
185|
186|export interface ProjectPeople {
187|    owner: {
188|        user_id: string;
189|        email: string | null;
190|        display_name: string | null;
191|    };
192|    members: { email: string; display_name: string | null }[];
193|}
194|
195|export async function getProjectPeople(
196|    projectId: string,
197|): Promise<ProjectPeople> {
198|    return apiRequest<ProjectPeople>(`/projects/${projectId}/people`);
199|}
200|
201|// ---------------------------------------------------------------------------
202|// Documents
203|// ---------------------------------------------------------------------------
204|
205|// ---------------------------------------------------------------------------
206|// Folders
207|// ---------------------------------------------------------------------------
208|
209|export async function createProjectFolder(
210|    projectId: string,
211|    name: string,
212|    parentFolderId?: string | null,
213|): Promise<Folder> {
214|    return apiRequest<Folder>(`/projects/${projectId}/folders`, {
215|        method: "POST",
216|        headers: { "Content-Type": "application/json" },
217|        body: JSON.stringify({
218|            name,
219|            parent_folder_id: parentFolderId ?? null,
220|        }),
221|    });
222|}
223|
224|export async function renameProjectFolder(
225|    projectId: string,
226|    folderId: string,
227|    name: string,
228|): Promise<Folder> {
229|    return apiRequest<Folder>(
230|        `/projects/${projectId}/folders/${folderId}`,
231|        {
232|            method: "PATCH",
233|            headers: { "Content-Type": "application/json" },
234|            body: JSON.stringify({ name }),
235|        },
236|    );
237|}
238|
239|export async function deleteProjectFolder(
240|    projectId: string,
241|    folderId: string,
242|): Promise<void> {
243|    await apiRequest(`/projects/${projectId}/folders/${folderId}`, {
244|        method: "DELETE",
245|    });
246|}
247|
248|export async function moveSubfolderToFolder(
249|    projectId: string,
250|    folderId: string,
251|    parentFolderId: string | null,
252|): Promise<Folder> {
253|    return apiRequest<Folder>(
254|        `/projects/${projectId}/folders/${folderId}`,
255|        {
256|            method: "PATCH",
257|            headers: { "Content-Type": "application/json" },
258|            body: JSON.stringify({ parent_folder_id: parentFolderId }),
259|        },
260|    );
261|}
262|
263|export async function moveDocumentToFolder(
264|    projectId: string,
265|    documentId: string,
266|    folderId: string | null,
267|): Promise<Document> {
268|    return apiRequest<Document>(
269|        `/projects/${projectId}/documents/${documentId}/folder`,
270|        {
271|            method: "PATCH",
272|            headers: { "Content-Type": "application/json" },
273|            body: JSON.stringify({ folder_id: folderId }),
274|        },
275|    );
276|}
277|
278|export async function renameProjectDocument(
279|    projectId: string,
280|    documentId: string,
281|    filename: string,
282|): Promise<Document> {
283|    return apiRequest<Document>(
284|        `/projects/${projectId}/documents/${documentId}`,
285|        {
286|            method: "PATCH",
287|            headers: { "Content-Type": "application/json" },
288|            body: JSON.stringify({ filename }),
289|        },
290|    );
291|}
292|
293|export async function addDocumentToProject(
294|    projectId: string,
295|    documentId: string,
296|): Promise<Document> {
297|    return apiRequest<Document>(
298|        `/projects/${projectId}/documents/${documentId}`,
299|        { method: "POST" },
300|    );
301|}
302|
303|export interface DocumentVersion {
304|    id: string;
305|    version_number: number | null;
306|    source: string;
307|    created_at: string;
308|    filename: string | null;
309|    file_type?: string | null;
310|    size_bytes?: number | null;
311|    page_count?: number | null;
312|}
313|
314|export async function listDocumentVersions(documentId: string): Promise<{
315|    current_version_id: string | null;
316|    versions: DocumentVersion[];
317|}> {
318|    return apiRequest(`/single-documents/${documentId}/versions`);
319|}
320|
321|export async function uploadDocumentVersion(
322|    documentId: string,
323|    file: File,
324|    filename?: string,
325|): Promise<DocumentVersion> {
326|    const authHeaders = await getAuthHeader();
327|    const form = new FormData();
328|    form.append("file", file);
329|    if (filename) form.append("filename", filename);
330|    const response = await fetch(
331|        `${API_BASE}/single-documents/${documentId}/versions`,
332|        {
333|            method: "POST",
334|            headers: { ...authHeaders },
335|            body: form,
336|        },
337|    );
338|    if (!response.ok) throw new Error(await response.text());
339|    return response.json() as Promise<DocumentVersion>;
340|}
341|
342|export async function copyDocumentVersionFromDocument(
343|    documentId: string,
344|    sourceDocumentId: string,
345|    filename?: string,
346|): Promise<DocumentVersion> {
347|    return apiRequest<DocumentVersion>(
348|        `/single-documents/${documentId}/versions/from-document`,
349|        {
350|            method: "POST",
351|            headers: { "Content-Type": "application/json" },
352|            body: JSON.stringify({
353|                source_document_id: sourceDocumentId,
354|                filename,
355|            }),
356|        },
357|    );
358|}
359|
360|export async function renameDocumentVersion(
361|    documentId: string,
362|    versionId: string,
363|    filename: string | null,
364|): Promise<DocumentVersion> {
365|    return apiRequest<DocumentVersion>(
366|        `/single-documents/${documentId}/versions/${versionId}`,
367|        {
368|            method: "PATCH",
369|            headers: { "Content-Type": "application/json" },
370|            body: JSON.stringify({ filename }),
371|        },
372|    );
373|}
374|
375|export async function deleteDocumentVersion(
376|    documentId: string,
377|    versionId: string,
378|): Promise<{
379|    deleted_version_id: string;
380|    current_version_id: string | null;
381|}> {
382|    return apiRequest(`/single-documents/${documentId}/versions/${versionId}`, {
383|        method: "DELETE",
384|    });
385|}
386|
387|export async function uploadProjectDocument(
388|    projectId: string,
389|    file: File,
390|): Promise<Document> {
391|    const authHeaders = await getAuthHeader();
392|    const form = new FormData();
393|    form.append("file", file);
394|    const response = await fetch(
395|        `${API_BASE}/projects/${projectId}/documents`,
396|        {
397|            method: "POST",
398|            headers: { ...authHeaders },
399|            body: form,
400|        },
401|    );
402|    if (!response.ok) throw new Error(await response.text());
403|    return response.json() as Promise<Document>;
404|}
405|
406|export async function uploadStandaloneDocument(
407|    file: File,
408|): Promise<Document> {
409|    const authHeaders = await getAuthHeader();
410|    const form = new FormData();
411|    form.append("file", file);
412|    const response = await fetch(`${API_BASE}/single-documents`, {
413|        method: "POST",
414|        headers: { ...authHeaders },
415|        body: form,
416|    });
417|    if (!response.ok) throw new Error(await response.text());
418|    return response.json() as Promise<Document>;
419|}
420|
421|export async function listStandaloneDocuments(): Promise<Document[]> {
422|    return apiRequest<Document[]>("/single-documents");
423|}
424|
425|export async function deleteDocument(documentId: string): Promise<void> {
426|    await apiRequest(`/single-documents/${documentId}`, { method: "DELETE" });
427|}
428|
429|export async function getDocumentUrl(
430|    documentId: string,
431|    versionId?: string | null,
432|): Promise<{ url: string; filename: string; version_id: string | null }> {
433|    const qs = versionId ? `?version_id=${encodeURIComponent(versionId)}` : "";
434|    return apiRequest(`/single-documents/${documentId}/url${qs}`);
435|}
436|
437|export async function downloadDocumentsZip(
438|    documentIds: string[],
439|): Promise<Blob> {
440|    const authHeaders = await getAuthHeader();
441|    const response = await fetch(`${API_BASE}/single-documents/download-zip`, {
442|        method: "POST",
443|        cache: "no-store",
444|        headers: {
445|            "Content-Type": "application/json",
446|            ...authHeaders,
447|        },
448|        body: JSON.stringify({ document_ids: documentIds }),
449|    });
450|    if (!response.ok) {
451|        const detail = await response.text();
452|        throw new Error(detail || `API error: ${response.status}`);
453|    }
454|    return response.blob();
455|}
456|
457|// ---------------------------------------------------------------------------
458|// Chat
459|// ---------------------------------------------------------------------------
460|
461|export async function createChat(payload?: {
462|    project_id?: string;
463|}): Promise<{ id: string }> {
464|    return apiRequest<{ id: string }>("/chat/create", {
465|        method: "POST",
466|        headers: { "Content-Type": "application/json" },
467|        body: JSON.stringify(payload ?? {}),
468|    });
469|}
470|
471|export async function listChats(options?: { limit?: number }): Promise<Chat[]> {
472|    const params = new URLSearchParams();
473|    if (options?.limit) params.set("limit", String(options.limit));
474|    const query = params.toString();
475|    return apiRequest<Chat[]>(`/chat${query ? `?${query}` : ""}`);
476|}
477|
478|export async function listProjectChats(projectId: string): Promise<Chat[]> {
479|    return apiRequest<Chat[]>(`/projects/${projectId}/chats`);
480|}
481|
482|export async function getChat(chatId: string): Promise<ChatDetailOut> {
483|    const raw = await apiRequest<ServerChatDetailOut>(`/chat/${chatId}`);
484|    const messages: Message[] = raw.messages.map((m) => {
485|        if (m.role === "user") {
486|            return {
487|                role: "user",
488|                content: typeof m.content === "string" ? m.content : "",
489|                files: m.files ?? undefined,
490|                workflow: m.workflow ?? undefined,
491|            };
492|        }
493|        const events = Array.isArray(m.content)
494|            ? (m.content as AssistantEvent[])
495|            : undefined;
496|        return {
497|            role: "assistant",
498|            content:
499|                events
500|                    ?.filter((e) => e.type === "content")
501|