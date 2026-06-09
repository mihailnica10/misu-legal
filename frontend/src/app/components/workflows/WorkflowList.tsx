1|1|"use client";
2|2|
3|3|import { useEffect, useRef, useState } from "react";
4|4|import { useRouter } from "next/navigation";
5|5|import {
6|6|    Library,
7|7|    Table2,
8|8|    MessageSquare,
9|9|    User,
10|10|    ChevronDown,
11|11|    Check,
12|12|} from "lucide-react";
13|13|import {
14|14|    listWorkflows,
15|15|    deleteWorkflow,
16|16|    listHiddenWorkflows,
17|17|    hideWorkflow,
18|18|    unhideWorkflow,
19|19|} from "@/app/lib/misuApi";
20|20|import type { Workflow } from "../shared/types";
21|21|import { BUILT_IN_WORKFLOWS, BUILT_IN_IDS } from "./builtinWorkflows";
22|22|import { DisplayWorkflowModal } from "./DisplayWorkflowModal";
23|23|import { NewWorkflowModal } from "./NewWorkflowModal";
24|24|import { ToolbarTabs } from "../shared/ToolbarTabs";
25|25|import { RowActions } from "../shared/RowActions";
26|26|import { MisuIcon } from "@/components/chat/misu-icon";
27|27|import { useAuth } from "@/contexts/AuthContext";
28|28|import { PageHeader } from "@/app/components/shared/PageHeader";
29|29|
30|30|type Tab = "all" | "builtin" | "custom" | "hidden";
31|31|
32|32|const NAME_COL_W = "w-[332px] shrink-0";
33|33|
34|34|const TABS: { id: Tab; label: string }[] = [
35|35|    { id: "all", label: "All" },
36|36|    { id: "builtin", label: "Built-in" },
37|37|    { id: "custom", label: "Custom" },
38|38|    { id: "hidden", label: "Hidden" },
39|39|];
40|40|
41|41|export function WorkflowList() {
42|42|    const router = useRouter();
43|43|    const { user } = useAuth();
44|44|    const stickyCellBg = "bg-[#fcfcfd]";
45|45|    const [custom, setCustom] = useState<Workflow[]>([]);
46|46|    const [loading, setLoading] = useState(true);
47|47|    const [selected, setSelected] = useState<Workflow | null>(null);
48|48|    const [activeTab, setActiveTab] = useState<Tab>("all");
49|49|    const [newModalOpen, setNewModalOpen] = useState(false);
50|50|    const [hiddenBuiltinIds, setHiddenBuiltinIds] = useState<string[]>([]);
51|51|    const [selectedIds, setSelectedIds] = useState<string[]>([]);
52|52|    const [actionsOpen, setActionsOpen] = useState(false);
53|53|    const [practiceFilter, setPracticeFilter] = useState<string | null>(null);
54|54|    const [practiceFilterOpen, setPracticeFilterOpen] = useState(false);
55|55|    const [typeFilter, setTypeFilter] = useState<Workflow["type"] | null>(
56|56|        null,
57|57|    );
58|58|    const [typeFilterOpen, setTypeFilterOpen] = useState(false);
59|59|    const [search, setSearch] = useState("");
60|60|    const actionsRef = useRef<HTMLDivElement>(null);
61|61|    const practiceFilterRef = useRef<HTMLDivElement>(null);
62|62|    const typeFilterRef = useRef<HTMLDivElement>(null);
63|63|
64|64|    useEffect(() => {
65|65|        Promise.all([
66|66|            listWorkflows("assistant"),
67|67|            listWorkflows("tabular"),
68|68|            listHiddenWorkflows(),
69|69|        ])
70|70|            .then(([assistant, tabular, hidden]) => {
71|71|                setCustom([...assistant, ...tabular]);
72|72|                setHiddenBuiltinIds(hidden);
73|73|            })
74|74|            .catch(() => setCustom([]))
75|75|            .finally(() => setLoading(false));
76|76|    }, []);
77|77|
78|78|    useEffect(() => {
79|79|        setSelectedIds([]);
80|80|        setActionsOpen(false);
81|81|    }, [activeTab, practiceFilter, typeFilter]);
82|82|
83|83|    useEffect(() => {
84|84|        function handleClick(e: MouseEvent) {
85|85|            if (
86|86|                actionsRef.current &&
87|87|                !actionsRef.current.contains(e.target as Node)
88|88|            ) {
89|89|                setActionsOpen(false);
90|90|            }
91|91|        }
92|92|        if (actionsOpen) document.addEventListener("mousedown", handleClick);
93|93|        return () => document.removeEventListener("mousedown", handleClick);
94|94|    }, [actionsOpen]);
95|95|
96|96|    useEffect(() => {
97|97|        function handleClick(e: MouseEvent) {
98|98|            if (
99|99|                practiceFilterRef.current &&
100|100|                !practiceFilterRef.current.contains(e.target as Node)
101|101|            ) {
102|102|                setPracticeFilterOpen(false);
103|103|            }
104|104|            if (
105|105|                typeFilterRef.current &&
106|106|                !typeFilterRef.current.contains(e.target as Node)
107|107|            ) {
108|108|                setTypeFilterOpen(false);
109|109|            }
110|110|        }
111|111|        document.addEventListener("mousedown", handleClick);
112|112|        return () => document.removeEventListener("mousedown", handleClick);
113|113|    }, []);
114|114|
115|115|    const hiddenBuiltins = BUILT_IN_WORKFLOWS.filter((wf) =>
116|116|        hiddenBuiltinIds.includes(wf.id),
117|117|    );
118|118|    const visibleBuiltins = BUILT_IN_WORKFLOWS.filter(
119|119|        (wf) => !hiddenBuiltinIds.includes(wf.id),
120|120|    );
121|121|    const all = [...visibleBuiltins, ...custom];
122|122|    const byTab =
123|123|        activeTab === "builtin"
124|124|            ? visibleBuiltins
125|125|            : activeTab === "custom"
126|126|              ? custom
127|127|              : activeTab === "hidden"
128|128|                ? hiddenBuiltins
129|129|                : all;
130|130|    const practices = Array.from(
131|131|        new Set(byTab.map((wf) => wf.practice).filter((p): p is string => !!p)),
132|132|    ).sort();
133|133|    const q = search.toLowerCase();
134|134|    const filtered = byTab
135|135|        .filter((wf) => !practiceFilter || wf.practice === practiceFilter)
136|136|        .filter((wf) => !typeFilter || wf.type === typeFilter)
137|137|        .filter((wf) => !q || wf.title.toLowerCase().includes(q));
138|138|
139|139|    const allSelected =
140|140|        filtered.length > 0 &&
141|141|        filtered.every((wf) => selectedIds.includes(wf.id));
142|142|    const someSelected =
143|143|        !allSelected && filtered.some((wf) => selectedIds.includes(wf.id));
144|144|
145|145|    function toggleAll() {
146|146|        if (allSelected) setSelectedIds([]);
147|147|        else setSelectedIds(filtered.map((wf) => wf.id));
148|148|    }
149|149|
150|150|    function toggleOne(id: string) {
151|151|        setSelectedIds((prev) =>
152|152|            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
153|153|        );
154|154|    }
155|155|
156|156|    async function handleHideWorkflow(id: string) {
157|157|        setHiddenBuiltinIds((prev) => [...prev, id]);
158|158|        await hideWorkflow(id).catch(() => {
159|159|            setHiddenBuiltinIds((prev) => prev.filter((x) => x !== id));
160|160|        });
161|161|    }
162|162|
163|163|    async function handleUnhideWorkflow(id: string) {
164|164|        setHiddenBuiltinIds((prev) => prev.filter((x) => x !== id));
165|165|        await unhideWorkflow(id).catch(() => {
166|166|            setHiddenBuiltinIds((prev) => [...prev, id]);
167|167|        });
168|168|    }
169|169|
170|170|    async function handleBulkRemove() {
171|171|        const ids = [...selectedIds];
172|172|        setActionsOpen(false);
173|173|        setSelectedIds([]);
174|174|        const builtinIds = ids.filter((id) => BUILT_IN_IDS.has(id));
175|175|        const customIds = ids.filter((id) => !BUILT_IN_IDS.has(id));
176|176|        if (builtinIds.length > 0) {
177|177|            setHiddenBuiltinIds((prev) => [
178|178|                ...prev,
179|179|                ...builtinIds.filter((id) => !prev.includes(id)),
180|180|            ]);
181|181|            await Promise.all(
182|182|                builtinIds.map((id) => hideWorkflow(id).catch(() => {})),
183|183|            );
184|184|        }
185|185|        if (customIds.length > 0) {
186|186|            await Promise.all(
187|187|                customIds.map((id) => deleteWorkflow(id).catch(() => {})),
188|188|            );
189|189|            setCustom((prev) => prev.filter((w) => !customIds.includes(w.id)));
190|190|        }
191|191|    }
192|192|
193|193|    async function handleBulkUnhide() {
194|194|        const ids = [...selectedIds];
195|195|        setActionsOpen(false);
196|196|        setSelectedIds([]);
197|197|        setHiddenBuiltinIds((prev) => prev.filter((id) => !ids.includes(id)));
198|198|        await Promise.all(ids.map((id) => unhideWorkflow(id).catch(() => {})));
199|199|    }
200|200|
201|201|    const getTypeMeta = (type: Workflow["type"]) =>
202|202|        type === "tabular"
203|203|            ? { label: "Tabular", Icon: Table2, className: "text-violet-700" }
204|204|            : {
205|205|                  label: "Assistant",
206|206|                  Icon: MessageSquare,
207|207|                  className: "text-blue-700",
208|208|              };
209|209|
210|210|    const typeFilterButton = (
211|211|        <div className="relative" ref={typeFilterRef}>
212|212|            <button
213|213|                onClick={() => setTypeFilterOpen((o) => !o)}
214|214|                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
215|215|                    typeFilter
216|216|                        ? "text-gray-700 hover:text-gray-900"
217|217|                        : "text-gray-500 hover:text-gray-700"
218|218|                }`}
219|219|            >
220|220|                {typeFilter
221|221|                    ? typeFilter === "tabular"
222|222|                        ? "Tabular"
223|223|                        : "Assistant"
224|224|                    : "Filter by type"}
225|225|                <ChevronDown className="h-3 w-3" />
226|226|            </button>
227|227|            {typeFilterOpen && (
228|228|                <div className="absolute right-0 top-full mt-1.5 z-20 w-40 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
229|229|                    <button
230|230|                        onClick={() => {
231|231|                            setTypeFilter(null);
232|232|                            setTypeFilterOpen(false);
233|233|                        }}
234|234|                        className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
235|235|                    >
236|236|                        All Types
237|237|                        {!typeFilter && (
238|238|                            <Check className="h-3.5 w-3.5 text-gray-400" />
239|239|                        )}
240|240|                    </button>
241|241|                    <div className="border-t border-gray-100" />
242|242|                    {(["assistant", "tabular"] as const).map((t) => {
243|243|                        const { label, Icon, className } = getTypeMeta(t);
244|244|                        return (
245|245|                            <button
246|246|                                key={t}
247|247|                                onClick={() => {
248|248|                                    setTypeFilter(t);
249|249|                                    setTypeFilterOpen(false);
250|250|                                }}
251|251|                                className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
252|252|                            >
253|253|                                <span
254|254|                                    className={`inline-flex items-center gap-1.5 font-medium ${className}`}
255|255|                                >
256|256|                                    <Icon className="h-3.5 w-3.5" />
257|257|                                    {label}
258|258|                                </span>
259|259|                                {typeFilter === t && (
260|260|                                    <Check className="h-3.5 w-3.5 shrink-0 text-gray-400" />
261|261|                                )}
262|262|                            </button>
263|263|                        );
264|264|                    })}
265|265|                </div>
266|266|            )}
267|267|        </div>
268|268|    );
269|269|
270|270|    const practiceFilterButton = (
271|271|        <div className="relative" ref={practiceFilterRef}>
272|272|            <button
273|273|                onClick={() => setPracticeFilterOpen((o) => !o)}
274|274|                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
275|275|                    practiceFilter
276|276|                        ? "text-gray-700 hover:text-gray-900"
277|277|                        : "text-gray-500 hover:text-gray-700"
278|278|                }`}
279|279|            >
280|280|                {practiceFilter ?? "Filter by practice"}
281|281|                <ChevronDown className="h-3 w-3" />
282|282|            </button>
283|283|            {practiceFilterOpen && (
284|284|                <div className="absolute right-0 top-full mt-1.5 z-20 w-52 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
285|285|                    <button
286|286|                        onClick={() => {
287|287|                            setPracticeFilter(null);
288|288|                            setPracticeFilterOpen(false);
289|289|                        }}
290|290|                        className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
291|291|                    >
292|292|                        All Practices
293|293|                        {!practiceFilter && (
294|294|                            <Check className="h-3.5 w-3.5 text-gray-400" />
295|295|                        )}
296|296|                    </button>
297|297|                    {practices.length > 0 && (
298|298|                        <div className="border-t border-gray-100" />
299|299|                    )}
300|300|                    {practices.map((p) => (
301|301|                        <button
302|302|                            key={p}
303|303|                            onClick={() => {
304|304|                                setPracticeFilter(p);
305|305|                                setPracticeFilterOpen(false);
306|306|                            }}
307|307|                            className="flex items-center justify-between w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
308|308|                        >
309|309|                            <span className="truncate pr-2">{p}</span>
310|310|                            {practiceFilter === p && (
311|311|                                <Check className="h-3.5 w-3.5 shrink-0 text-gray-400" />
312|312|                            )}
313|313|                        </button>
314|314|                    ))}
315|315|                </div>
316|316|            )}
317|317|        </div>
318|318|    );
319|319|
320|320|    const toolbarActions = (
321|321|        <>
322|322|            {selectedIds.length > 0 && (
323|323|                <div ref={actionsRef} className="relative">
324|324|                    <button
325|325|                        onClick={() => setActionsOpen((v) => !v)}
326|326|                        className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
327|327|                    >
328|328|                        Actions
329|329|                        <ChevronDown className="h-3.5 w-3.5" />
330|330|                    </button>
331|331|                    {actionsOpen && (
332|332|                        <div className="absolute top-full right-0 mt-1 w-36 rounded-lg border border-gray-100 bg-white shadow-lg z-50 overflow-hidden">
333|333|                            {activeTab === "hidden" ? (
334|334|                                <button
335|335|                                    onClick={handleBulkUnhide}
336|336|                                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors"
337|337|                                >
338|338|                                    Unhide
339|339|                                </button>
340|340|                            ) : (
341|341|                                <button
342|342|                                    onClick={handleBulkRemove}
343|343|                                    className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 transition-colors"
344|344|                                >
345|345|                                    Delete
346|346|                                </button>
347|347|                            )}
348|348|                        </div>
349|349|                    )}
350|350|                </div>
351|351|            )}
352|352|            <div className="flex items-center gap-5">
353|353|                {typeFilterButton}
354|354|                {practiceFilterButton}
355|355|            </div>
356|356|        </>
357|357|    );
358|358|
359|359|    return (
360|360|        <div className="flex flex-col flex-1 overflow-hidden">
361|361|            {/* Page header */}
362|362|            <PageHeader
363|363|                shrink
364|364|                actions={[
365|365|                    {
366|366|                        type: "search",
367|367|                        value: search,
368|368|                        onChange: setSearch,
369|369|                        placeholder: "Search workflows…",
370|370|                    },
371|371|                    {
372|372|                        type: "new",
373|373|                        onClick: () => setNewModalOpen(true),
374|374|                        title: "New workflow",
375|375|                    },
376|376|                ]}
377|377|            >
378|378|                <h1 className="text-2xl font-medium font-serif text-gray-900">
379|379|                    Workflows
380|380|                </h1>
381|381|            </PageHeader>
382|382|
383|383|            <ToolbarTabs
384|384|                tabs={TABS}
385|385|                active={activeTab}
386|386|                onChange={setActiveTab}
387|387|                actions={toolbarActions}
388|388|            />
389|389|
390|390|            {/* Table */}
391|391|            <div className="flex-1 overflow-auto">
392|392|                <div className="min-w-max">
393|393|                    {/* Column headers */}
394|394|                    <div className="flex items-center h-8 pr-3 md:pr-10 border-b border-gray-200 text-xs text-gray-500 font-medium select-none">
395|395|                        <div className={`sticky left-0 z-[60] ${NAME_COL_W} ${stickyCellBg} flex items-center gap-4 self-stretch pl-4 pr-2 text-left`}>
396|396|                            {loading ? (
397|397|                                <div className="h-2.5 w-2.5 shrink-0 rounded bg-gray-100 animate-pulse" />
398|398|                            ) : (
399|399|                                <input
400|400|                                    type="checkbox"
401|401|                                    checked={allSelected}
402|402|                                    ref={(el) => {
403|403|                                        if (el) el.indeterminate = someSelected;
404|404|                                    }}
405|405|                                    onChange={toggleAll}
406|406|                                    className="h-2.5 w-2.5 rounded border-gray-200 cursor-pointer accent-black"
407|407|                                />
408|408|                            )}
409|409|                            <span>Name</span>
410|410|                        </div>
411|411|                        <div className="ml-auto w-28 shrink-0">Type</div>
412|412|                        <div className="w-40 shrink-0">Practice</div>
413|413|                        <div className="w-28 shrink-0">Source</div>
414|414|                        <div className="w-8 shrink-0" />
415|415|                    </div>
416|416|
417|417|                    {loading && activeTab !== "builtin" ? (
418|418|                        <div>
419|419|                            {[1, 2, 3].map((i) => (
420|420|                                <div
421|421|                                    key={i}
422|422|                                    className="flex items-center h-10 pr-3 md:pr-10 border-b border-gray-50"
423|423|                                >
424|424|                                    <div className={`${NAME_COL_W} flex shrink-0 items-center gap-4 pl-4 pr-2`}>
425|425|                                        <div className="h-2.5 w-2.5 shrink-0 rounded bg-gray-100 animate-pulse" />
426|426|                                        <div className="h-3.5 w-48 rounded bg-gray-100 animate-pulse" />
427|427|                                    </div>
428|428|                                    <div className="w-28 shrink-0">
429|429|                                        <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
430|430|                                    </div>
431|431|                                    <div className="w-40 shrink-0">
432|432|                                        <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
433|433|                                    </div>
434|434|                                    <div className="w-28 shrink-0">
435|435|                                        <div className="h-3 w-14 rounded bg-gray-100 animate-pulse" />
436|436|                                    </div>
437|437|                                    <div className="w-8 shrink-0" />
438|438|                                </div>
439|439|                            ))}
440|440|                        </div>
441|441|                    ) : filtered.length === 0 ? (
442|442|                        <div className="flex flex-col items-start py-24 w-full max-w-xs mx-auto">
443|443|                            {activeTab === "custom" ? (
444|444|                                <>
445|445|                                    <Library className="h-8 w-8 text-gray-300 mb-4" />
446|446|                                    <p className="text-2xl font-medium font-serif text-gray-900">
447|447|                                        Custom Workflows
448|448|                                    </p>
449|449|                                    <p className="mt-1 text-xs text-gray-400 text-left">
450|450|                                        Build reusable prompts and tabular
451|451|                                        review templates tailored to your
452|452|                                        practice.
453|453|                                    </p>
454|454|                                    <button
455|455|                                        onClick={() => setNewModalOpen(true)}
456|456|                                        className="mt-4 inline-flex items-center gap-1 rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 transition-colors shadow-md"
457|457|                                    >
458|458|                                        + Create New
459|459|                                    </button>
460|460|                                </>
461|461|                            ) : activeTab === "hidden" ? (
462|462|                                <>
463|463|                                    <Library className="h-8 w-8 text-gray-300 mb-4" />
464|464|                                    <p className="text-2xl font-medium font-serif text-gray-900">
465|465|                                        Hidden Workflows
466|466|                                    </p>
467|467|                                    <p className="mt-1 text-xs text-gray-400 text-left">
468|468|                                        Built-in workflows you've hidden will
469|469|                                        appear here. You can unhide them at any
470|470|                                        time.
471|471|                                    </p>
472|472|                                </>
473|473|                            ) : (
474|474|                                <>
475|475|                                    <Library className="h-8 w-8 text-gray-300 mb-4" />
476|476|                                    <p className="text-2xl font-medium font-serif text-gray-900">
477|477|                                        Workflows
478|478|                                    </p>
479|479|                                    <p className="mt-1 text-xs text-gray-400 text-left">
480|480|                                        Automate document analysis with reusable
481|481|                                        prompts and tabular review templates.
482|482|                                    </p>
483|483|                                </>
484|484|                            )}
485|485|                        </div>
486|486|                    ) : (
487|487|                        filtered.map((wf) => {
488|488|                            const rowBg = selectedIds.includes(wf.id)
489|489|                                ? "bg-gray-50"
490|490|                                : stickyCellBg;
491|491|                            return (
492|492|                            <div
493|493|                                key={wf.id}
494|494|                                onClick={() => setSelected(wf)}
495|495|                                className="group flex items-center h-10 pr-3 md:pr-10 border-b border-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
496|496|                            >
497|497|                                <div className={`sticky left-0 z-[60] ${NAME_COL_W} py-2 pl-4 pr-2 ${rowBg} transition-colors group-hover:bg-gray-100`}>
498|498|                                    <div className="flex min-w-0 items-center gap-4">
499|499|                                        <input
500|500|                                            type="checkbox"
501|