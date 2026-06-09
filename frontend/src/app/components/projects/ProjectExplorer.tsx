1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import {
5|    FileText,
6|    File,
7|    Folder,
8|    FolderOpen,
9|    ChevronRight,
10|    ChevronDown,
11|    FolderPlus,
12|    Trash2,
13|} from "lucide-react";
14|import type {
15|    Document,
16|    Folder as ProjectFolder,
17|} from "@/app/components/shared/types";
18|import { VersionChip } from "@/app/components/shared/VersionChip";
19|
20|interface Props {
21|    projectName?: string | null;
22|    documents: Document[];
23|    folders?: ProjectFolder[];
24|    selectedDocId?: string | null;
25|    onDocClick: (doc: Document) => void;
26|    onCreateFolder?: (parentFolderId: string | null, name: string) => Promise<void>;
27|    onRenameFolder?: (folderId: string, name: string) => Promise<void>;
28|    onDeleteFolder?: (folderId: string) => Promise<void>;
29|    onDeleteDoc?: (docId: string) => Promise<void>;
30|    onMoveDoc?: (docId: string, targetFolderId: string | null) => Promise<void>;
31|    onMoveFolder?: (folderId: string, targetFolderId: string | null) => Promise<void>;
32|}
33|
34|function DocIcon({ fileType }: { fileType: string | null }) {
35|    if (fileType === "pdf")
36|        return <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />;
37|    if (fileType === "docx" || fileType === "doc")
38|        return <File className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
39|    return <File className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
40|}
41|
42|type ContextMenuState = {
43|    x: number;
44|    y: number;
45|    parentId: string | null;      // folder to create inside (null = root)
46|    folderId?: string;             // set if right-clicked on a specific folder
47|    docId?: string;                // set if right-clicked on a specific document
48|};
49|
50|export function ProjectExplorer({
51|    projectName,
52|    documents,
53|    folders = [],
54|    selectedDocId,
55|    onDocClick,
56|    onCreateFolder,
57|    onRenameFolder,
58|    onDeleteFolder,
59|    onDeleteDoc,
60|    onMoveDoc,
61|    onMoveFolder,
62|}: Props) {
63|    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
64|    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
65|    const [creatingIn, setCreatingIn] = useState<string | null | undefined>(undefined);
66|    const [newFolderName, setNewFolderName] = useState("");
67|    const [renamingId, setRenamingId] = useState<string | null>(null);
68|    const [renameValue, setRenameValue] = useState("");
69|    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
70|    const [dragOverRoot, setDragOverRoot] = useState(false);
71|    const newFolderInputRef = useRef<HTMLInputElement>(null);
72|    const contextMenuRef = useRef<HTMLDivElement>(null);
73|
74|    // Close context menu on outside click
75|    useEffect(() => {
76|        if (!contextMenu) return;
77|        function handle(e: MouseEvent) {
78|            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
79|                setContextMenu(null);
80|            }
81|        }
82|        document.addEventListener("mousedown", handle);
83|        return () => document.removeEventListener("mousedown", handle);
84|    }, [contextMenu]);
85|
86|    // Clear all drag state when drag ends
87|    useEffect(() => {
88|        function handleDragEnd() {
89|            setDragOverFolderId(null);
90|            setDragOverRoot(false);
91|        }
92|        document.addEventListener("dragend", handleDragEnd);
93|        return () => document.removeEventListener("dragend", handleDragEnd);
94|    }, []);
95|
96|    function toggleFolder(id: string) {
97|        setExpandedIds((prev) => {
98|            const next = new Set(prev);
99|            next.has(id) ? next.delete(id) : next.add(id);
100|            return next;
101|        });
102|    }
103|
104|    async function commitNewFolder(parentId: string | null) {
105|        const name = newFolderName.trim();
106|        // Empty name → leave the input in place. Users dismiss with Escape.
107|        // This guards against a React StrictMode race where the simulated
108|        // unmount fires a blur that would otherwise immediately collapse
109|        // the freshly-mounted input.
110|        if (!name) return;
111|        setCreatingIn(undefined);
112|        setNewFolderName("");
113|        if (!onCreateFolder) return;
114|        await onCreateFolder(parentId, name);
115|        if (parentId) setExpandedIds((prev) => new Set([...prev, parentId]));
116|    }
117|
118|    async function commitRename(folderId: string) {
119|        const name = renameValue.trim();
120|        setRenamingId(null);
121|        if (!name || !onRenameFolder) return;
122|        await onRenameFolder(folderId, name);
123|    }
124|
125|    function openContextMenu(
126|        e: React.MouseEvent,
127|        parentId: string | null,
128|        folderId?: string,
129|        docId?: string,
130|    ) {
131|        e.preventDefault();
132|        e.stopPropagation();
133|        setContextMenu({ x: e.clientX, y: e.clientY, parentId, folderId, docId });
134|    }
135|
136|    function wouldCreateCycle(movingId: string, targetId: string): boolean {
137|        let cur: ProjectFolder | undefined = folders.find((f) => f.id === targetId);
138|        while (cur) {
139|            if (cur.id === movingId) return true;
140|            if (!cur.parent_folder_id) break;
141|            cur = folders.find((f) => f.id === cur!.parent_folder_id);
142|        }
143|        return false;
144|    }
145|
146|    async function handleDropOnTarget(targetFolderId: string | null, e: React.DragEvent) {
147|        const docId = e.dataTransfer.getData("application/misu-doc");
148|        const movingFolderId = e.dataTransfer.getData("application/misu-folder");
149|
150|        if (docId && onMoveDoc) {
151|            const doc = documents.find((d) => d.id === docId);
152|            if (!doc || (doc.folder_id ?? null) === targetFolderId) return;
153|            await onMoveDoc(docId, targetFolderId);
154|        } else if (movingFolderId && movingFolderId !== targetFolderId && onMoveFolder) {
155|            if (targetFolderId !== null && wouldCreateCycle(movingFolderId, targetFolderId)) return;
156|            const folder = folders.find((f) => f.id === movingFolderId);
157|            if (!folder || (folder.parent_folder_id ?? null) === targetFolderId) return;
158|            await onMoveFolder(movingFolderId, targetFolderId);
159|        }
160|    }
161|
162|    function isInternalDrag(e: React.DragEvent): boolean {
163|        return (
164|            Array.from(e.dataTransfer.types).includes("application/misu-doc") ||
165|            Array.from(e.dataTransfer.types).includes("application/misu-folder")
166|        );
167|    }
168|
169|    function renderLevel(parentId: string | null, depth: number): React.ReactNode {
170|        const basePadding = 28 + (depth - 1) * 16; // pl-7 at depth 1, +16px per level
171|        const childFolders = folders
172|            .filter((f) => f.parent_folder_id === parentId)
173|            .sort((a, b) => a.name.localeCompare(b.name));
174|        const childDocs = documents.filter((d) => (d.folder_id ?? null) === parentId);
175|
176|        return (
177|            <>
178|                {/* Inline new-folder input */}
179|                {creatingIn === parentId && (
180|                    <li
181|                        className="flex items-center gap-1.5 py-1.5 pr-2 select-none"
182|                        style={{ paddingLeft: basePadding }}
183|                    >
184|                        <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />
185|                        <FolderPlus className="h-3.5 w-3.5 text-amber-400 shrink-0" />
186|                        <input
187|                            ref={newFolderInputRef}
188|                            autoFocus
189|                            className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b border-gray-300 text-gray-800"
190|                            placeholder="Folder name"
191|                            value={newFolderName}
192|                            onChange={(e) => setNewFolderName(e.target.value)}
193|                            onKeyDown={(e) => {
194|                                if (e.key === "Enter") void commitNewFolder(parentId);
195|                                if (e.key === "Escape") { setCreatingIn(undefined); setNewFolderName(""); }
196|                            }}
197|                            onBlur={() => void commitNewFolder(parentId)}
198|                        />
199|                    </li>
200|                )}
201|
202|                {/* Child folders */}
203|                {childFolders.map((folder) => {
204|                    const isExpanded = expandedIds.has(folder.id);
205|                    const isRenaming = renamingId === folder.id;
206|                    const isDragTarget = dragOverFolderId === folder.id;
207|                    return (
208|                        <li key={`f-${folder.id}`}>
209|                            <div
210|                                draggable
211|                                onDragStart={(e) => {
212|                                    e.dataTransfer.setData("application/misu-folder", folder.id);
213|                                    e.dataTransfer.effectAllowed = "move";
214|                                    e.stopPropagation();
215|                                }}
216|                                onDragOver={(e) => {
217|                                    e.preventDefault();
218|                                    e.stopPropagation();
219|                                    setDragOverFolderId(folder.id);
220|                                    setDragOverRoot(false);
221|                                }}
222|                                onDragLeave={(e) => {
223|                                    e.stopPropagation();
224|                                    setDragOverFolderId(null);
225|                                }}
226|                                onDrop={async (e) => {
227|                                    e.preventDefault();
228|                                    if (isInternalDrag(e)) {
229|                                        e.stopPropagation();
230|                                        setDragOverFolderId(null);
231|                                        setDragOverRoot(false);
232|                                        await handleDropOnTarget(folder.id, e);
233|                                    }
234|                                }}
235|                                className={`flex items-center gap-1.5 py-1.5 pr-2 rounded-sm cursor-pointer select-none transition-colors group ${
236|                                    isDragTarget
237|                                        ? "bg-blue-50 ring-1 ring-inset ring-blue-200"
238|                                        : "hover:bg-gray-50"
239|                                }`}
240|                                style={{ paddingLeft: basePadding }}
241|                                onClick={() => toggleFolder(folder.id)}
242|                                onContextMenu={(e) =>
243|                                    openContextMenu(e, folder.id, folder.id)
244|                                }
245|                            >
246|                                {isExpanded
247|                                    ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
248|                                    : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
249|                                }
250|                                {isExpanded
251|                                    ? <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
252|                                    : <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
253|                                }
254|                                {isRenaming ? (
255|                                    <input
256|                                        autoFocus
257|                                        className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b border-gray-300 text-gray-800"
258|                                        value={renameValue}
259|                                        onChange={(e) => setRenameValue(e.target.value)}
260|                                        onKeyDown={(e) => {
261|                                            if (e.key === "Enter") void commitRename(folder.id);
262|                                            if (e.key === "Escape") setRenamingId(null);
263|                                        }}
264|                                        onBlur={() => void commitRename(folder.id)}
265|                                        onClick={(e) => e.stopPropagation()}
266|                                    />
267|                                ) : (
268|                                    <span className="text-xs text-gray-600 truncate">{folder.name}</span>
269|                                )}
270|                            </div>
271|                            {isExpanded && (
272|                                <ul>{renderLevel(folder.id, depth + 1)}</ul>
273|                            )}
274|                        </li>
275|                    );
276|                })}
277|
278|                {/* Child documents */}
279|                {childDocs.map((doc) => {
280|                    const isSelected = doc.id === selectedDocId;
281|                    return (
282|                        <li
283|                            key={`d-${doc.id}`}
284|                            draggable
285|                            onDragStart={(e) => {
286|                                e.dataTransfer.setData("application/misu-doc", doc.id);
287|                                e.dataTransfer.effectAllowed = "move";
288|                            }}
289|                            onDragOver={(e) => e.stopPropagation()} // don't let doc rows affect root drag state
290|                            onClick={() => onDocClick(doc)}
291|                            onContextMenu={(e) =>
292|                                openContextMenu(
293|                                    e,
294|                                    doc.folder_id ?? null,
295|                                    undefined,
296|                                    doc.id,
297|                                )
298|                            }
299|                            className={`flex items-center gap-2 py-1.5 pr-4 rounded-sm cursor-pointer select-none transition-colors ${
300|                                isSelected ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
301|                            }`}
302|                            style={{ paddingLeft: basePadding }}
303|                        >
304|                            <DocIcon fileType={doc.file_type} />
305|                            <span className="text-xs truncate">
306|                                {doc.filename}
307|                            </span>
308|                            <VersionChip
309|                                n={
310|                                    doc.active_version_number ??
311|                                    doc.latest_version_number
312|                                }
313|                            />
314|                        </li>
315|                    );
316|                })}
317|            </>
318|        );
319|    }
320|
321|    return (
322|        <ul
323|            className={`p-1 relative h-full ${dragOverRoot && dragOverFolderId === null ? "ring-2 ring-blue-400 ring-inset" : ""}`}
324|            onContextMenu={(e) => {
325|                // Only fires if not stopped by a child
326|                openContextMenu(e, null);
327|            }}
328|            onDragOver={(e) => {
329|                e.preventDefault();
330|                setDragOverRoot(true);
331|            }}
332|            onDragLeave={(e) => {
333|                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
334|                    setDragOverRoot(false);
335|                }
336|            }}
337|            onDrop={async (e) => {
338|                e.preventDefault();
339|                if (isInternalDrag(e)) {
340|                    e.stopPropagation();
341|                    setDragOverRoot(false);
342|                    setDragOverFolderId(null);
343|                    await handleDropOnTarget(null, e);
344|                }
345|                // External file drops bubble up to the parent panel's onDrop (upload handler)
346|            }}
347|        >
348|            {/* Project root row */}
349|            {projectName && (
350|                <li
351|                    className="flex items-center gap-2 px-2 py-1.5 select-none"
352|                    onContextMenu={(e) => { e.stopPropagation(); openContextMenu(e, null); }}
353|                >
354|                    <FolderOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
355|                    <span className="text-xs text-gray-500 truncate">{projectName}</span>
356|                </li>
357|            )}
358|
359|            {/* Tree (depth 1 = direct children of root).
360|                Root-level new-folder input is rendered here by renderLevel
361|                when creatingIn === null — no separate top-level block. */}
362|            {renderLevel(null, 1)}
363|
364|            {/* Empty state */}
365|            {documents.length === 0 && folders.length === 0 && creatingIn === undefined && (
366|                <li className="px-4 py-2 text-xs text-gray-400">No documents in this project.</li>
367|            )}
368|
369|            {/* Context menu */}
370|            {contextMenu && (
371|                <div
372|                    ref={contextMenuRef}
373|                    className="fixed z-50 w-44 rounded-lg border border-gray-100 bg-white shadow-lg overflow-hidden text-xs"
374|                    style={{ top: contextMenu.y, left: contextMenu.x }}
375|                >
376|                    {onCreateFolder && (
377|                        <button
378|                            className="w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
379|                            onClick={() => {
380|                                setContextMenu(null);
381|                                if (contextMenu.parentId) {
382|                                    setExpandedIds((prev) =>
383|                                        new Set([...prev, contextMenu.parentId!]),
384|                                    );
385|                                }
386|                                setCreatingIn(contextMenu.parentId);
387|                                setNewFolderName("");
388|                            }}
389|                        >
390|                            <FolderPlus className="h-3.5 w-3.5 text-gray-400" />
391|                            New subfolder
392|                        </button>
393|                    )}
394|                    {contextMenu.folderId && onRenameFolder && (
395|                        <button
396|                            className="w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50"
397|                            onClick={() => {
398|                                const f = folders.find((x) => x.id === contextMenu.folderId);
399|                                setRenameValue(f?.name ?? "");
400|                                setRenamingId(contextMenu.folderId!);
401|                                setContextMenu(null);
402|                            }}
403|                        >
404|                            Rename
405|                        </button>
406|                    )}
407|                    {contextMenu.folderId && onDeleteFolder && (
408|                        <button
409|                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
410|                            onClick={() => {
411|                                onDeleteFolder(contextMenu.folderId!);
412|                                setContextMenu(null);
413|                            }}
414|                        >
415|                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
416|                            Delete folder
417|                        </button>
418|                    )}
419|                    {contextMenu.docId && onDeleteDoc && (
420|                        <button
421|                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
422|                            onClick={() => {
423|                                void onDeleteDoc(contextMenu.docId!);
424|                                setContextMenu(null);
425|                            }}
426|                        >
427|                            <Trash2 className="h-3.5 w-3.5 shrink-0" />
428|                            Delete file
429|                        </button>
430|                    )}
431|                </div>
432|            )}
433|        </ul>
434|    );
435|}
436|