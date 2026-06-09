1|"use client";
2|
3|import { useId, useRef, useEffect, useState } from "react";
4|import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
5|import remarkMath from "remark-math";
6|import remarkGfm from "remark-gfm";
7|import rehypeKatex from "rehype-katex";
8|import "katex/dist/katex.min.css";
9|import {
10|    Copy,
11|    Check,
12|    ChevronDown,
13|    Download,
14|    File,
15|    FileText,
16|    Loader2,
17|    Scale,
18|} from "lucide-react";
19|import { MisuIcon } from "@/components/chat/misu-icon";
20|import { displayCitationQuote, formatCitationPage } from "../shared/types";
21|import type {
22|    AssistantEvent,
23|    CitationAnnotation,
24|    EditAnnotation,
25|} from "../shared/types";
26|import { EditCard, applyOptimisticResolution } from "./EditCard";
27|import { PreResponseWrapper } from "../shared/PreResponseWrapper";
28|import { supabase } from "@/lib/supabase";
29|
30|const RESPONSE_GLASS_SURFACE =
31|    "rounded-xl border border-white/70 bg-white/55 shadow-[0_3px_9px_rgba(15,23,42,0.03),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-4px_9px_rgba(255,255,255,0.05)] backdrop-blur-2xl";
32|const RESPONSE_GLASS_ANNOTATION =
33|    "inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-200/60 bg-gray-200/80 text-[12px] font-serif font-medium text-gray-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(243,244,246,0.85),inset_0_-2px_4px_rgba(229,231,235,0.65)] backdrop-blur-xl transition-colors hover:bg-gray-200 hover:text-gray-950";
34|
35|function toolCallLabel(name: string): string {
36|    if (name === "generate_docx") return "Creating document...";
37|    if (name === "edit_document") return "Editing document...";
38|    if (name === "read_document") return "Reading document...";
39|    if (name === "fetch_documents") return "Reading documents...";
40|    if (name === "find_in_document") return "Searching document...";
41|    if (name === "replicate_document") return "Copying document...";
42|    if (name === "read_workflow") return "Loading workflow...";
43|    if (name === "list_workflows") return "Loading workflows...";
44|    if (name === "list_documents") return "Loading documents...";
45|    if (name === "courtlistener_search_case_law")
46|        return "Searching case law...";
47|    if (name === "courtlistener_get_cases") return "Fetching cases...";
48|    if (name === "courtlistener_find_in_case") return "Searching case...";
49|    if (name === "courtlistener_read_case") return "Reading case...";
50|    if (name === "courtlistener_verify_citations")
51|        return "Verifying citations...";
52|    return name ? `Running ${name}...` : "Working...";
53|}
54|
55|/**
56| * Card rendered above the per-edit EditCards when a message produced
57| * multiple tracked-change proposals. Lets the user resolve every pending
58| * edit in one click by firing the per-edit accept/reject endpoint for each
59| * pending annotation and forwarding each response to `onResolved` so the
60| * parent can bump the viewer version, persist override URLs, etc.
61| *
62| * This intentionally doesn't apply the optimistic DOM mutation that
63| * EditCard does — bulk operations touch many edits at once and the real
64| * re-render from the latest version will reconcile within a second or so.
65| */
66|function BulkEditActions({
67|    pending,
68|    filenameByDocId,
69|    onViewClick,
70|    onResolveStart,
71|    onResolved,
72|    onError,
73|}: {
74|    pending: {
75|        annotation: EditAnnotation;
76|        filename: string;
77|    }[];
78|    filenameByDocId: Map<string, string>;
79|    onViewClick?: (ann: EditAnnotation, filename: string) => void;
80|    onResolveStart?: (args: {
81|        editId: string;
82|        documentId: string;
83|        verb: "accept" | "reject";
84|    }) => void;
85|    onResolved?: (args: {
86|        editId: string;
87|        documentId: string;
88|        status: "accepted" | "rejected";
89|        versionId: string | null;
90|        downloadUrl: string | null;
91|    }) => void;
92|    onError?: (args: {
93|        editId: string;
94|        documentId: string;
95|        versionId: string | null;
96|        message: string;
97|    }) => void;
98|}) {
99|    const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
100|    const [progress, setProgress] = useState<{
101|        done: number;
102|        total: number;
103|    } | null>(null);
104|
105|    if (pending.length === 0) return null;
106|
107|    const handleAll = async (verb: "accept" | "reject") => {
108|        if (busy) return;
109|        setBusy(verb);
110|        setProgress({ done: 0, total: pending.length });
111|        try {
112|            const {
113|                data: { session },
114|            } = await supabase.auth.getSession();
115|            const token = session?.access_token;
116|            const apiBase =
117|                process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
118|
119|            // Sequential so the per-document version counter advances in a
120|            // predictable order and the viewer doesn't race between bumps.
121|            let done = 0;
122|            for (const { annotation } of pending) {
123|                onResolveStart?.({
124|                    editId: annotation.edit_id,
125|                    documentId: annotation.document_id,
126|                    verb,
127|                });
128|                // Optimistically mutate the DOM so the viewer reflects the
129|                // resolution immediately. Revert if the backend call fails.
130|                let revert: (() => void) | null = null;
131|                try {
132|                    revert = applyOptimisticResolution(annotation, verb);
133|                } catch (e) {
134|                    console.error(
135|                        "[BulkEditActions] optimistic update threw",
136|                        e,
137|                    );
138|                }
139|                try {
140|                    const resp = await fetch(
141|                        `${apiBase}/single-documents/${annotation.document_id}/edits/${annotation.edit_id}/${verb}`,
142|                        {
143|                            method: "POST",
144|                            headers: token
145|                                ? { Authorization: `Bearer ${token}` }
146|                                : undefined,
147|                        },
148|                    );
149|                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
150|                    const data = (await resp.json()) as {
151|                        ok: boolean;
152|                        status?: "accepted" | "rejected";
153|                        version_id: string | null;
154|                        download_url: string | null;
155|                    };
156|                    const nextStatus =
157|                        data.status ??
158|                        (verb === "accept" ? "accepted" : "rejected");
159|                    onResolved?.({
160|                        editId: annotation.edit_id,
161|                        documentId: annotation.document_id,
162|                        status: nextStatus,
163|                        versionId: data.version_id,
164|                        downloadUrl: data.download_url,
165|                    });
166|                } catch (e) {
167|                    console.error("[BulkEditActions] resolve failed", e);
168|                    try {
169|                        revert?.();
170|                    } catch (revertErr) {
171|                        console.error(
172|                            "[BulkEditActions] revert threw",
173|                            revertErr,
174|                        );
175|                    }
176|                    onError?.({
177|                        editId: annotation.edit_id,
178|                        documentId: annotation.document_id,
179|                        versionId: annotation.version_id ?? null,
180|                        message:
181|                            verb === "accept"
182|                                ? "Couldn't save one or more accepts."
183|                                : "Couldn't save one or more rejects.",
184|                    });
185|                }
186|                done++;
187|                setProgress({ done, total: pending.length });
188|            }
189|        } finally {
190|            setBusy(null);
191|            setProgress(null);
192|        }
193|    };
194|
195|    // Optional: show a tiny "View first" action so bulk doesn't lose the
196|    // in-viewer scroll-to behaviour entirely.
197|    const first = pending[0];
198|
199|    return (
200|        <div className="flex items-center gap-2">
201|            <button
202|                onClick={() => handleAll("accept")}
203|                disabled={!!busy}
204|                className="px-2 py-1 text-xs rounded border border-gray-900 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-1"
205|            >
206|                {busy === "accept" && (
207|                    <Loader2 className="h-3 w-3 animate-spin" />
208|                )}
209|                Accept all
210|            </button>
211|            <button
212|                onClick={() => handleAll("reject")}
213|                disabled={!!busy}
214|                className="px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50 inline-flex items-center gap-1"
215|            >
216|                {busy === "reject" && (
217|                    <Loader2 className="h-3 w-3 animate-spin" />
218|                )}
219|                Reject all
220|            </button>
221|            {progress && (
222|                <span className="text-xs font-serif text-gray-500">
223|                    {progress.done}/{progress.total}
224|                </span>
225|            )}
226|            {onViewClick && first && (
227|                <button
228|                    onClick={() =>
229|                        onViewClick(first.annotation, first.filename)
230|                    }
231|                    disabled={!!busy}
232|                    className="ml-auto px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
233|                >
234|                    View
235|                </button>
236|            )}
237|        </div>
238|    );
239|}
240|
241|/**
242| * Wraps the bulk accept/reject card and the per-edit EditCards in a single
243| * minimisable container. The bulk actions and summary stay visible in the
244| * header; the individual cards collapse via the chevron toggle.
245| */
246|function EditCardsSection({
247|    pending,
248|    filenameByDocId,
249|    cards,
250|    resolvedCount,
251|    onViewClick,
252|    onResolveStart,
253|    onResolved,
254|    onError,
255|}: {
256|    pending: {
257|        annotation: EditAnnotation;
258|        filename: string;
259|    }[];
260|    filenameByDocId: Map<string, string>;
261|    cards: React.ReactNode[];
262|    resolvedCount: number;
263|    onViewClick?: (ann: EditAnnotation, filename: string) => void;
264|    onResolveStart?: (args: {
265|        editId: string;
266|        documentId: string;
267|        verb: "accept" | "reject";
268|    }) => void;
269|    onResolved?: (args: {
270|        editId: string;
271|        documentId: string;
272|        status: "accepted" | "rejected";
273|        versionId: string | null;
274|        downloadUrl: string | null;
275|    }) => void;
276|    onError?: (args: {
277|        editId: string;
278|        documentId: string;
279|        versionId: string | null;
280|        message: string;
281|    }) => void;
282|}) {
283|    const [isOpen, setIsOpen] = useState(true);
284|    if (cards.length === 0) return null;
285|
286|    const docCount = filenameByDocId.size;
287|    const summary =
288|        pending.length > 0
289|            ? docCount > 1
290|                ? `${pending.length} tracked changes across ${docCount} documents`
291|                : `${pending.length} tracked ${pending.length === 1 ? "change" : "changes"}`
292|            : docCount > 1
293|              ? `${resolvedCount} resolved tracked changes across ${docCount} documents`
294|              : `${resolvedCount} resolved tracked ${resolvedCount === 1 ? "change" : "changes"}`;
295|
296|    return (
297|        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
298|            {/* Row 1: summary + chevron */}
299|            <div className="flex items-center gap-2 px-3 pt-3">
300|                <p className="flex-1 min-w-0 text-sm font-serif text-gray-700 truncate">
301|                    {summary}
302|                </p>
303|                <button
304|                    onClick={() => setIsOpen((v) => !v)}
305|                    aria-label={isOpen ? "Collapse edits" : "Expand edits"}
306|                    className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
307|                >
308|                    <ChevronDown
309|                        className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
310|                    />
311|                </button>
312|            </div>
313|            {/* Row 2: bulk action buttons */}
314|            {pending.length > 0 && (
315|                <div className="px-3 pt-3">
316|                    <BulkEditActions
317|                        pending={pending}
318|                        filenameByDocId={filenameByDocId}
319|                        onViewClick={onViewClick}
320|                        onResolveStart={onResolveStart}
321|                        onResolved={onResolved}
322|                        onError={onError}
323|                    />
324|                </div>
325|            )}
326|            {/* Row 3: collapsible cards list */}
327|            {isOpen && (
328|                <div className="flex flex-col gap-2 px-3 pb-3 pt-3">
329|                    {cards}
330|                </div>
331|            )}
332|            {!isOpen && <div className="pb-3" />}
333|        </div>
334|    );
335|}
336|
337|// ---------------------------------------------------------------------------
338|// ResponseStatus
339|// ---------------------------------------------------------------------------
340|
341|type StatusState = "active" | "error" | null;
342|
343|function ResponseStatus({ status }: { status: StatusState }) {
344|    const [showDone, setShowDone] = useState(false);
345|    const [doneVisible, setDoneVisible] = useState(false);
346|    const wasActiveRef = useRef(false);
347|
348|    const isActive = status === "active";
349|    const isError = status === "error";
350|
351|    useEffect(() => {
352|        if (wasActiveRef.current && !isActive) {
353|            setShowDone(true);
354|            setDoneVisible(true);
355|            const t = setTimeout(() => setDoneVisible(false), 1500);
356|            return () => clearTimeout(t);
357|        } else if (!wasActiveRef.current && isActive) {
358|            setShowDone(false);
359|            setDoneVisible(false);
360|        }
361|        wasActiveRef.current = isActive;
362|    }, [isActive]);
363|
364|    return (
365|        <div className="w-full h-9 flex items-center mb-2">
366|            <MisuIcon
367|                spin={isActive}
368|                done={showDone && doneVisible}
369|                error={isError}
370|                // mike removed {!isError && !(showDone && doneVisible)}
371|                size={22}
372|            />
373|        </div>
374|    );
375|}
376|
377|function eventErrorMessage(event: AssistantEvent): string | null {
378|    if (event.type === "error") return event.message;
379|    if ("error" in event && typeof event.error === "string" && event.error) {
380|        return event.error;
381|    }
382|    return null;
383|}
384|
385|// ---------------------------------------------------------------------------
386|// Event block components
387|// ---------------------------------------------------------------------------
388|
389|const THINKING_PHRASES = [
390|    "Thinking...",
391|    "Pondering...",
392|    "Analyzing...",
393|    "Reviewing...",
394|    "Reasoning...",
395|];
396|const REASONING_COLLAPSED_MAX_LINES = 6;
397|const REASONING_COLLAPSED_MAX_HEIGHT_REM = 9;
398|
399|function ReasoningBlock({
400|    text,
401|    isStreaming,
402|    showConnector,
403|}: {
404|    text: string;
405|    isStreaming: boolean;
406|    showConnector?: boolean;
407|}) {
408|    const [isContentOpen, setIsContentOpen] = useState(false);
409|    const [isExpanded, setIsExpanded] = useState(false);
410|    const [userToggledContent, setUserToggledContent] = useState(false);
411|    const [isOverflowing, setIsOverflowing] = useState(false);
412|    const [hasMeasured, setHasMeasured] = useState(false);
413|    const [thinkingIndex, setThinkingIndex] = useState(0);
414|    const contentRef = useRef<HTMLDivElement | null>(null);
415|
416|    useEffect(() => {
417|        if (!isStreaming) return;
418|        const interval = setInterval(() => {
419|            setThinkingIndex((i) => (i + 1) % THINKING_PHRASES.length);
420|        }, 2000);
421|        return () => clearInterval(interval);
422|    }, [isStreaming]);
423|
424|    useEffect(() => {
425|        const el = contentRef.current;
426|        if (!el) return;
427|        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
428|        const maxHeight = lineHeight * REASONING_COLLAPSED_MAX_LINES;
429|        const nextOverflowing = el.scrollHeight > maxHeight + 2;
430|        setIsOverflowing(nextOverflowing);
431|        setHasMeasured(true);
432|        if (!userToggledContent) setIsContentOpen(isStreaming);
433|        if (!nextOverflowing) setIsExpanded(false);
434|    }, [isStreaming, text, userToggledContent]);
435|
436|    const showContent = isContentOpen || isStreaming || !hasMeasured;
437|    const isCollapsed = isContentOpen && isOverflowing && !isExpanded;
438|
439|    return (
440|        <div className="relative">
441|            {showConnector && (
442|                <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gray-300 top-[13px] left-[2.5px] h-[calc(100%+11px)]" />
443|            )}
444|            <button
445|                onClick={() => {
446|                    if (isStreaming) return;
447|                    setUserToggledContent(true);
448|                    setIsContentOpen((v) => !v);
449|                }}
450|                className="flex items-center text-sm font-serif text-gray-500 hover:text-gray-600 transition-colors"
451|            >
452|                {isStreaming ? (
453|                    <div className="w-1.5 h-1.5 rounded-full border border-gray-400 border-t-transparent animate-spin shrink-0" />
454|                ) : (
455|                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
456|                )}
457|                <span className="font-medium ml-2">
458|                    {isStreaming
459|                        ? THINKING_PHRASES[thinkingIndex]
460|                        : "Thought process"}
461|                </span>
462|                {!isStreaming && (
463|                    <ChevronDown
464|                        size={10}
465|                        className={`relative top-px ml-1 transition-transform duration-200 ${isContentOpen ? "" : "-rotate-90"}`}
466|                    />
467|                )}
468|            </button>
469|            {showContent && (
470|                <div className="mt-2 ml-[14px]">
471|                    <div
472|                        className={`relative ${isCollapsed ? "overflow-hidden" : ""}`}
473|                        style={
474|                            isCollapsed
475|                                ? {
476|                                      maxHeight: `${REASONING_COLLAPSED_MAX_HEIGHT_REM}rem`,
477|                                  }
478|                                : undefined
479|                        }
480|                    >
481|                        <div
482|                            ref={contentRef}
483|                            className="text-sm font-serif text-gray-400 prose prose-sm max-w-none [&>*]:text-gray-400 [&>*]:text-sm"
484|                        >
485|                            <ReactMarkdown
486|                                remarkPlugins={[remarkGfm]}
487|                                components={{
488|                                    code: ({ node, ...props }) => (
489|                                        <code
490|                                            className="font-serif text-gray-600"
491|                                            {...props}
492|                                        />
493|                                    ),
494|                                }}
495|                            >
496|                                {text}
497|                            </ReactMarkdown>
498|                        </div>
499|                        {isCollapsed && (
500|                            <>
501|