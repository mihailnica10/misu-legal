1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { useRouter } from "next/navigation";
5|import { FolderOpen, ChevronDown } from "lucide-react";
6|import { listProjects, updateProject, deleteProject } from "@/app/lib/misuApi";
7|import { OwnerOnlyModal } from "@/app/components/shared/OwnerOnlyModal";
8|import { useAuth } from "@/contexts/AuthContext";
9|import type { Project } from "@/app/components/shared/types";
10|import { NewProjectModal } from "./NewProjectModal";
11|import { ToolbarTabs } from "@/app/components/shared/ToolbarTabs";
12|import { RowActions } from "@/app/components/shared/RowActions";
13|import { PageHeader } from "@/app/components/shared/PageHeader";
14|
15|function formatDate(iso: string) {
16|    return new Date(iso).toLocaleDateString(undefined, {
17|        day: "numeric",
18|        month: "short",
19|        year: "numeric",
20|    });
21|}
22|
23|type Tab = "all" | "mine" | "shared-with-me";
24|
25|const NAME_COL_W = "w-[332px] shrink-0";
26|
27|export function ProjectsOverview() {
28|    const [projects, setProjects] = useState<Project[]>([]);
29|    const [loading, setLoading] = useState(true);
30|    const [loadError, setLoadError] = useState<string | null>(null);
31|    const [modalOpen, setModalOpen] = useState(false);
32|    const [activeTab, setActiveTab] = useState<Tab>("all");
33|    const [renamingId, setRenamingId] = useState<string | null>(null);
34|    const [renameValue, setRenameValue] = useState("");
35|    const [cmEditingId, setCmEditingId] = useState<string | null>(null);
36|    const [cmValue, setCmValue] = useState("");
37|    const [selectedIds, setSelectedIds] = useState<string[]>([]);
38|    const [actionsOpen, setActionsOpen] = useState(false);
39|    const [search, setSearch] = useState("");
40|    const [ownerOnlyAction, setOwnerOnlyAction] = useState<string | null>(null);
41|    const actionsRef = useRef<HTMLDivElement>(null);
42|    const router = useRouter();
43|    const { user, isAuthenticated, authLoading } = useAuth();
44|    const stickyCellBg = "bg-[#fcfcfd]";
45|
46|    useEffect(() => {
47|        if (authLoading) {
48|            setLoading(true);
49|            return;
50|        }
51|        if (!isAuthenticated) {
52|            setProjects([]);
53|            setLoadError(null);
54|            setLoading(false);
55|            return;
56|        }
57|
58|        let cancelled = false;
59|        setLoading(true);
60|        setLoadError(null);
61|        listProjects()
62|            .then((loaded) => {
63|                if (!cancelled) setProjects(loaded);
64|            })
65|            .catch((err) => {
66|                console.error("[projects] failed to load projects", err);
67|                if (!cancelled) {
68|                    setProjects([]);
69|                    setLoadError("Could not load projects.");
70|                }
71|            })
72|            .finally(() => {
73|                if (!cancelled) setLoading(false);
74|            });
75|
76|        return () => {
77|            cancelled = true;
78|        };
79|    }, [authLoading, isAuthenticated, user?.id]);
80|
81|    useEffect(() => {
82|        setSelectedIds([]);
83|    }, [activeTab]);
84|
85|    useEffect(() => {
86|        function handleClick(e: MouseEvent) {
87|            if (
88|                actionsRef.current &&
89|                !actionsRef.current.contains(e.target as Node)
90|            )
91|                setActionsOpen(false);
92|        }
93|        if (actionsOpen) document.addEventListener("mousedown", handleClick);
94|        return () => document.removeEventListener("mousedown", handleClick);
95|    }, [actionsOpen]);
96|
97|    const q = search.toLowerCase();
98|    const filtered = (
99|        activeTab === "all"
100|            ? projects
101|            : activeTab === "mine"
102|              ? projects.filter((p) => p.is_owner ?? p.user_id === user?.id)
103|              : projects.filter((p) => !(p.is_owner ?? p.user_id === user?.id))
104|    ).filter(
105|        (p) =>
106|            !q ||
107|            p.name.toLowerCase().includes(q) ||
108|            (p.cm_number ?? "").toLowerCase().includes(q),
109|    );
110|
111|    const allSelected =
112|        filtered.length > 0 &&
113|        filtered.every((p) => selectedIds.includes(p.id));
114|    const someSelected =
115|        !allSelected && filtered.some((p) => selectedIds.includes(p.id));
116|
117|    function toggleAll() {
118|        if (allSelected) {
119|            setSelectedIds([]);
120|        } else {
121|            setSelectedIds(filtered.map((p) => p.id));
122|        }
123|    }
124|
125|    function toggleOne(id: string) {
126|        setSelectedIds((prev) =>
127|            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
128|        );
129|    }
130|
131|    const tabs: { id: Tab; label: string }[] = [
132|        { id: "all", label: "All" },
133|        { id: "mine", label: "Mine" },
134|        { id: "shared-with-me", label: "Shared with me" },
135|    ];
136|
137|    async function handleRenameSubmit(projectId: string) {
138|        const trimmed = renameValue.trim();
139|        setRenamingId(null);
140|        if (!trimmed) return;
141|        setProjects((prev) =>
142|            prev.map((p) => (p.id === projectId ? { ...p, name: trimmed } : p)),
143|        );
144|        await updateProject(projectId, { name: trimmed });
145|    }
146|
147|    async function handleCmSubmit(projectId: string) {
148|        const trimmed = cmValue.trim();
149|        setCmEditingId(null);
150|        setProjects((prev) =>
151|            prev.map((p) =>
152|                p.id === projectId ? { ...p, cm_number: trimmed || null } : p,
153|            ),
154|        );
155|        await updateProject(projectId, { cm_number: trimmed || undefined });
156|    }
157|
158|    async function handleDeleteSelected() {
159|        const ids = [...selectedIds];
160|        setActionsOpen(false);
161|        // Only the project owner can delete; the per-row delete is hidden
162|        // for shared projects but the bulk action can still pick them up
163|        // if a user toggled them across tabs. Filter and warn.
164|        const owned = ids.filter((id) => {
165|            const p = projects.find((pp) => pp.id === id);
166|            return !p || (p.is_owner ?? p.user_id === user?.id);
167|        });
168|        const blocked = ids.length - owned.length;
169|        setSelectedIds([]);
170|        await Promise.all(owned.map((id) => deleteProject(id).catch(() => {})));
171|        setProjects((prev) => prev.filter((p) => !owned.includes(p.id)));
172|        if (blocked > 0) {
173|            setOwnerOnlyAction(
174|                `delete ${blocked} of the selected projects — only the project owner can delete a project`,
175|            );
176|        }
177|    }
178|
179|    const toolbarActions = (
180|        <>
181|            {selectedIds.length > 0 && (
182|                <div ref={actionsRef} className="relative">
183|                    <button
184|                        onClick={() => setActionsOpen((v) => !v)}
185|                        className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
186|                    >
187|                        Actions
188|                        <ChevronDown className="h-3.5 w-3.5" />
189|                    </button>
190|                    {actionsOpen && (
191|                        <div className="absolute top-full right-0 mt-1 w-36 rounded-lg border border-gray-100 bg-white shadow-lg z-50 overflow-hidden">
192|                            <button
193|                                onClick={handleDeleteSelected}
194|                                className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 transition-colors"
195|                            >
196|                                Delete
197|                            </button>
198|                        </div>
199|                    )}
200|                </div>
201|            )}
202|        </>
203|    );
204|
205|    return (
206|        <div className="flex-1 overflow-y-auto">
207|            {/* Page header */}
208|            <PageHeader
209|                actions={[
210|                    {
211|                        type: "search",
212|                        value: search,
213|                        onChange: setSearch,
214|                        placeholder: "Search projects…",
215|                    },
216|                    {
217|                        type: "new",
218|                        onClick: () => setModalOpen(true),
219|                        title: "New project",
220|                    },
221|                ]}
222|            >
223|                <h1 className="text-2xl font-medium font-serif text-gray-900">
224|                    Projects
225|                </h1>
226|            </PageHeader>
227|
228|            <ToolbarTabs
229|                tabs={tabs}
230|                active={activeTab}
231|                onChange={setActiveTab}
232|                actions={toolbarActions}
233|            />
234|
235|            {/* Table */}
236|            <div className="w-full overflow-x-auto">
237|                <div className="min-w-max">
238|                {/* Column headers */}
239|                <div className="flex items-center h-8 pr-3 md:pr-10 border-b border-gray-200 text-xs text-gray-500 font-medium select-none">
240|                    <div className={`sticky left-0 z-[60] ${NAME_COL_W} ${stickyCellBg} flex items-center gap-4 self-stretch pl-4 pr-2 text-left`}>
241|                        {loading ? (
242|                            <div className="h-2.5 w-2.5 shrink-0 rounded bg-gray-100 animate-pulse" />
243|                        ) : (
244|                            <input
245|                                type="checkbox"
246|                                checked={allSelected}
247|                                ref={(el) => {
248|                                    if (el) el.indeterminate = someSelected;
249|                                }}
250|                                onChange={toggleAll}
251|                                className="h-2.5 w-2.5 rounded border-gray-200 cursor-pointer accent-black"
252|                            />
253|                        )}
254|                        <span>Name</span>
255|                    </div>
256|                    <div className="ml-auto w-32 shrink-0 text-left">CM</div>
257|                    <div className="w-24 shrink-0 text-left">Files</div>
258|                    <div className="w-24 shrink-0 text-left">Chats</div>
259|                    <div className="w-36 shrink-0 text-left">
260|                        Tabular Reviews
261|                    </div>
262|                    <div className="w-32 shrink-0 text-left">Created</div>
263|                    <div className="w-8 shrink-0" />
264|                </div>
265|
266|                {loading ? (
267|                    <div>
268|                        {[1, 2, 3].map((i) => (
269|                            <div
270|                                key={i}
271|                                className="flex items-center h-10 pr-3 md:pr-10 border-b border-gray-50"
272|                            >
273|                                <div className={`${NAME_COL_W} flex shrink-0 items-center gap-4 pl-4 pr-2`}>
274|                                    <div className="h-2.5 w-2.5 shrink-0 rounded bg-gray-100 animate-pulse" />
275|                                    <div className="h-3.5 w-48 rounded bg-gray-100 animate-pulse" />
276|                                </div>
277|                                <div className="w-32 shrink-0">
278|                                    <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
279|                                </div>
280|                                <div className="w-24 shrink-0">
281|                                    <div className="h-3 w-8 rounded bg-gray-100 animate-pulse" />
282|                                </div>
283|                                <div className="w-24 shrink-0">
284|                                    <div className="h-3 w-8 rounded bg-gray-100 animate-pulse" />
285|                                </div>
286|                                <div className="w-36 shrink-0">
287|                                    <div className="h-3 w-8 rounded bg-gray-100 animate-pulse" />
288|                                </div>
289|                                <div className="w-32 shrink-0">
290|                                    <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
291|                                </div>
292|                                <div className="w-8 shrink-0" />
293|                            </div>
294|                        ))}
295|                    </div>
296|                ) : loadError ? (
297|                    <div className="flex flex-col items-start py-24 w-full max-w-xs mx-auto">
298|                        <FolderOpen className="h-8 w-8 text-gray-300 mb-4" />
299|                        <p className="text-2xl font-medium font-serif text-gray-900">
300|                            Projects
301|                        </p>
302|                        <p className="mt-1 text-xs text-red-500 max-w-xs">
303|                            {loadError}
304|                        </p>
305|                    </div>
306|                ) : filtered.length === 0 ? (
307|                    <div className="flex flex-col items-start py-24 w-full max-w-xs mx-auto">
308|                        {activeTab === "all" || activeTab === "mine" ? (
309|                            <>
310|                                <FolderOpen className="h-8 w-8 text-gray-300 mb-4" />
311|                                <p className="text-2xl font-medium font-serif text-gray-900">
312|                                    Projects
313|                                </p>
314|                                <p className="mt-1 text-xs text-gray-400 max-w-xs">
315|                                    Upload documents into projects and to
316|                                    commence chats and tabular reviews with
317|                                    them.
318|                                </p>
319|                                <button
320|                                    onClick={() => setModalOpen(true)}
321|                                    className="mt-4 inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 transition-colors shadow-md"
322|                                >
323|                                    + Create New
324|                                </button>
325|                            </>
326|                        ) : (
327|                            <p className="text-sm text-gray-400">
328|                                No {activeTab} projects
329|                            </p>
330|                        )}
331|                    </div>
332|                ) : (
333|                    <div>
334|                        {filtered.map((project) => {
335|                            const rowBg = selectedIds.includes(project.id)
336|                                ? "bg-gray-50"
337|                                : stickyCellBg;
338|                            return (
339|                            <div
340|                                key={project.id}
341|                                onClick={() => {
342|                                    if (renamingId === project.id) return;
343|                                    router.push(`/projects/${project.id}`);
344|                                }}
345|                                className="group flex items-center h-10 pr-3 md:pr-10 border-b border-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
346|                            >
347|                                {/* Project Name */}
348|                                <div className={`sticky left-0 z-[60] ${NAME_COL_W} ${rowBg} py-2 pl-4 pr-2 transition-colors group-hover:bg-gray-100`}>
349|                                    <div className="flex min-w-0 items-center gap-4">
350|                                        <input
351|                                            type="checkbox"
352|                                            checked={selectedIds.includes(
353|                                                project.id,
354|                                            )}
355|                                            onChange={() => toggleOne(project.id)}
356|                                            onClick={(e) => e.stopPropagation()}
357|                                            className="h-2.5 w-2.5 shrink-0 rounded border-gray-200 cursor-pointer accent-black"
358|                                        />
359|                                        {renamingId === project.id ? (
360|                                            <input
361|                                                autoFocus
362|                                                value={renameValue}
363|                                                onChange={(e) =>
364|                                                    setRenameValue(e.target.value)
365|                                                }
366|                                                onKeyDown={(e) => {
367|                                                    if (e.key === "Enter")
368|                                                        handleRenameSubmit(
369|                                                            project.id,
370|                                                        );
371|                                                    if (e.key === "Escape")
372|                                                        setRenamingId(null);
373|                                                }}
374|                                                onBlur={() =>
375|                                                    handleRenameSubmit(project.id)
376|                                                }
377|                                                onClick={(e) => e.stopPropagation()}
378|                                                className="min-w-0 flex-1 text-sm text-gray-800 bg-transparent outline-none"
379|                                            />
380|                                        ) : (
381|                                            <span className="min-w-0 flex-1 truncate text-sm text-gray-800">
382|                                                {project.name}
383|                                            </span>
384|                                        )}
385|                                    </div>
386|                                </div>
387|
388|                                <div
389|                                    className="ml-auto w-32 shrink-0 text-sm text-gray-500 truncate"
390|                                    onClick={(e) => e.stopPropagation()}
391|                                >
392|                                    {cmEditingId === project.id ? (
393|                                        <input
394|                                            autoFocus
395|                                            value={cmValue}
396|                                            onChange={(e) =>
397|                                                setCmValue(e.target.value)
398|                                            }
399|                                            onKeyDown={(e) => {
400|                                                if (e.key === "Enter")
401|                                                    handleCmSubmit(project.id);
402|                                                if (e.key === "Escape")
403|                                                    setCmEditingId(null);
404|                                            }}
405|                                            onBlur={() =>
406|                                                handleCmSubmit(project.id)
407|                                            }
408|                                            placeholder="CM #"
409|                                            className="w-full text-sm text-gray-800 bg-transparent outline-none"
410|                                        />
411|                                    ) : (
412|                                        (project.cm_number ?? (
413|                                            <span className="text-gray-300">
414|                                                —
415|                                            </span>
416|                                        ))
417|                                    )}
418|                                </div>
419|                                <div className="w-24 shrink-0 text-sm text-gray-500 truncate">
420|                                    {project.document_count ?? 0}
421|                                </div>
422|                                <div className="w-24 shrink-0 text-sm text-gray-500 truncate">
423|                                    {project.chat_count ?? 0}
424|                                </div>
425|                                <div className="w-36 shrink-0 text-sm text-gray-500 truncate">
426|                                    {project.review_count ?? 0}
427|                                </div>
428|                                <div className="w-32 shrink-0 text-sm text-gray-500 truncate">
429|                                    {formatDate(project.created_at)}
430|                                </div>
431|
432|                                <div
433|                                    className="w-8 shrink-0 flex justify-end"
434|                                    onClick={(e) => e.stopPropagation()}
435|                                >
436|                                    {(project.is_owner ??
437|                                        project.user_id === user?.id) && (
438|                                        <RowActions
439|                                            onRename={() => {
440|                                                setRenameValue(project.name);
441|                                                setRenamingId(project.id);
442|                                            }}
443|                                            onUpdateCmNumber={() => {
444|                                                setCmValue(
445|                                                    project.cm_number ?? "",
446|                                                );
447|                                                setCmEditingId(project.id);
448|                                            }}
449|                                            onDelete={async () => {
450|                                                await deleteProject(project.id);
451|                                                setProjects((prev) =>
452|                                                    prev.filter(
453|                                                        (p) =>
454|                                                            p.id !== project.id,
455|                                                    ),
456|                                                );
457|                                            }}
458|                                        />
459|                                    )}
460|                                </div>
461|                            </div>
462|                            );
463|                        })}
464|                    </div>
465|                )}
466|            </div>
467|            </div>
468|
469|            <NewProjectModal
470|                open={modalOpen}
471|                onClose={() => setModalOpen(false)}
472|                onCreated={(p) => {
473|                    setProjects((prev) => [p, ...prev]);
474|                    router.push(`/projects/${p.id}`);
475|                }}
476|            />
477|
478|            <OwnerOnlyModal
479|                open={!!ownerOnlyAction}
480|                action={ownerOnlyAction ?? undefined}
481|                onClose={() => setOwnerOnlyAction(null)}
482|            />
483|        </div>
484|    );
485|}
486|