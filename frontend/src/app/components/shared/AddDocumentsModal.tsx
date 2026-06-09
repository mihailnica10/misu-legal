1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { AlertCircle, Upload, Search, Loader2, X } from "lucide-react";
5|import {
6|    uploadStandaloneDocument,
7|    uploadProjectDocument,
8|    addDocumentToProject,
9|    deleteDocument,
10|} from "@/app/lib/misuApi";
11|import type { Document } from "./types";
12|import { FileDirectory } from "./FileDirectory";
13|import { useDirectoryData, invalidateDirectoryCache } from "./useDirectoryData";
14|import { OwnerOnlyModal } from "./OwnerOnlyModal";
15|import { useAuth } from "@/contexts/AuthContext";
16|import { Modal } from "./Modal";
17|import {
18|    SUPPORTED_DOCUMENT_ACCEPT,
19|    formatUnsupportedDocumentWarning,
20|    partitionSupportedDocumentFiles,
21|} from "@/app/lib/documentUploadValidation";
22|
23|export { invalidateDirectoryCache };
24|
25|interface Props {
26|    open: boolean;
27|    onClose: () => void;
28|    onSelect: (documents: Document[], projectId?: string) => void;
29|    breadcrumb: string[];
30|    allowMultiple?: boolean;
31|    projectId?: string;
32|}
33|
34|export function AddDocumentsModal({
35|    open,
36|    onClose,
37|    onSelect,
38|    breadcrumb,
39|    allowMultiple = true,
40|    projectId,
41|}: Props) {
42|    const { loading, standaloneDocuments, projects } = useDirectoryData(open);
43|    const { user } = useAuth();
44|    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
45|    const [uploading, setUploading] = useState(false);
46|    const [uploadingFilenames, setUploadingFilenames] = useState<string[]>([]);
47|    const [uploadWarning, setUploadWarning] = useState<string | null>(null);
48|    const [search, setSearch] = useState("");
49|    const [extraUploadedDocs, setExtraUploadedDocs] = useState<Document[]>([]);
50|    // IDs deleted in this session — hidden locally since `useDirectoryData`'s
51|    // cached state won't re-fetch until the modal reopens.
52|    const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
53|    const [ownerOnlyAction, setOwnerOnlyAction] = useState<string | null>(null);
54|    const fileInputRef = useRef<HTMLInputElement>(null);
55|
56|    useEffect(() => {
57|        if (!open) return;
58|        setSearch("");
59|        setSelectedIds(new Set());
60|        setExtraUploadedDocs([]);
61|        setDeletedIds(new Set());
62|        setUploadingFilenames([]);
63|        setUploadWarning(null);
64|    }, [open]);
65|
66|    if (!open) return null;
67|
68|    const q = search.toLowerCase().trim();
69|
70|    const allStandalone = [
71|        ...extraUploadedDocs.filter(
72|            (u) => !standaloneDocuments.some((d) => d.id === u.id),
73|        ),
74|        ...standaloneDocuments,
75|    ].filter((d) => !deletedIds.has(d.id));
76|
77|    const filteredStandalone = q
78|        ? allStandalone.filter((d) =>
79|              d.filename.toLowerCase().includes(q),
80|          )
81|        : allStandalone;
82|
83|    const filteredProjects = projects
84|        .filter((p) => p.id !== projectId)
85|        .map((p) => ({
86|            ...p,
87|            documents: (p.documents || []).filter(
88|                (d) =>
89|                    !deletedIds.has(d.id) &&
90|                    (!q ||
91|                        d.filename.toLowerCase().includes(q)),
92|            ),
93|        }))
94|        .filter(
95|            (p) =>
96|                !q ||
97|                p.name.toLowerCase().includes(q) ||
98|                p.documents.length > 0,
99|        );
100|
101|    const allDocs = [
102|        ...allStandalone,
103|        ...projects.flatMap((p) => p.documents || []),
104|    ];
105|
106|    async function handleConfirm() {
107|        const selected = allDocs.filter((d) => selectedIds.has(d.id));
108|
109|        if (projectId) {
110|            const toAssign = selected.filter((d) => d.project_id !== projectId);
111|            const alreadyHere = selected.filter(
112|                (d) => d.project_id === projectId,
113|            );
114|            if (toAssign.length > 0) {
115|                setUploading(true);
116|                try {
117|                    const assigned = await Promise.all(
118|                        toAssign.map((d) =>
119|                            addDocumentToProject(projectId, d.id),
120|                        ),
121|                    );
122|                    onSelect([...alreadyHere, ...assigned], projectId);
123|                } catch (err) {
124|                    console.error("Failed to assign documents:", err);
125|                } finally {
126|                    setUploading(false);
127|                }
128|            } else {
129|                onSelect(alreadyHere, projectId);
130|            }
131|            onClose();
132|            return;
133|        }
134|
135|        const projectIds = new Set(
136|            selected.map((d) => d.project_id).filter(Boolean),
137|        );
138|        const singleProjectId =
139|            projectIds.size === 1 ? [...projectIds][0]! : undefined;
140|        onSelect(selected, singleProjectId);
141|        onClose();
142|    }
143|
144|    async function handleDelete(ids: string[]) {
145|        // Server only allows the doc creator to delete. Filter to owned
146|        // and warn for the rest.
147|        const docsById = new Map<string, Document>();
148|        for (const d of [
149|            ...standaloneDocuments,
150|            ...extraUploadedDocs,
151|            ...projects.flatMap((p) => p.documents ?? []),
152|        ]) {
153|            docsById.set(d.id, d);
154|        }
155|        const owned = ids.filter((id) => {
156|            const d = docsById.get(id);
157|            return !d || !d.user_id || !user?.id || d.user_id === user.id;
158|        });
159|        const blocked = ids.length - owned.length;
160|        if (owned.length === 0 && blocked > 0) {
161|            setOwnerOnlyAction(
162|                "delete these documents — only the document creator can delete a document",
163|            );
164|            return;
165|        }
166|        const idSet = new Set(owned);
167|        try {
168|            await Promise.all(owned.map((id) => deleteDocument(id)));
169|        } catch (err) {
170|            console.error("Delete failed:", err);
171|            return;
172|        }
173|        invalidateDirectoryCache();
174|        setExtraUploadedDocs((prev) => prev.filter((d) => !idSet.has(d.id)));
175|        setDeletedIds((prev) => {
176|            const next = new Set(prev);
177|            owned.forEach((id) => next.add(id));
178|            return next;
179|        });
180|        if (blocked > 0) {
181|            setOwnerOnlyAction(
182|                `delete ${blocked} of the selected documents — only the document creator can delete a document`,
183|            );
184|        }
185|    }
186|
187|    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
188|        const files = Array.from(e.target.files || []);
189|        if (!files.length) return;
190|        const { supported, unsupported } = partitionSupportedDocumentFiles(files);
191|        setUploadWarning(formatUnsupportedDocumentWarning(unsupported));
192|        if (supported.length === 0) {
193|            if (fileInputRef.current) fileInputRef.current.value = "";
194|            return;
195|        }
196|        setUploadingFilenames(supported.map((file) => file.name));
197|        setUploading(true);
198|        try {
199|            const uploaded = await Promise.all(
200|                supported.map((f) =>
201|                    projectId
202|                        ? uploadProjectDocument(projectId, f)
203|                        : uploadStandaloneDocument(f),
204|                ),
205|            );
206|            invalidateDirectoryCache();
207|            setExtraUploadedDocs((prev) => [...uploaded, ...prev]);
208|            uploaded.forEach((d) =>
209|                setSelectedIds((prev) => new Set([...prev, d.id])),
210|            );
211|        } catch (err) {
212|            console.error("Upload failed:", err);
213|        } finally {
214|            setUploading(false);
215|            setUploadingFilenames([]);
216|            if (fileInputRef.current) fileInputRef.current.value = "";
217|        }
218|    }
219|
220|    return (
221|        <>
222|            <Modal
223|                open={open}
224|                onClose={onClose}
225|                breadcrumbs={breadcrumb}
226|                secondaryAction={{
227|                    label: uploading ? "Uploading…" : "Upload",
228|                    icon: uploading ? (
229|                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
230|                    ) : (
231|                        <Upload className="h-3.5 w-3.5" />
232|                    ),
233|                    onClick: () => fileInputRef.current?.click(),
234|                    disabled: uploading,
235|                }}
236|                footerStatus={
237|                    selectedIds.size > 0 ? (
238|                        <span className="text-xs text-gray-400">
239|                            {selectedIds.size} selected
240|                        </span>
241|                    ) : null
242|                }
243|                primaryAction={{
244|                    label: uploading ? "Saving…" : "Confirm",
245|                    onClick: handleConfirm,
246|                    disabled: selectedIds.size === 0 || uploading,
247|                }}
248|            >
249|                <input
250|                    ref={fileInputRef}
251|                    type="file"
252|                    accept={SUPPORTED_DOCUMENT_ACCEPT}
253|                    multiple
254|                    className="hidden"
255|                    onChange={handleUpload}
256|                />
257|                {/* Search bar */}
258|                <div className="pt-1 pb-2">
259|                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
260|                        <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
261|                        <input
262|                            type="text"
263|                            placeholder="Search…"
264|                            value={search}
265|                            onChange={(e) => setSearch(e.target.value)}
266|                            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
267|                            autoFocus
268|                        />
269|                        {search && (
270|                            <button
271|                                onClick={() => setSearch("")}
272|                                className="text-gray-400 hover:text-gray-600"
273|                            >
274|                                <X className="h-3.5 w-3.5" />
275|                            </button>
276|                        )}
277|                    </div>
278|                </div>
279|
280|                {uploadWarning && (
281|                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-gray-900">
282|                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
283|                        <span className="min-w-0 flex-1">{uploadWarning}</span>
284|                        <button
285|                            type="button"
286|                            onClick={() => setUploadWarning(null)}
287|                            className="shrink-0 rounded p-0.5 text-black hover:bg-gray-100"
288|                            aria-label="Dismiss warning"
289|                        >
290|                            <X className="h-3.5 w-3.5" />
291|                        </button>
292|                    </div>
293|                )}
294|
295|                {/* File browser */}
296|                <FileDirectory
297|                    standaloneDocs={filteredStandalone}
298|                    directoryProjects={filteredProjects}
299|                    loading={loading}
300|                    selectedIds={selectedIds}
301|                    onChange={setSelectedIds}
302|                    allowMultiple={allowMultiple}
303|                    forceExpanded={!!q}
304|                    emptyMessage={q ? "No matches found" : "No documents yet"}
305|                    onDelete={handleDelete}
306|                    uploadingFilenames={uploadingFilenames}
307|                />
308|            </Modal>
309|            <OwnerOnlyModal
310|                open={!!ownerOnlyAction}
311|                action={ownerOnlyAction ?? undefined}
312|                onClose={() => setOwnerOnlyAction(null)}
313|            />
314|        </>
315|    );
316|}
317|