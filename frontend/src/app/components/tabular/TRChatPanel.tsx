1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import ReactMarkdown from "react-markdown";
5|import remarkGfm from "remark-gfm";
6|import {
7|    Clock,
8|    MessageSquarePlus,
9|    Search,
10|    Square,
11|    ArrowRight,
12|    ChevronDown,
13|    ChevronLeft,
14|    Trash2,
15|} from "lucide-react";
16|import { MisuIcon } from "@/components/chat/misu-icon";
17|import {
18|    streamTabularChat,
19|    getTabularChats,
20|    getTabularChatMessages,
21|    deleteTabularChat,
22|    mapTRMessages,
23|    type TRChat,
24|    type TRCitationAnnotation,
25|} from "@/app/lib/mikeApi";
26|import type { AssistantEvent, ColumnConfig, Document } from "../shared/types";
27|import { ModelToggle } from "../assistant/ModelToggle";
28|import { ApiKeyMissingModal } from "../shared/ApiKeyMissingModal";
29|import { PreResponseWrapper } from "../shared/PreResponseWrapper";
30|import { useUserProfile } from "@/contexts/UserProfileContext";
31|import {
32|    getModelProvider,
33|    isModelAvailable,
34|    type ModelProvider,
35|} from "@/app/lib/modelAvailability";
36|import type { ApiKeyState } from "@/app/lib/mikeApi";
37|import { cn } from "@/lib/utils";
38|
39|// ---------------------------------------------------------------------------
40|// Types
41|// ---------------------------------------------------------------------------
42|
43|interface TRMessage {
44|    role: "user" | "assistant";
45|    content: string;
46|    events?: AssistantEvent[];
47|    annotations?: TRCitationAnnotation[];
48|    isStreaming?: boolean;
49|}
50|
51|function parseCourtlistenerEventCases(value: unknown) {
52|    if (!Array.isArray(value)) return undefined;
53|    return value
54|        .map((item) => {
55|            if (!item || typeof item !== "object" || Array.isArray(item)) {
56|                return null;
57|            }
58|            const row = item as Record<string, unknown>;
59|            return {
60|                cluster_id:
61|                    typeof row.cluster_id === "number" ? row.cluster_id : 0,
62|                case_name:
63|                    typeof row.case_name === "string" ? row.case_name : null,
64|                citation:
65|                    typeof row.citation === "string" ? row.citation : null,
66|                dateFiled:
67|                    typeof row.dateFiled === "string" ? row.dateFiled : null,
68|                url: typeof row.url === "string" ? row.url : null,
69|            };
70|        })
71|        .filter(
72|            (item): item is NonNullable<typeof item> =>
73|                !!item && item.cluster_id > 0,
74|        );
75|}
76|
77|function parseCourtlistenerCaseSearches(value: unknown) {
78|    if (!Array.isArray(value)) return undefined;
79|    return value
80|        .map((item) => {
81|            if (!item || typeof item !== "object" || Array.isArray(item)) {
82|                return null;
83|            }
84|            const row = item as Record<string, unknown>;
85|            return {
86|                cluster_id:
87|                    typeof row.cluster_id === "number" ? row.cluster_id : null,
88|                query: typeof row.query === "string" ? row.query : "",
89|                total_matches:
90|                    typeof row.total_matches === "number"
91|                        ? row.total_matches
92|                        : 0,
93|                case_name:
94|                    typeof row.case_name === "string" ? row.case_name : null,
95|                citation:
96|                    typeof row.citation === "string" ? row.citation : null,
97|                error: typeof row.error === "string" ? row.error : undefined,
98|            };
99|        })
100|        .filter((item): item is NonNullable<typeof item> => !!item);
101|}
102|
103|interface Props {
104|    reviewId: string;
105|    reviewTitle?: string | null;
106|    projectName?: string | null;
107|    columns: ColumnConfig[];
108|    documents: Document[];
109|    onCitationClick: (colIdx: number, rowIdx: number) => void;
110|    onClose: () => void;
111|    initialChatId?: string | null;
112|    onChatIdChange?: (chatId: string | null) => void;
113|}
114|
115|// ---------------------------------------------------------------------------
116|// Reasoning block
117|// ---------------------------------------------------------------------------
118|
119|const THINKING_PHRASES = [
120|    "Thinking...",
121|    "Pondering...",
122|    "Analyzing...",
123|    "Reasoning...",
124|];
125|const REASONING_COLLAPSED_MAX_LINES = 6;
126|const REASONING_COLLAPSED_MAX_HEIGHT_REM = 9;
127|
128|function ReasoningBlock({
129|    text,
130|    isStreaming,
131|}: {
132|    text: string;
133|    isStreaming: boolean;
134|}) {
135|    const [isOpen, setIsOpen] = useState(false);
136|    const [userToggled, setUserToggled] = useState(false);
137|    const [isOverflowing, setIsOverflowing] = useState(false);
138|    const [hasMeasured, setHasMeasured] = useState(false);
139|    const [phraseIdx, setPhraseIdx] = useState(0);
140|    const contentRef = useRef<HTMLDivElement | null>(null);
141|
142|    useEffect(() => {
143|        if (!isStreaming) return;
144|        const interval = setInterval(
145|            () => setPhraseIdx((i) => (i + 1) % THINKING_PHRASES.length),
146|            2000,
147|        );
148|        return () => clearInterval(interval);
149|    }, [isStreaming]);
150|
151|    useEffect(() => {
152|        const el = contentRef.current;
153|        if (!el) return;
154|        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
155|        const maxHeight = lineHeight * REASONING_COLLAPSED_MAX_LINES;
156|        const nextOverflowing = el.scrollHeight > maxHeight + 2;
157|        setIsOverflowing(nextOverflowing);
158|        setHasMeasured(true);
159|        if (nextOverflowing && !userToggled) setIsOpen(false);
160|    }, [text, userToggled]);
161|
162|    const showContent = isOpen || isStreaming || isOverflowing || !hasMeasured;
163|    const isCollapsed = isOverflowing && !isOpen;
164|
165|    return (
166|        <div className="ml-1">
167|            <button
168|                onClick={() => {
169|                    if (isStreaming) return;
170|                    setUserToggled(true);
171|                    setIsOpen((v) => !v);
172|                }}
173|                className="flex items-center text-sm text-gray-400 hover:text-gray-500 transition-colors"
174|            >
175|                {isStreaming ? (
176|                    <div className="w-1.5 h-1.5 rounded-full border border-gray-400 border-t-transparent animate-spin shrink-0" />
177|                ) : (
178|                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
179|                )}
180|                <span className="font-medium ml-2">
181|                    {isStreaming
182|                        ? THINKING_PHRASES[phraseIdx]
183|                        : "Thought process"}
184|                </span>
185|                {!isStreaming && (
186|                    <ChevronDown
187|                        size={10}
188|                        className={`ml-1.5 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
189|                    />
190|                )}
191|            </button>
192|            {showContent && (
193|                <div className="mt-1.5 ml-[14px]">
194|                    <div
195|                        className={`relative ${isCollapsed ? "overflow-hidden" : ""}`}
196|                        style={
197|                            isCollapsed
198|                                ? {
199|                                      maxHeight: `${REASONING_COLLAPSED_MAX_HEIGHT_REM}rem`,
200|                                  }
201|                                : undefined
202|                        }
203|                    >
204|                        <div
205|                            ref={contentRef}
206|                            className="text-sm text-gray-400 prose prose-sm max-w-none [&>*]:text-gray-400 [&>*]:text-sm"
207|                        >
208|                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
209|                                {text}
210|                            </ReactMarkdown>
211|                        </div>
212|                        {isCollapsed && (
213|                            <>
214|                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-white/0 to-white" />
215|                                <button
216|                                    type="button"
217|                                    onClick={() => {
218|                                        setUserToggled(true);
219|                                        setIsOpen(true);
220|                                    }}
221|                                    className="absolute left-1/2 bottom-2 z-10 -translate-x-1/2 text-gray-400 transition-colors hover:text-gray-600"
222|                                    aria-label="Expand thought process"
223|                                >
224|                                    <ChevronDown className="h-3.5 w-3.5" />
225|                                </button>
226|                            </>
227|                        )}
228|                    </div>
229|                    {isOverflowing && isOpen && (
230|                        <button
231|                            type="button"
232|                            onClick={() => {
233|                                setUserToggled(true);
234|                                setIsOpen(false);
235|                            }}
236|                            className="mx-auto mt-2 flex text-gray-400 transition-colors hover:text-gray-600"
237|                            aria-label="Minimise thought process"
238|                        >
239|                            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
240|                        </button>
241|                    )}
242|                </div>
243|            )}
244|        </div>
245|    );
246|}
247|
248|// ---------------------------------------------------------------------------
249|// DocRead block
250|// ---------------------------------------------------------------------------
251|
252|function DocReadBlock({
253|    label,
254|    isStreaming,
255|}: {
256|    label: string;
257|    isStreaming?: boolean;
258|}) {
259|    return (
260|        <div className="flex items-center text-sm text-gray-400 ml-1">
261|            {isStreaming ? (
262|                <div className="w-1.5 h-1.5 rounded-full border border-gray-400 border-t-transparent animate-spin shrink-0" />
263|            ) : (
264|                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
265|            )}
266|            <span className="font-medium ml-2">
267|                {isStreaming ? "Reading" : "Read"}
268|            </span>
269|            <span className="ml-1 text-gray-500">{label}</span>
270|        </div>
271|    );
272|}
273|
274|// ---------------------------------------------------------------------------
275|// Citation preprocessing (matches AssistantMessage.tsx pattern)
276|// ---------------------------------------------------------------------------
277|
278|function preprocessTRCitations(
279|    text: string,
280|    annotations: TRCitationAnnotation[],
281|    citationsList: TRCitationAnnotation[],
282|): string {
283|    return text.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (full, refsStr) => {
284|        const refs = (refsStr as string)
285|            .split(",")
286|            .map((s: string) => parseInt(s.trim(), 10));
287|        const tokens = refs.flatMap((ref: number) => {
288|            const ann = annotations.find((a) => a.ref === ref);
289|            if (!ann) return [];
290|            const idx = citationsList.length;
291|            citationsList.push(ann);
292|            return [`\`§${idx}§\`\u200B`];
293|        });
294|        return tokens.length > 0 ? tokens.join("") : full;
295|    });
296|}
297|
298|// ---------------------------------------------------------------------------
299|// ResponseStatus
300|// ---------------------------------------------------------------------------
301|
302|function TRResponseStatus({ isActive }: { isActive: boolean }) {
303|    const [showDone, setShowDone] = useState(false);
304|    const [doneVisible, setDoneVisible] = useState(false);
305|    const wasActiveRef = useRef(false);
306|
307|    useEffect(() => {
308|        if (wasActiveRef.current && !isActive) {
309|            setShowDone(true);
310|            setDoneVisible(true);
311|            const t = setTimeout(() => setDoneVisible(false), 1500);
312|            wasActiveRef.current = isActive;
313|            return () => clearTimeout(t);
314|        }
315|        if (!wasActiveRef.current && isActive) {
316|            setShowDone(false);
317|            setDoneVisible(false);
318|        }
319|        wasActiveRef.current = isActive;
320|    }, [isActive]);
321|
322|    return (
323|        <div className="w-full h-9 flex items-center mb-2">
324|            <MisuIcon
325|                spin={isActive}
326|                done={showDone && doneVisible}
327|                // mike removed {!(showDone && doneVisible)}
328|                size={22}
329|            />
330|        </div>
331|    );
332|}
333|
334|// ---------------------------------------------------------------------------
335|// TRAssistantMessage
336|// ---------------------------------------------------------------------------
337|
338|type TREventGroup =
339|    | { kind: "pre"; events: AssistantEvent[]; indices: number[] }
340|    | {
341|          kind: "content";
342|          event: Extract<AssistantEvent, { type: "content" }>;
343|          index: number;
344|      };
345|
346|function TRAssistantMessage({
347|    msg,
348|    onCitationClick,
349|}: {
350|    msg: TRMessage;
351|    onCitationClick: (colIdx: number, rowIdx: number) => void;
352|}) {
353|    const annotations = msg.annotations ?? [];
354|    const citationsList: TRCitationAnnotation[] = [];
355|
356|    // Pre-process all content events
357|    const processedTexts: string[] = (msg.events ?? []).map((e) =>
358|        e.type === "content"
359|            ? preprocessTRCitations(e.text, annotations, citationsList)
360|            : "",
361|    );
362|
363|    const events = msg.events ?? [];
364|
365|    // Group consecutive non-content events together so they share a single
366|    // PreResponseWrapper. Content events render between wrappers.
367|    const groups: TREventGroup[] = [];
368|    {
369|        let current: Extract<TREventGroup, { kind: "pre" }> | null = null;
370|        events.forEach((e, i) => {
371|            if (e.type === "content") {
372|                if (current) {
373|                    groups.push(current);
374|                    current = null;
375|                }
376|                groups.push({ kind: "content", event: e, index: i });
377|            } else {
378|                if (!current)
379|                    current = { kind: "pre", events: [], indices: [] };
380|                current.events.push(e);
381|                current.indices.push(i);
382|            }
383|        });
384|        if (current) groups.push(current);
385|    }
386|
387|    const hasContentAfter = (groupIdx: number): boolean => {
388|        for (let i = groupIdx + 1; i < groups.length; i++) {
389|            const g = groups[i];
390|            if (g.kind === "content") return true;
391|        }
392|        return false;
393|    };
394|
395|    const renderPreEvent = (event: AssistantEvent, key: number) => {
396|        if (event.type === "reasoning") {
397|            return (
398|                <ReasoningBlock
399|                    key={key}
400|                    text={event.text}
401|                    isStreaming={!!event.isStreaming && !!msg.isStreaming}
402|                />
403|            );
404|        }
405|        if (event.type === "doc_read") {
406|            return (
407|                <DocReadBlock
408|                    key={key}
409|                    label={event.filename}
410|                    isStreaming={event.isStreaming}
411|                />
412|            );
413|        }
414|        if (event.type === "thinking") {
415|            return (
416|                <div
417|                    key={key}
418|                    className="flex items-center text-sm text-gray-400 ml-1"
419|                >
420|                    <div className="w-1.5 h-1.5 rounded-full border border-gray-400 border-t-transparent animate-spin shrink-0" />
421|                    <span className="ml-2">Thinking...</span>
422|                </div>
423|            );
424|        }
425|        return null;
426|    };
427|
428|    const renderContent = (text: string, key: number) => (
429|        <div
430|            key={key}
431|            className="prose prose-sm max-w-none text-sm leading-relaxed"
432|        >
433|            <ReactMarkdown
434|                remarkPlugins={[remarkGfm]}
435|                components={{
436|                    p: ({ node, ...props }) => (
437|                        <p className="mb-2 leading-6" {...props} />
438|                    ),
439|                    ul: ({ node, ...props }) => (
440|                        <ul
441|                            className="list-disc list-outside mb-2 pl-4"
442|                            {...props}
443|                        />
444|                    ),
445|                    ol: ({ node, ...props }) => (
446|                        <ol
447|                            className="list-decimal list-outside mb-2 pl-4"
448|                            {...props}
449|                        />
450|                    ),
451|                    li: ({ node, ...props }) => (
452|                        <li className="mb-0.5 leading-6" {...props} />
453|                    ),
454|                    strong: ({ node, ...props }) => (
455|                        <strong className="font-semibold" {...props} />
456|                    ),
457|                    code: ({ children }) => {
458|                        const codeText = String(children);
459|                        const citMatch = codeText.match(/^§(\d+)§$/);
460|                        if (citMatch) {
461|                            const idx = parseInt(citMatch[1]);
462|                            const cit = citationsList[idx];
463|                            if (cit) {
464|                                return (
465|                                    <button
466|                                        onClick={() =>
467|                                            onCitationClick(
468|                                                cit.col_index,
469|                                                cit.row_index,
470|                                            )
471|                                        }
472|                                        title={`${cit.col_name} · ${cit.doc_name.replace(/\.[^.]+$/, "")}`}
473|                                        className="mx-0.5 inline-flex items-center justify-center rounded-full w-4 h-4 text-[10px] font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors align-super font-serif"
474|                                    >
475|                                        {idx + 1}
476|                                    </button>
477|                                );
478|                            }
479|                        }
480|                        return (
481|                            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">
482|                                {children}
483|                            </code>
484|                        );
485|                    },
486|                }}
487|            >
488|                {text}
489|            </ReactMarkdown>
490|        </div>
491|    );
492|
493|    return (
494|        <div className="text-gray-900 font-serif">
495|            <TRResponseStatus isActive={!!msg.isStreaming} />
496|            {groups.length > 0 && (
497|                <div className="flex flex-col gap-2.5">
498|                    {groups.map((g, gIdx) => {
499|                        if (g.kind === "content") {
500|                            return renderContent(
501|