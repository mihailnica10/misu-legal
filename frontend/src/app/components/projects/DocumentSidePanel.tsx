1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { createPortal } from "react-dom";
5|import {
6|    AlertCircle,
7|    Check,
8|    Download,
9|    Loader2,
10|    Pencil,
11|    Trash2,
12|    Upload,
13|    X,
14|} from "lucide-react";
15|import { ConfirmPopup } from "@/app/components/shared/ConfirmPopup";
16|import { DocView } from "@/app/components/shared/DocView";
17|import { WarningPopup } from "@/app/components/shared/WarningPopup";
18|import type { Document } from "@/app/components/shared/types";
19|import type { DocumentVersion } from "@/app/lib/misuApi";
20|import { cn } from "@/lib/utils";
21|import { formatBytes, formatDate } from "./ProjectPageParts";
22|
23|const MIN_DOC_COLUMN_WIDTH = 420;
24|const DEFAULT_DOC_COLUMN_WIDTH = 620;
25|const MIN_DATA_COLUMN_WIDTH = 280;
26|const DEFAULT_DATA_COLUMN_WIDTH = 340;
27|const RESIZER_WIDTH = 6;
28|const MAX_PANEL_WIDTH = 1180;
29|const primaryGlassButtonClass =
30|    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-gray-700/40 bg-gray-950/88 px-3 text-xs font-medium text-white shadow-[0_3px_9px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-4px_9px_rgba(15,23,42,0.2)] backdrop-blur-xl transition-all hover:bg-gray-900/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
31|const dangerGlassButtonClass =
32|    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-red-700/35 bg-red-600/90 px-3 text-xs font-medium text-white shadow-[0_3px_9px_rgba(127,29,29,0.16),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-4px_9px_rgba(127,29,29,0.18)] backdrop-blur-xl transition-all hover:bg-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
33|
34|interface DocumentSidePanelProps {
35|    doc: Document | null;
36|    versionId?: string | null;
37|    currentVersionId?: string | null;
38|    versions: DocumentVersion[];
39|    versionsLoading: boolean;
40|    onClose: () => void;
41|    onLoadVersions: (docId: string) => Promise<void> | void;
42|    onSelectVersion: (versionId: string, label: string) => void;
43|    onDownloadDocument: (docId: string) => Promise<void> | void;
44|    onDownloadVersion: (
45|        docId: string,
46|        versionId: string,
47|        filename: string,
48|    ) => Promise<void> | void;
49|    onRenameVersion: (
50|        docId: string,
51|        versionId: string,
52|        filename: string,
53|    ) => Promise<void> | void;
54|    onDeleteVersion: (docId: string, versionId: string) => Promise<void> | void;
55|    onUploadNewVersion: (
56|        doc: Document,
57|        file: File,
58|        filename: string,
59|    ) => Promise<void>;
60|    onDelete: (doc: Document) => Promise<void> | void;
61|}
62|
63|export function DocumentSidePanel({
64|    doc,
65|    versionId,
66|    currentVersionId,
67|    versions,
68|    versionsLoading,
69|    onClose,
70|    onLoadVersions,
71|    onSelectVersion,
72|    onDownloadVersion,
73|    onRenameVersion,
74|    onDeleteVersion,
75|    onUploadNewVersion,
76|    onDelete,
77|}: DocumentSidePanelProps) {
78|    const [mounted, setMounted] = useState(false);
79|    const [uploading, setUploading] = useState(false);
80|    const [uploadError, setUploadError] = useState<string | null>(null);
81|    const [editingName, setEditingName] = useState(false);
82|    const [nameDraft, setNameDraft] = useState("");
83|    const [savingName, setSavingName] = useState(false);
84|    const [nameError, setNameError] = useState<string | null>(null);
85|    const [extensionWarningOpen, setExtensionWarningOpen] = useState(false);
86|    const [deletingVersionId, setDeletingVersionId] = useState<string | null>(
87|        null,
88|    );
89|    const [deletingDocument, setDeletingDocument] = useState(false);
90|    const [confirmDeleteDocumentOpen, setConfirmDeleteDocumentOpen] =
91|        useState(false);
92|    const [deleteDocumentStatus, setDeleteDocumentStatus] = useState<
93|        "idle" | "deleting" | "deleted"
94|    >("idle");
95|    const [dataColumnWidth, setDataColumnWidth] = useState(
96|        DEFAULT_DATA_COLUMN_WIDTH,
97|    );
98|    const [panelWidth, setPanelWidth] = useState(
99|        DEFAULT_DOC_COLUMN_WIDTH + RESIZER_WIDTH + DEFAULT_DATA_COLUMN_WIDTH,
100|    );
101|    const panelRef = useRef<HTMLDivElement>(null);
102|    const fileInputRef = useRef<HTMLInputElement>(null);
103|    const dragStartX = useRef(0);
104|    const dragStartDataWidth = useRef(DEFAULT_DATA_COLUMN_WIDTH);
105|    const dragStartPanelWidth = useRef(
106|        DEFAULT_DOC_COLUMN_WIDTH + RESIZER_WIDTH + DEFAULT_DATA_COLUMN_WIDTH,
107|    );
108|
109|    useEffect(() => setMounted(true), []);
110|
111|    useEffect(() => {
112|        if (!mounted) return;
113|        function handleWindowResize() {
114|            setPanelWidth((width) => clampPanelWidth(width, dataColumnWidth));
115|        }
116|        handleWindowResize();
117|        window.addEventListener("resize", handleWindowResize);
118|        return () => window.removeEventListener("resize", handleWindowResize);
119|    }, [dataColumnWidth, mounted]);
120|
121|    useEffect(() => {
122|        if (!doc) return;
123|        setUploadError(null);
124|        void onLoadVersions(doc.id);
125|    }, [doc?.id]);
126|
127|    useEffect(() => {
128|        setEditingName(false);
129|        setNameDraft("");
130|        setNameError(null);
131|        setExtensionWarningOpen(false);
132|    }, [doc?.id, versionId, currentVersionId]);
133|
134|    if (!mounted || !doc) return null;
135|
136|    const activeDoc = doc;
137|    const documentId = activeDoc.id;
138|    const accept = doc.file_type === "pdf" ? ".pdf" : ".docx,.doc";
139|    const orderedVersions = [...versions].reverse();
140|    const selectedVersion =
141|        versions.find((version) => version.id === versionId) ??
142|        versions.find((version) => version.id === currentVersionId) ??
143|        orderedVersions[0] ??
144|        null;
145|    const selectedVersionId = selectedVersion?.id ?? versionId ?? null;
146|    const selectedFilename = selectedVersion?.filename?.trim() || doc.filename;
147|    const selectedFileType =
148|        selectedVersion != null
149|            ? fileTypeForVersion(selectedVersion, doc.file_type)
150|            : doc.file_type;
151|    const selectedSizeBytes =
152|        selectedVersion?.size_bytes === undefined
153|            ? doc.size_bytes
154|            : selectedVersion.size_bytes;
155|    const selectedPageCount =
156|        selectedVersion?.page_count === undefined
157|            ? doc.page_count
158|            : selectedVersion.page_count;
159|    const selectedVersionNumber =
160|        selectedVersion?.version_number ?? doc.active_version_number ?? null;
161|    const selectedUploadedAt = selectedVersion?.created_at ?? doc.created_at;
162|    const selectedExtension = filenameExtension(selectedFilename);
163|
164|    async function handleSaveName() {
165|        if (!selectedVersionId) return;
166|        const trimmed = nameDraft.trim();
167|        if (!trimmed) {
168|            setNameError("Name is required.");
169|            return;
170|        }
171|        if (hasExtensionChange(selectedFilename, trimmed)) {
172|            setExtensionWarningOpen(true);
173|            return;
174|        }
175|        if (trimmed === selectedFilename) {
176|            setEditingName(false);
177|            setNameError(null);
178|            return;
179|        }
180|
181|        setSavingName(true);
182|        setNameError(null);
183|        try {
184|            await onRenameVersion(documentId, selectedVersionId, trimmed);
185|            setEditingName(false);
186|        } catch (err) {
187|            console.error("rename version failed", err);
188|            setNameError("Could not save name.");
189|        } finally {
190|            setSavingName(false);
191|        }
192|    }
193|
194|    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
195|        const file = e.target.files?.[0] ?? null;
196|        if (fileInputRef.current) fileInputRef.current.value = "";
197|        if (!file || !doc) return;
198|        setUploadError(null);
199|        setUploading(true);
200|        try {
201|            await onUploadNewVersion(doc, file, file.name);
202|        } catch (err) {
203|            console.error("upload new version failed", err);
204|            setUploadError("Could not upload the new version.");
205|        } finally {
206|            setUploading(false);
207|        }
208|    }
209|
210|    async function handleDeleteVersion(versionIdToDelete: string) {
211|        setDeletingVersionId(versionIdToDelete);
212|        try {
213|            await onDeleteVersion(documentId, versionIdToDelete);
214|        } catch (err) {
215|            console.error("delete version failed", err);
216|        } finally {
217|            setDeletingVersionId(null);
218|        }
219|    }
220|
221|    async function handleDeleteDocument() {
222|        if (deleteDocumentStatus === "deleting") return;
223|        setDeleteDocumentStatus("deleting");
224|        setDeletingDocument(true);
225|        try {
226|            await onDelete(activeDoc);
227|            setDeleteDocumentStatus("deleted");
228|            window.setTimeout(() => {
229|                setConfirmDeleteDocumentOpen(false);
230|                setDeleteDocumentStatus("idle");
231|                onClose();
232|            }, 650);
233|        } catch (err) {
234|            console.error("delete document failed", err);
235|            setDeleteDocumentStatus("idle");
236|        } finally {
237|            setDeletingDocument(false);
238|        }
239|    }
240|
241|    function requestDeleteDocument() {
242|        if (versions.length > 1) {
243|            setDeleteDocumentStatus("idle");
244|            setConfirmDeleteDocumentOpen(true);
245|            return;
246|        }
247|        void handleDeleteDocument();
248|    }
249|
250|    function handleResizeMouseDown(e: React.MouseEvent<HTMLDivElement>) {
251|        e.preventDefault();
252|        dragStartX.current = e.clientX;
253|        dragStartDataWidth.current = dataColumnWidth;
254|
255|        const handleMouseMove = (event: MouseEvent) => {
256|            const panelWidth =
257|                panelRef.current?.clientWidth ?? window.innerWidth;
258|            const maxDataWidth = Math.max(
259|                MIN_DATA_COLUMN_WIDTH,
260|                panelWidth - MIN_DOC_COLUMN_WIDTH - RESIZER_WIDTH,
261|            );
262|            const nextWidth =
263|                dragStartDataWidth.current +
264|                (dragStartX.current - event.clientX);
265|            setDataColumnWidth(
266|                Math.min(
267|                    maxDataWidth,
268|                    Math.max(MIN_DATA_COLUMN_WIDTH, nextWidth),
269|                ),
270|            );
271|        };
272|
273|        const handleMouseUp = () => {
274|            document.removeEventListener("mousemove", handleMouseMove);
275|            document.removeEventListener("mouseup", handleMouseUp);
276|            document.body.style.cursor = "";
277|            document.body.style.userSelect = "";
278|        };
279|
280|        document.addEventListener("mousemove", handleMouseMove);
281|        document.addEventListener("mouseup", handleMouseUp);
282|        document.body.style.cursor = "col-resize";
283|        document.body.style.userSelect = "none";
284|    }
285|
286|    function handlePanelResizeMouseDown(e: React.MouseEvent<HTMLDivElement>) {
287|        e.preventDefault();
288|        dragStartX.current = e.clientX;
289|        dragStartPanelWidth.current = panelWidth;
290|
291|        const handleMouseMove = (event: MouseEvent) => {
292|            const nextWidth =
293|                dragStartPanelWidth.current +
294|                (dragStartX.current - event.clientX);
295|            setPanelWidth(clampPanelWidth(nextWidth, dataColumnWidth));
296|        };
297|
298|        const handleMouseUp = () => {
299|            document.removeEventListener("mousemove", handleMouseMove);
300|            document.removeEventListener("mouseup", handleMouseUp);
301|            document.body.style.cursor = "";
302|            document.body.style.userSelect = "";
303|        };
304|
305|        document.addEventListener("mousemove", handleMouseMove);
306|        document.addEventListener("mouseup", handleMouseUp);
307|        document.body.style.cursor = "col-resize";
308|        document.body.style.userSelect = "none";
309|    }
310|
311|    return createPortal(
312|        <div
313|            ref={panelRef}
314|            className={cn(
315|                "fixed z-[190] flex flex-col",
316|                "inset-y-3 right-3 rounded-2xl border border-white/70 bg-white/72 shadow-[0_8px_24px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-10px_24px_rgba(255,255,255,0.18),inset_1px_0_0_rgba(255,255,255,0.5)] backdrop-blur-2xl overflow-hidden",
317|            )}
318|            style={{ width: panelWidth }}
319|        >
320|            <div
321|                onMouseDown={handlePanelResizeMouseDown}
322|                className="absolute inset-y-0 left-0 z-20 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-blue-400/60"
323|                title="Resize document view"
324|            />
325|            <div
326|                className={cn(
327|                    "flex h-11 shrink-0 items-center justify-between px-4",
328|                    "border-b border-white/60 bg-white/35",
329|                )}
330|            >
331|                <div className="min-w-0">
332|                    <div className="truncate text-sm font-medium text-gray-700">
333|                        {selectedFilename}
334|                    </div>
335|                </div>
336|                <div className="flex items-center gap-1">
337|                    <button
338|                        type="button"
339|                        onClick={onClose}
340|                        className="flex h-7 w-7 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
341|                        title="Close"
342|                    >
343|                        <X className="h-4 w-4" />
344|                    </button>
345|                </div>
346|            </div>
347|
348|            <div
349|                className="grid min-h-0 flex-1"
350|                style={{
351|                    gridTemplateColumns: `minmax(${MIN_DOC_COLUMN_WIDTH}px, 1fr) ${RESIZER_WIDTH}px ${dataColumnWidth}px`,
352|                }}
353|            >
354|                <section
355|                    className={cn(
356|                        "flex min-h-0 min-w-0 pb-3 pl-3",
357|                        "bg-white/20",
358|                    )}
359|                >
360|                    <div
361|                        className={cn(
362|                            "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
363|                            "rounded-xl border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl",
364|                        )}
365|                    >
366|                        <DocView
367|                            key={selectedVersionId ?? "current"}
368|                            doc={{
369|                                document_id: doc.id,
370|                                version_id: selectedVersionId,
371|                            }}
372|                        />
373|                    </div>
374|                </section>
375|
376|                <div
377|                    onMouseDown={handleResizeMouseDown}
378|                    className={cn(
379|                        "relative cursor-col-resize transition-colors",
380|                        "bg-white/25 hover:bg-blue-400/60",
381|                    )}
382|                    title="Resize document panel"
383|                />
384|
385|                <aside
386|                    className={cn(
387|                        "mb-3 ml-2 mr-3 flex min-h-0 flex-col overflow-hidden rounded-xl",
388|                        "border border-white/70 bg-white/55 shadow-[0_3px_9px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-4px_9px_rgba(255,255,255,0.08)] backdrop-blur-2xl",
389|                    )}
390|                >
391|                    <div
392|                        className={cn(
393|                            "shrink-0 px-4 py-3",
394|                            "border-b border-white/60",
395|                        )}
396|                    >
397|                        <div className="mb-4">
398|                            <div className="mb-3 text-xs font-medium text-gray-900">
399|                                Name
400|                            </div>
401|                            {editingName ? (
402|                                <div className="space-y-1.5">
403|                                    <div className="flex min-h-6 items-center gap-2">
404|                                        <input
405|                                            value={nameDraft}
406|                                            onChange={(e) => {
407|                                                setNameDraft(e.target.value);
408|                                                setNameError(null);
409|                                            }}
410|                                            onKeyDown={(e) => {
411|                                                if (e.key === "Enter") {
412|                                                    e.preventDefault();
413|                                                    void handleSaveName();
414|                                                }
415|                                                if (e.key === "Escape") {
416|                                                    setEditingName(false);
417|                                                    setNameError(null);
418|                                                }
419|                                            }}
420|                                            className="h-6 min-w-0 flex-1 border-0 border-b border-gray-300 bg-transparent px-0 text-xs leading-6 text-gray-900 outline-none transition-colors focus:border-gray-500"
421|                                            autoFocus
422|                                        />
423|                                        <button
424|                                            type="button"
425|                                            onClick={() =>
426|                                                void handleSaveName()
427|                                            }
428|                                            disabled={savingName}
429|                                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/65 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
430|                                            title="Save name"
431|                                        >
432|                                            {savingName ? (
433|                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
434|                                            ) : (
435|                                                <Check className="h-3.5 w-3.5" />
436|                                            )}
437|                                        </button>
438|                                    </div>
439|                                    {nameError && (
440|                                        <div className="text-xs text-red-600">
441|                                            {nameError}
442|                                        </div>
443|                                    )}
444|                                </div>
445|                            ) : (
446|                                <div className="flex min-h-6 items-center gap-2">
447|                                    <div className="min-w-0 flex-1 truncate text-xs leading-6 text-gray-800">
448|                                        {selectedFilename}
449|                                    </div>
450|                                    {selectedVersionId && (
451|                                        <button
452|                                            type="button"
453|                                            onClick={() => {
454|                                                setNameDraft(selectedFilename);
455|                                                setEditingName(true);
456|                                                setNameError(null);
457|                                            }}
458|                                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/65 hover:text-gray-900"
459|                                            title="Edit name"
460|                                        >
461|                                            <Pencil className="h-3.5 w-3.5" />
462|                                        </button>
463|                                    )}
464|                                </div>
465|                            )}
466|                        </div>
467|
468|                        <div className="mb-3 text-xs font-medium text-gray-900">
469|                            Document Data
470|                        </div>
471|                        <div className="rounded-xl bg-gray-100/70 px-3 py-3">
472|                            <div className="space-y-1.5">
473|                                <DataRow
474|                                    label="Type"
475|                                    value={selectedFileType ?? "—"}
476|                                />
477|                                <DataRow
478|                                    label="Size"
479|                                    value={
480|                                        selectedSizeBytes != null
481|                                            ? formatBytes(selectedSizeBytes)
482|                                            : "—"
483|                                    }
484|                                />
485|                                <DataRow
486|                                    label="Version"
487|                                    value={
488|                                        selectedVersionNumber != null
489|                                            ? String(selectedVersionNumber)
490|                                            : "—"
491|                                    }
492|                                />
493|                                <DataRow
494|                                    label="Uploaded"
495|                                    value={
496|                                        selectedUploadedAt
497|                                            ? formatDate(selectedUploadedAt)
498|                                            : "—"
499|                                    }
500|                                />
501|