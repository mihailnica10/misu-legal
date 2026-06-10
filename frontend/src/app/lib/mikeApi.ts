/**
 * Mike API client — all requests to the Hono Worker backend.
 * Uses JWT token from localStorage for authentication.
 */
import type { AssistantEvent, Chat, ChatDetailOut, Document, Folder, Message, Project, Workflow, TabularReview, ColumnConfig, TabularCell } from "@/app/components/shared/types";

// Re-export common types
export type { ApiKeyProvider, ApiKeySource, ApiKeyState, ApiKeyStatus, UserProfile, DocumentVersion, ProjectPeople } from "./misuApi";

// Re-export helper functions from misuApi — those that exist there
export {
  listProjects, createProject, deleteAccount, getUserProfile, updateUserProfile,
  getApiKeyStatus, saveApiKey, getProject, updateProject, deleteProject,
  getProjectPeople, createProjectFolder, renameProjectFolder, deleteProjectFolder,
  moveSubfolderToFolder, moveDocumentToFolder, renameProjectDocument,
  addDocumentToProject, listDocumentVersions, uploadDocumentVersion,
  copyDocumentVersionFromDocument, renameDocumentVersion, deleteDocumentVersion,
  uploadProjectDocument, uploadStandaloneDocument, listStandaloneDocuments,
  deleteDocument, getDocumentUrl, downloadDocumentsZip,
  createChat, listChats, listProjectChats, getChat,
} from "./misuApi";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://misu-api.mihailnica10.workers.dev";

async function getAuthHeader(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('misu_token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeader();
  const { headers: initHeaders, ...restInit } = init ?? {};
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...restInit,
    headers: {
      Accept: "application/json",
      ...authHeaders,
      ...(initHeaders as Record<string, string> | undefined),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `API error: ${response.status}`);
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export async function renameChat(chatId: string, title: string): Promise<void> {
  await apiRequest(`/chat/${chatId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------
export async function getWorkflow(workflowId: string): Promise<Workflow> {
  return apiRequest<Workflow>(`/workflows/${workflowId}`);
}

export async function updateWorkflow(workflowId: string, payload: Partial<Workflow>): Promise<Workflow> {
  return apiRequest<Workflow>(`/workflows/${workflowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listWorkflows(): Promise<Workflow[]> {
  return apiRequest<Workflow[]>("/workflows");
}

export async function createWorkflow(payload: { title: string; type: string; promptMd?: string; columnsConfig?: any; practice?: string }): Promise<Workflow> {
  return apiRequest<Workflow>("/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  await apiRequest(`/workflows/${workflowId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Tabular Reviews
// ---------------------------------------------------------------------------
export async function listTabularReviews(projectId?: string): Promise<TabularReview[]> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return apiRequest<TabularReview[]>(`/tabular-review${qs}`);
}

export async function createTabularReview(payload: {
  title?: string;
  document_ids: string[];
  columns_config: { index: number; name: string; prompt: string }[];
  workflow_id?: string;
  project_id?: string;
}): Promise<TabularReview> {
  return apiRequest<TabularReview>("/tabular-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateTabularReview(reviewId: string, payload: Partial<TabularReview>): Promise<TabularReview> {
  return apiRequest<TabularReview>(`/tabular-review/${reviewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteTabularReview(reviewId: string): Promise<void> {
  await apiRequest(`/tabular-review/${reviewId}`, { method: "DELETE" });
}

export interface TabularReviewDetailOut extends TabularReview {
  cells: TabularCell[];
}

export async function getTabularReview(reviewId: string): Promise<TabularReviewDetailOut> {
  return apiRequest<TabularReviewDetailOut>(`/tabular-review/${reviewId}`);
}

export async function getTabularReviewPeople(reviewId: string): Promise<{ owner: { userId: string; email: string | null; displayName: string | null }; members: { email: string; displayName: string | null }[] }> {
  return apiRequest(`/tabular-review/${reviewId}/people`);
}

export async function clearTabularCells(reviewId: string): Promise<void> {
  // Delete all cells for this review
  const { cells } = await getTabularReview(reviewId);
  await Promise.all((cells || []).map((cell: TabularCell) =>
    apiRequest(`/tabular-review/${reviewId}/cells/${cell.id}`, { method: "DELETE" })
  ));
}

export async function streamTabularGeneration(reviewId: string, payload: {
  columns: { index: number; name: string; prompt?: string }[];
  model?: string;
}): Promise<Response> {
  const authHeaders = await getAuthHeader();
  return fetch(`${API_BASE}/tabular-review/${reviewId}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(payload),
  });
}

export async function regenerateTabularCell(reviewId: string, documentId: string, columnIndex: number, payload?: { model?: string }): Promise<TabularCell> {
  return apiRequest<TabularCell>(`/tabular-review/${reviewId}/cells/${documentId}/${columnIndex}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export async function uploadReviewDocument(reviewId: string, file: File): Promise<Document> {
  const authHeaders = await getAuthHeader();
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/tabular-review/${reviewId}/documents`, {
    method: "POST",
    headers: { ...authHeaders },
    body: form,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<Document>;
}

// ---------------------------------------------------------------------------
// Tabular Review Chats
// ---------------------------------------------------------------------------
export interface TRChat {
  id: string;
  reviewId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TRCitationAnnotation {
  document_id: string;
  quote: string;
  version_id?: string;
  page?: number;
}

export async function getTabularChats(reviewId: string): Promise<TRChat[]> {
  return apiRequest<TRChat[]>(`/tabular-review/${reviewId}/chats`);
}

export async function getTabularChatMessages(reviewId: string, chatId: string): Promise<any[]> {
  return apiRequest(`/tabular-review/${reviewId}/chat/${chatId}/messages`);
}

export async function deleteTabularChat(reviewId: string, chatId: string): Promise<void> {
  return apiRequest(`/tabular-review/${reviewId}/chat/${chatId}`, { method: "DELETE" });
}

export async function streamTabularChat(reviewId: string, payload: {
  messages: any[];
  chat_id?: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<Response> {
  const authHeaders = await getAuthHeader();
  return fetch(`${API_BASE}/tabular-review/${reviewId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      messages: payload.messages,
      chat_id: payload.chat_id,
      model: payload.model,
    }),
    signal: payload.signal,
  });
}

export function mapTRMessages(messages: any[]): { role: string; content: string; annotations?: any[] }[] {
  return (messages || []).map((m: any) => ({
    role: m.role,
    content: m.content || "",
    annotations: m.annotations ? JSON.parse(m.annotations) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Tabular Review Prompt Generation
// ---------------------------------------------------------------------------
export async function generateTabularColumnPrompt(payload: {
  title: string;
  format?: string;
  documentName?: string;
  tags?: string[];
}): Promise<{ prompt: string }> {
  return apiRequest<{ prompt: string }>("/tabular-review/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Chat — streaming
// ---------------------------------------------------------------------------
export async function streamChat(payload: {
  messages: { role: string; content: string; files?: any[] }[];
  chat_id?: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<Response> {
  const authHeaders = await getAuthHeader();
  return fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(payload),
    signal: payload.signal,
  });
}

export async function streamProjectChat(payload: {
  projectId: string;
  messages: { role: string; content: string; files?: any[] }[];
  chat_id?: string;
  model?: string;
  displayed_doc?: { filename: string; document_id: string };
  attached_documents?: { filename: string; document_id: string }[];
  signal?: AbortSignal;
}): Promise<Response> {
  const authHeaders = await getAuthHeader();
  return fetch(`${API_BASE}/projects/${payload.projectId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      messages: payload.messages,
      chat_id: payload.chat_id,
      model: payload.model,
    }),
    signal: payload.signal,
  });
}

// ---------------------------------------------------------------------------
// Chat — title generation
// ---------------------------------------------------------------------------
export async function generateChatTitle(chatId: string, message: string): Promise<{ title: string }> {
  return apiRequest<{ title: string }>(`/chat/${chatId}/generate-title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

// ---------------------------------------------------------------------------
// Tabular Review Cell mutations
// ---------------------------------------------------------------------------
export async function updateTabularCell(reviewId: string, cellId: string, payload: { content?: string; citations?: string; status?: string }): Promise<TabularCell> {
  return apiRequest<TabularCell>(`/tabular-review/${reviewId}/cells/${cellId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listTabularCells(reviewId: string): Promise<TabularCell[]> {
  return apiRequest<TabularCell[]>(`/tabular-review/${reviewId}/cells`);
}
