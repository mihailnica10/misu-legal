1|"use client";
2|
3|import { type CSSProperties, useState } from "react";
4|import {
5|    CornerDownRight,
6|    File,
7|    FileText,
8|    Loader2,
9|    MessageSquare,
10|    Search,
11|    Table2,
12|    Users,
13|} from "lucide-react";
14|import { PageHeader } from "@/app/components/shared/PageHeader";
15|import { RenameableTitle } from "@/app/components/shared/RenameableTitle";
16|import type { Project } from "@/app/components/shared/types";
17|import type { DocumentVersion } from "@/app/lib/misuApi";
18|import { RowActions } from "@/app/components/shared/RowActions";
19|
20|export type ProjectTab = "documents" | "assistant" | "reviews";
21|
22|export type ProjectContextMenu = {
23|    x: number;
24|    y: number;
25|    docId?: string | null;
26|    folderId: string | null;
27|    showFolderActions: boolean;
28|};
29|
30|export const NAME_COL_W = "w-[332px] shrink-0";
31|export const DOC_NAME_COL_W =
32|    "w-[292px] sm:w-[332px] md:w-[392px] lg:w-[452px] xl:w-[532px] 2xl:w-[592px] shrink-0";
33|
34|const TREE_CONTROL_WIDTH_PX = 32;
35|const TREE_NAME_PADDING_PX = 16;
36|
37|export function treeNameCellStyle(depth: number): CSSProperties | undefined {
38|    if (depth <= 0) return undefined;
39|    return {
40|        paddingLeft: TREE_NAME_PADDING_PX + depth * TREE_CONTROL_WIDTH_PX,
41|    };
42|}
43|
44|export function formatBytes(bytes: number): string {
45|    if (bytes < 1024) return `${bytes} B`;
46|    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
47|    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
48|}
49|
50|export function formatDate(iso: string) {
51|    return new Date(iso).toLocaleDateString(undefined, {
52|        day: "numeric",
53|        month: "short",
54|        year: "numeric",
55|    });
56|}
57|
58|export function DocIcon({ fileType }: { fileType: string | null }) {
59|    if (fileType === "pdf")
60|        return <FileText className="h-4 w-4 text-red-600 shrink-0" />;
61|    if (fileType === "docx" || fileType === "doc")
62|        return <File className="h-4 w-4 text-blue-600 shrink-0" />;
63|    return <File className="h-4 w-4 text-gray-500 shrink-0" />;
64|}
65|
66|export function DocVersionHistory({
67|    docId,
68|    filename,
69|    fileType,
70|    activeVersionNumber,
71|    currentVersionId,
72|    loading,
73|    versions,
74|    depth = 0,
75|    onDownloadVersion,
76|    onOpenVersion,
77|    onRenameVersion,
78|    onExtensionChangeBlocked,
79|}: {
80|    docId: string;
81|    filename: string;
82|    fileType: string | null;
83|    activeVersionNumber: number | null;
84|    currentVersionId: string | null;
85|    loading: boolean;
86|    versions: DocumentVersion[];
87|    depth?: number;
88|    onDownloadVersion: (
89|        docId: string,
90|        versionId: string,
91|        filename: string,
92|    ) => void;
93|    onOpenVersion?: (versionId: string, versionLabel: string) => void;
94|    onRenameVersion?: (
95|        versionId: string,
96|        filename: string | null,
97|    ) => Promise<void> | void;
98|    onExtensionChangeBlocked?: (filename: string) => void;
99|}) {
100|    const [editingVersionId, setEditingVersionId] = useState<string | null>(
101|        null,
102|    );
103|    const [editingValue, setEditingValue] = useState("");
104|
105|    const commit = async (versionId: string) => {
106|        const trimmed = editingValue.trim();
107|        const previousFilename = versions
108|            .find((version) => version.id === versionId)
109|            ?.filename?.trim();
110|        if (
111|            previousFilename &&
112|            (trimmed.length === 0 ||
113|                hasFilenameExtensionChange(previousFilename, trimmed))
114|        ) {
115|            onExtensionChangeBlocked?.(previousFilename);
116|            return;
117|        }
118|
119|        setEditingVersionId(null);
120|        const next = trimmed.length > 0 ? trimmed : null;
121|        await onRenameVersion?.(versionId, next);
122|    };
123|
124|    if (loading && versions.length === 0) {
125|        const skeletonCount = Math.max(0, (activeVersionNumber ?? 1) - 1);
126|        return (
127|            <>
128|                {Array.from({ length: skeletonCount }).map((_, index) => (
129|                    <div
130|                        key={`ver-skeleton-${docId}-${index}`}
131|                        className="flex h-10 items-center pr-8 bg-gray-100"
132|                    >
133|                        <div
134|                            className={`sticky left-0 z-[60] ${DOC_NAME_COL_W} bg-gray-100 py-2 pl-4 pr-2`}
135|                            style={treeNameCellStyle(depth)}
136|                        >
137|                            <div className="flex items-center gap-4">
138|                                <div className="h-2.5 w-2.5 shrink-0 rounded bg-gray-200 animate-pulse" />
139|                                <div className="h-4 w-4 shrink-0 rounded bg-gray-200 animate-pulse" />
140|                                <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
141|                            </div>
142|                        </div>
143|                        <div className="ml-auto w-20 shrink-0">
144|                            <div className="h-3 w-8 rounded bg-gray-200 animate-pulse" />
145|                        </div>
146|                        <div className="w-24 shrink-0">
147|                            <div className="h-3 w-10 rounded bg-gray-200 animate-pulse" />
148|                        </div>
149|                        <div className="w-20 shrink-0 pl-1">
150|                            <div className="h-3 w-5 rounded bg-gray-200 animate-pulse" />
151|                        </div>
152|                        <div className="w-32 shrink-0">
153|                            <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
154|                        </div>
155|                        <div className="w-32 shrink-0">
156|                            <div className="h-3 w-10 rounded bg-gray-200 animate-pulse" />
157|                        </div>
158|                        <div className="w-8 shrink-0" />
159|                    </div>
160|                ))}
161|            </>
162|        );
163|    }
164|
165|    if (versions.length === 0) {
166|        return (
167|            <div className="flex items-center h-9 border-b border-gray-50 text-xs text-gray-400 bg-gray-50/80">
168|                <div
169|                    className={`sticky left-0 z-[60] ${DOC_NAME_COL_W} bg-gray-50/80 py-2 pl-4 pr-2`}
170|                    style={treeNameCellStyle(depth)}
171|                >
172|                    <div>No version history.</div>
173|                </div>
174|            </div>
175|        );
176|    }
177|
178|    const olderVersions = versions.filter((v) => v.id !== currentVersionId);
179|    if (olderVersions.length === 0) return null;
180|
181|    const ordered = [...olderVersions].reverse();
182|    return (
183|        <>
184|            {ordered.map((v) => {
185|                const numberLabel =
186|                    typeof v.version_number === "number" &&
187|                    v.version_number >= 1
188|                        ? `${v.version_number}`
189|                        : v.source === "upload"
190|                          ? "Original"
191|                          : "—";
192|                const displayLabel = v.filename?.trim() || numberLabel;
193|                const dt = new Date(v.created_at);
194|                const dateLabel = Number.isNaN(dt.valueOf())
195|                    ? ""
196|                    : dt.toLocaleString(undefined, {
197|                          month: "short",
198|                          day: "numeric",
199|                          year: "numeric",
200|                          hour: "numeric",
201|                          minute: "2-digit",
202|                      });
203|                const isEditing = editingVersionId === v.id;
204|                const rowBg = "bg-gray-100";
205|                return (
206|                    <div
207|                        key={`ver-${docId}-${v.id}`}
208|                        onClick={() => {
209|                            if (isEditing) return;
210|                            onOpenVersion?.(v.id, displayLabel);
211|                        }}
212|                        className={`group flex h-10 cursor-pointer items-center pr-8 text-sm text-gray-500 transition-colors hover:bg-gray-200 ${rowBg}`}
213|                    >
214|                        <div
215|                            className={`sticky left-0 z-[60] ${DOC_NAME_COL_W} ${rowBg} py-2 pl-4 pr-2 transition-colors group-hover:bg-gray-200`}
216|                            style={treeNameCellStyle(depth)}
217|                        >
218|                            <div className="flex items-center gap-4">
219|                                <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center">
220|                                    <CornerDownRight
221|                                        className="h-3.5 w-3.5 text-gray-400"
222|                                        aria-hidden="true"
223|                                    />
224|                                </span>
225|                                <DocIcon fileType={fileType} />
226|                                {isEditing ? (
227|                                    <input
228|                                        autoFocus
229|                                        value={editingValue}
230|                                        onClick={(e) => e.stopPropagation()}
231|                                        onChange={(e) =>
232|                                            setEditingValue(e.target.value)
233|                                        }
234|                                        onKeyDown={(e) => {
235|                                            if (e.key === "Enter") {
236|                                                e.preventDefault();
237|                                                void commit(v.id);
238|                                            } else if (e.key === "Escape") {
239|                                                setEditingVersionId(null);
240|                                            }
241|                                        }}
242|                                        onBlur={() => void commit(v.id)}
243|                                        className="min-w-0 flex-1 border-b border-gray-300 bg-transparent text-sm text-gray-800 outline-none focus:border-gray-500"
244|                                    />
245|                                ) : (
246|                                    <span className="truncate text-sm text-gray-700">
247|                                        {displayLabel}
248|                                    </span>
249|                                )}
250|                            </div>
251|                        </div>
252|                        <div className="ml-auto w-20 shrink-0 truncate text-xs uppercase text-gray-500">
253|                            {fileType ?? <span className="text-gray-300">—</span>}
254|                        </div>
255|                        <div className="w-24 shrink-0 truncate text-sm text-gray-400">
256|                            —
257|                        </div>
258|                        <div className="w-20 shrink-0 truncate pl-1 text-sm text-gray-500">
259|                            {numberLabel}
260|                        </div>
261|                        <div className="w-32 shrink-0 truncate text-sm text-gray-500">
262|                            {dateLabel ? formatDate(v.created_at) : <span className="text-gray-300">—</span>}
263|                        </div>
264|                        <div className="w-32 shrink-0 truncate text-sm text-gray-400">
265|                            —
266|                        </div>
267|                        <div
268|                            className="w-8 shrink-0 flex justify-end"
269|                            onClick={(e) => e.stopPropagation()}
270|                        >
271|                            <RowActions
272|                                onRename={
273|                                    onRenameVersion
274|                                        ? () => {
275|                                              setEditingVersionId(v.id);
276|                                              setEditingValue(v.filename ?? "");
277|                                          }
278|                                        : undefined
279|                                }
280|                                renameLabel="Rename version"
281|                                onDownload={() =>
282|                                    onDownloadVersion(docId, v.id, filename)
283|                                }
284|                            />
285|                        </div>
286|                    </div>
287|                );
288|            })}
289|        </>
290|    );
291|}
292|
293|export function ProjectPageSkeleton() {
294|    return (
295|        <div className="flex-1 overflow-y-auto">
296|            <PageHeader
297|                align="start"
298|                actionGap="lg"
299|                breadcrumbs={[
300|                    { label: "Projects" },
301|                    { loading: true, skeletonClassName: "w-40" },
302|                ]}
303|                actionGroups={[
304|                    [
305|                        {
306|                            disabled: true,
307|                            iconOnly: true,
308|                            title: "Search",
309|                            icon: <Search className="h-4 w-4" />,
310|                        },
311|                        {
312|                            disabled: true,
313|                            iconOnly: true,
314|                            title: "People with access",
315|                            icon: <Users className="h-4 w-4" />,
316|                        },
317|                    ],
318|                    [
319|                        {
320|                            disabled: true,
321|                            icon: <MessageSquare className="h-4 w-4" />,
322|                            label: <span className="hidden sm:inline">New Chat</span>,
323|                        },
324|                        {
325|                            disabled: true,
326|                            icon: <Table2 className="h-4 w-4" />,
327|                            label: <span className="hidden sm:inline">New Review</span>,
328|                        },
329|                    ],
330|                ]}
331|            />
332|            <div className="flex items-center h-10 px-4 md:px-10 border-b border-gray-200 gap-5">
333|                <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
334|                <div className="h-3 w-10 rounded bg-gray-100 animate-pulse" />
335|                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
336|                <div className="ml-auto flex items-center gap-5">
337|                    <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
338|                    <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
339|                </div>
340|            </div>
341|            <div className="flex items-center h-8 pr-3 md:pr-10 border-b border-gray-200">
342|                <div className={`${DOC_NAME_COL_W} flex shrink-0 items-center gap-4 pl-4 pr-2`}>
343|                    <div className="h-2.5 w-2.5 rounded bg-gray-100 animate-pulse" />
344|                    <div className="h-2.5 w-8 rounded bg-gray-100 animate-pulse" />
345|                </div>
346|                <div className="w-20 shrink-0">
347|                    <div className="h-2.5 w-8 rounded bg-gray-100 animate-pulse" />
348|                </div>
349|                <div className="w-24 shrink-0">
350|                    <div className="h-2.5 w-8 rounded bg-gray-100 animate-pulse" />
351|                </div>
352|                <div className="w-8 shrink-0" />
353|            </div>
354|            {[1, 2, 3, 4, 5].map((i) => (
355|                <div
356|                    key={i}
357|                    className="flex items-center h-10 pr-3 md:pr-10 border-b border-gray-50"
358|                >
359|                    <div className={`${DOC_NAME_COL_W} flex shrink-0 items-center gap-4 pl-4 pr-2`}>
360|                        <div className="h-2.5 w-2.5 shrink-0 rounded bg-gray-100 animate-pulse" />
361|                        <div className="h-3.5 w-56 rounded bg-gray-100 animate-pulse" />
362|                    </div>
363|                    <div className="w-20 shrink-0">
364|                        <div className="h-3 w-8 rounded bg-gray-100 animate-pulse" />
365|                    </div>
366|                    <div className="w-24 shrink-0">
367|                        <div className="h-3 w-12 rounded bg-gray-100 animate-pulse" />
368|                    </div>
369|                    <div className="w-8 shrink-0" />
370|                </div>
371|            ))}
372|        </div>
373|    );
374|}
375|
376|export function ProjectPageHeader({
377|    project,
378|    tab,
379|    search,
380|    creatingChat,
381|    creatingReview,
382|    docsCount,
383|    onBackToProjects,
384|    onTitleCommit,
385|    onSearchChange,
386|    onOpenPeople,
387|    onNewChat,
388|    onNewReview,
389|}: {
390|    project: Project;
391|    tab: ProjectTab;
392|    search: string;
393|    creatingChat: boolean;
394|    creatingReview: boolean;
395|    docsCount: number;
396|    onBackToProjects: () => void;
397|    onTitleCommit: (newName: string) => void | Promise<void>;
398|    onSearchChange: (search: string) => void;
399|    onOpenPeople: () => void;
400|    onNewChat: () => void;
401|    onNewReview: () => void;
402|}) {
403|    return (
404|        <PageHeader
405|            breadcrumbs={[
406|                {
407|                    label: "Projects",
408|                    onClick: onBackToProjects,
409|                    title: "Back to Projects",
410|                },
411|                {
412|                    label: (
413|                        <RenameableTitle
414|                            value={project.name}
415|                            onCommit={onTitleCommit}
416|                        />
417|                    ),
418|                    suffix: project.cm_number ? (
419|                        <span className="ml-1 text-gray-400">
420|                            (#{project.cm_number})
421|                        </span>
422|                    ) : null,
423|                },
424|            ]}
425|            align="start"
426|            actionGap="lg"
427|            actionGroups={[
428|                [
429|                    {
430|                        type: "search",
431|                        value: search,
432|                        onChange: onSearchChange,
433|                        placeholder: "Search…",
434|                    },
435|                    {
436|                        onClick: onOpenPeople,
437|                        iconOnly: true,
438|                        title: "People with access",
439|                        icon: <Users className="h-4 w-4" />,
440|                    },
441|                ],
442|                [
443|                    {
444|                        onClick: onNewChat,
445|                        disabled: creatingChat,
446|                        icon: creatingChat ? (
447|                                <Loader2 className="h-4 w-4 animate-spin" />
448|                            ) : (
449|                                <MessageSquare className="h-4 w-4" />
450|                            ),
451|                        label: <span className="hidden sm:inline">New Chat</span>,
452|                    },
453|                    {
454|                        onClick: onNewReview,
455|                        disabled: docsCount === 0 || creatingReview,
456|                        icon: creatingReview ? (
457|                                <Loader2 className="h-4 w-4 animate-spin" />
458|                            ) : (
459|                                <Table2 className="h-4 w-4" />
460|                            ),
461|                        label: (
462|                            <span className="hidden sm:inline">
463|                                New Review
464|                            </span>
465|                        ),
466|                        tooltip: docsCount === 0 ? "Upload a document first" : null,
467|                    },
468|                ],
469|            ]}
470|        />
471|    );
472|}
473|
474|function filenameExtension(filename: string) {
475|    const trimmed = filename.trim();
476|    const dotIndex = trimmed.lastIndexOf(".");
477|    if (dotIndex <= 0 || dotIndex === trimmed.length - 1) return null;
478|    return trimmed.slice(dotIndex);
479|}
480|
481|function hasFilenameExtensionChange(previous: string, next: string) {
482|    const previousExtension = filenameExtension(previous);
483|    if (previousExtension == null) return false;
484|    return (
485|        filenameExtension(next)?.toLowerCase() !==
486|        previousExtension.toLowerCase()
487|    );
488|}
489|