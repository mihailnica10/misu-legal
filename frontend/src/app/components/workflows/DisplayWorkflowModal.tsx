1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { createPortal } from "react-dom";
5|import {
6|    ChevronDown,
7|    Folder,
8|    MessageSquare,
9|    Search,
10|    Table2,
11|    X,
12|} from "lucide-react";
13|import ReactMarkdown from "react-markdown";
14|import remarkGfm from "remark-gfm";
15|import type {
16|    Document,
17|    Workflow,
18|} from "../shared/types";
19|import { createTabularReview } from "@/app/lib/misuApi";
20|import { useRouter } from "next/navigation";
21|import { formatIcon, formatLabel } from "../tabular/columnFormat";
22|import { useDirectoryData } from "../shared/useDirectoryData";
23|import { FileDirectory } from "../shared/FileDirectory";
24|import type { Project } from "../shared/types";
25|import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";
26|
27|interface Props {
28|    workflows: Workflow[];
29|    workflow: Workflow | null;
30|    onClose: () => void;
31|}
32|
33|// ---------------------------------------------------------------------------
34|// Toggle switch
35|// ---------------------------------------------------------------------------
36|function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
37|    return (
38|        <button
39|            type="button"
40|            onClick={onToggle}
41|            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${on ? "bg-gray-900" : "bg-gray-200"}`}
42|        >
43|            <span
44|                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0"}`}
45|            />
46|        </button>
47|    );
48|}
49|
50|// ---------------------------------------------------------------------------
51|// Simple project picker (input + dropdown)
52|// ---------------------------------------------------------------------------
53|function SimpleProjectPicker({
54|    projects,
55|    selectedId,
56|    onSelect,
57|}: {
58|    projects: Project[];
59|    selectedId: string | null;
60|    onSelect: (id: string | null) => void;
61|}) {
62|    const [search, setSearch] = useState("");
63|    const [open, setOpen] = useState(false);
64|    const selected = projects.find((p) => p.id === selectedId);
65|    const filtered = search
66|        ? projects.filter((p) =>
67|              p.name.toLowerCase().includes(search.toLowerCase()),
68|          )
69|        : projects;
70|
71|    return (
72|        <div className="relative">
73|            <input
74|                type="text"
75|                value={selectedId ? (selected?.name ?? "") : search}
76|                onChange={(e) => {
77|                    setSearch(e.target.value);
78|                    setOpen(true);
79|                    onSelect(null);
80|                }}
81|                onFocus={() => setOpen(true)}
82|                onBlur={() => setTimeout(() => setOpen(false), 150)}
83|                placeholder="Select a project…"
84|                className="w-full text-xs text-gray-700 placeholder:text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 outline-none"
85|            />
86|            {selectedId && (
87|                <button
88|                    onMouseDown={() => {
89|                        onSelect(null);
90|                        setSearch("");
91|                    }}
92|                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
93|                >
94|                    <X className="h-3 w-3" />
95|                </button>
96|            )}
97|            {open && !selectedId && (
98|                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-sm overflow-y-auto max-h-40">
99|                    {filtered.length === 0 ? (
100|                        <p className="px-3 py-3 text-xs text-gray-400 text-center">
101|                            No projects found
102|                        </p>
103|                    ) : (
104|                        filtered.map((p) => (
105|                            <button
106|                                key={p.id}
107|                                onMouseDown={() => {
108|                                    onSelect(p.id);
109|                                    setSearch("");
110|                                    setOpen(false);
111|                                }}
112|                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-700"
113|                            >
114|                                <Folder className="h-3.5 w-3.5 shrink-0 text-gray-400" />
115|                                {p.name}
116|                            </button>
117|                        ))
118|                    )}
119|                </div>
120|            )}
121|        </div>
122|    );
123|}
124|
125|// ---------------------------------------------------------------------------
126|// Shared markdown renderer
127|// ---------------------------------------------------------------------------
128|function MarkdownBody({ content }: { content: string }) {
129|    return (
130|        <ReactMarkdown
131|            remarkPlugins={[remarkGfm]}
132|            components={{
133|                h1: ({ children }) => (
134|                    <h1 className="text-base font-semibold text-gray-900 mt-4 mb-1 first:mt-0">
135|                        {children}
136|                    </h1>
137|                ),
138|                h2: ({ children }) => (
139|                    <h2 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0">
140|                        {children}
141|                    </h2>
142|                ),
143|                h3: ({ children }) => (
144|                    <h3 className="text-xs font-semibold text-gray-900 mt-2 mb-0.5 first:mt-0">
145|                        {children}
146|                    </h3>
147|                ),
148|                p: ({ children }) => (
149|                    <p className="mb-2 last:mb-0">{children}</p>
150|                ),
151|                ul: ({ children }) => (
152|                    <ul className="list-disc pl-4 mb-2 space-y-0.5">
153|                        {children}
154|                    </ul>
155|                ),
156|                ol: ({ children }) => (
157|                    <ol className="list-decimal pl-4 mb-2 space-y-0.5">
158|                        {children}
159|                    </ol>
160|                ),
161|                li: ({ children }) => <li>{children}</li>,
162|                strong: ({ children }) => (
163|                    <strong className="font-semibold text-gray-800">
164|                        {children}
165|                    </strong>
166|                ),
167|                em: ({ children }) => <em className="italic">{children}</em>,
168|            }}
169|        >
170|            {content}
171|        </ReactMarkdown>
172|    );
173|}
174|
175|// ---------------------------------------------------------------------------
176|// Right panel for assistant workflows (select screen)
177|// ---------------------------------------------------------------------------
178|function AssistantPanel({ workflow }: { workflow: Workflow }) {
179|    return (
180|        <div className="flex-1 border-l border-t border-gray-200 flex flex-col overflow-hidden px-3 pb-3">
181|            <div className="py-3 shrink-0">
182|                <p className="text-xs font-medium text-gray-700">
183|                    Workflow Prompt
184|                </p>
185|            </div>
186|            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm border border-gray-200 rounded-md text-gray-600 leading-relaxed font-serif bg-gray-50">
187|                <MarkdownBody
188|                    content={workflow.prompt_md ?? "_No prompt defined._"}
189|                />
190|            </div>
191|        </div>
192|    );
193|}
194|
195|// ---------------------------------------------------------------------------
196|// Right panel for tabular workflows — accordion column list (select screen)
197|// ---------------------------------------------------------------------------
198|function TabularPanel({ workflow }: { workflow: Workflow }) {
199|    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
200|    const columns = (workflow.columns_config ?? []).sort(
201|        (a, b) => a.index - b.index,
202|    );
203|
204|    return (
205|        <div className="flex-1 border-l border-t border-gray-200 flex flex-col overflow-hidden px-3 pb-3">
206|            <div className="py-3 shrink-0">
207|                <p className="text-xs font-medium text-gray-700">Columns</p>
208|            </div>
209|            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-md bg-gray-50">
210|                {columns.length === 0 ? (
211|                    <p className="px-4 py-6 text-xs text-center text-gray-400">
212|                        No columns defined
213|                    </p>
214|                ) : (
215|                    columns.map((col) => {
216|                        const isExpanded = expandedIndex === col.index;
217|                        const FormatIcon = formatIcon(col.format ?? "text");
218|                        return (
219|                            <div
220|                                key={col.index}
221|                                className="border-b border-gray-200"
222|                            >
223|                                <button
224|                                    type="button"
225|                                    onClick={() =>
226|                                        setExpandedIndex(
227|                                            isExpanded ? null : col.index,
228|                                        )
229|                                    }
230|                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left hover:bg-white transition-colors"
231|                                >
232|                                    <FormatIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
233|                                    <span className="flex-1 truncate text-gray-800">
234|                                        {col.name}
235|                                    </span>
236|                                    <span className="shrink-0 text-gray-400">
237|                                        {formatLabel(col.format ?? "text")}
238|                                    </span>
239|                                    <ChevronDown
240|                                        className={`h-3 w-3 shrink-0 text-gray-300 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
241|                                    />
242|                                </button>
243|                                {isExpanded && (
244|                                    <div className="px-4 py-3 bg-white border-t border-gray-200 text-sm text-gray-600 leading-relaxed font-serif space-y-3">
245|                                        {col.tags && col.tags.length > 0 && (
246|                                            <div>
247|                                                <p className="text-xs font-medium text-gray-400 mb-1.5 font-sans">
248|                                                    Tags
249|                                                </p>
250|                                                <div className="flex flex-wrap gap-1.5">
251|                                                    {col.tags.map((tag) => (
252|                                                        <span
253|                                                            key={tag}
254|                                                            className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 font-sans"
255|                                                        >
256|                                                            {tag}
257|                                                        </span>
258|                                                    ))}
259|                                                </div>
260|                                            </div>
261|                                        )}
262|                                        <div>
263|                                            <p className="text-xs font-medium text-gray-400 mb-1 font-sans">
264|                                                Prompt
265|                                            </p>
266|                                            <MarkdownBody
267|                                                content={
268|                                                    col.prompt ||
269|                                                    "_No prompt defined._"
270|                                                }
271|                                            />
272|                                        </div>
273|                                    </div>
274|                                )}
275|                            </div>
276|                        );
277|                    })
278|                )}
279|            </div>
280|        </div>
281|    );
282|}
283|
284|// ---------------------------------------------------------------------------
285|// DisplayWorkflowModal
286|// ---------------------------------------------------------------------------
287|export function DisplayWorkflowModal({ workflows, workflow, onClose }: Props) {
288|    const [screen, setScreen] = useState<"select" | "configure">("select");
289|    const [selected, setSelected] = useState<Workflow | null>(workflow);
290|    const [listSearch, setListSearch] = useState("");
291|    const selectedRowRef = useRef<HTMLButtonElement>(null);
292|
293|    // Configure screen state
294|    const [inProject, setInProject] = useState(false);
295|    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
296|        null,
297|    );
298|    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
299|        new Set(),
300|    );
301|    const [docSearch, setDocSearch] = useState("");
302|    const [assistantPrompt, setAssistantPrompt] = useState("");
303|    const [saving, setSaving] = useState(false);
304|
305|    const router = useRouter();
306|    const { saveChat, setNewChatMessages } = useChatHistoryContext();
307|    const {
308|        loading: dirLoading,
309|        projects,
310|        standaloneDocuments,
311|    } = useDirectoryData(screen === "configure");
312|
313|    useEffect(() => {
314|        if (workflow) {
315|            setSelected(workflow);
316|            setScreen("select");
317|            setListSearch("");
318|        } else {
319|            setSelected(null);
320|        }
321|    }, [workflow?.id]);
322|
323|    useEffect(() => {
324|        if (selected && selectedRowRef.current) {
325|            selectedRowRef.current.scrollIntoView({ block: "nearest" });
326|        }
327|    }, [selected?.id]);
328|
329|    // Reset configure state on back
330|    useEffect(() => {
331|        if (screen === "select") {
332|            setInProject(false);
333|            setSelectedProjectId(null);
334|            setSelectedDocIds(new Set());
335|            setDocSearch("");
336|            setAssistantPrompt("");
337|        }
338|    }, [screen]);
339|
340|    function handleClose() {
341|        setSelected(null);
342|        setScreen("select");
343|        onClose();
344|    }
345|
346|    if (!workflow) return null;
347|    const wf = selected ?? workflow;
348|
349|    // ---------------------------------------------------------------------------
350|    // Handlers
351|    // ---------------------------------------------------------------------------
352|    async function handleStartChat() {
353|        setSaving(true);
354|        try {
355|            const projectId = inProject ? selectedProjectId! : undefined;
356|            const chatId = await saveChat(projectId);
357|            if (!chatId) return;
358|            const allDocs: Document[] = [
359|                ...standaloneDocuments,
360|                ...projects.flatMap((p) => p.documents || []),
361|            ];
362|            const files = allDocs
363|                .filter((d) => selectedDocIds.has(d.id))
364|                .map((d) => ({
365|                    filename: d.filename,
366|                    document_id: d.id,
367|                }));
368|            const content = assistantPrompt.trim()
369|                ? `implement workflow\n\n${assistantPrompt.trim()}`
370|                : "implement workflow";
371|            setNewChatMessages([
372|                {
373|                    role: "user",
374|                    content,
375|                    files: files.length > 0 ? files : undefined,
376|                },
377|            ]);
378|            handleClose();
379|            router.push(
380|                projectId
381|                    ? `/projects/${projectId}/assistant/chat/${chatId}`
382|                    : `/assistant/chat/${chatId}`,
383|            );
384|        } finally {
385|            setSaving(false);
386|        }
387|    }
388|
389|    async function handleCreateReview() {
390|        const allDocs: Document[] = [
391|            ...standaloneDocuments,
392|            ...projects.flatMap((p) => p.documents || []),
393|        ];
394|        const docIds = allDocs
395|            .filter((d) => selectedDocIds.has(d.id))
396|            .map((d) => d.id);
397|        const projectId = inProject ? selectedProjectId! : undefined;
398|
399|        setSaving(true);
400|        try {
401|            const review = await createTabularReview({
402|                title: wf.title,
403|                document_ids: docIds,
404|                columns_config: wf.columns_config || [],
405|                workflow_id: wf.is_system ? undefined : wf.id,
406|                project_id: projectId,
407|            });
408|            handleClose();
409|            router.push(
410|                projectId
411|                    ? `/projects/${projectId}/tabular-reviews/${review.id}`
412|                    : `/tabular-reviews/${review.id}`,
413|            );
414|        } finally {
415|            setSaving(false);
416|        }
417|    }
418|
419|    // ---------------------------------------------------------------------------
420|    // Tabular doc browser helpers
421|    // ---------------------------------------------------------------------------
422|    const q = docSearch.toLowerCase().trim();
423|    const selectedProject = projects.find((p) => p.id === selectedProjectId);
424|    const projectDocs = selectedProject?.documents ?? [];
425|
426|    const filteredProjectDocs = q
427|        ? projectDocs.filter((d) =>
428|              d.filename.toLowerCase().includes(q),
429|          )
430|        : projectDocs;
431|
432|    const filteredStandalone = q
433|        ? standaloneDocuments.filter((d) =>
434|              d.filename.toLowerCase().includes(q),
435|          )
436|        : standaloneDocuments;
437|
438|    const filteredAllProjects = projects
439|        .map((p) => ({
440|            ...p,
441|            documents: (p.documents || []).filter(
442|                (d) =>
443|                    !q || d.filename.toLowerCase().includes(q),
444|            ),
445|        }))
446|        .filter(
447|            (p) =>
448|                !q ||
449|                p.name.toLowerCase().includes(q) ||
450|                p.documents.length > 0,
451|        );
452|
453|    // ---------------------------------------------------------------------------
454|    // Render
455|    // ---------------------------------------------------------------------------
456|    return createPortal(
457|        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/20 backdrop-blur-xs">
458|            <div
459|                className={`w-full rounded-2xl bg-white shadow-2xl flex flex-col h-[600px] transition-all duration-200 ${screen === "select" ? "max-w-4xl" : "max-w-2xl"}`}
460|            >
461|                {/* Header */}
462|                <div className="flex items-center justify-between px-5 py-4 shrink-0">
463|                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
464|                        {screen === "select" ? (
465|                            <>
466|                                <span>Workflows</span>
467|                                <span>›</span>
468|                                <span>Select workflow</span>
469|                            </>
470|                        ) : (
471|                            <>
472|                                <button
473|                                    onClick={() => setScreen("select")}
474|                                    className="hover:text-gray-700 transition-colors"
475|                                >
476|                                    Workflows
477|                                </button>
478|                                <span>›</span>
479|                                <span className="truncate max-w-[160px]">
480|                                    {wf.title}
481|                                </span>
482|                                <span>›</span>
483|                                <span>
484|                                    {wf.type === "assistant"
485|                                        ? "New Chat"
486|                                        : "New Review"}
487|                                </span>
488|                            </>
489|                        )}
490|                    </div>
491|                    <button
492|                        onClick={onClose}
493|                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
494|                    >
495|                        <X className="h-4 w-4" />
496|                    </button>
497|                </div>
498|
499|                {/* ── SELECT SCREEN ── */}
500|                {screen === "select" && (
501|