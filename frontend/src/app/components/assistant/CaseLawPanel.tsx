1|1|"use client";
2|2|
3|3|import {
4|4|    useCallback,
5|5|    useEffect,
6|6|    useMemo,
7|7|    useRef,
8|8|    useState,
9|9|    type RefObject,
10|10|} from "react";
11|11|import DOMPurify from "dompurify";
12|12|import {
13|13|    Download,
14|14|    ExternalLink,
15|15|} from "lucide-react";
16|16|import { MisuIcon } from "@/components/chat/misu-icon";
17|17|import type { CaseCitationQuote } from "../shared/types";
18|18|import {
19|19|    clearDocxQuoteHighlights,
20|20|    highlightDocxQuote,
21|21|} from "../shared/highlightDocxQuote";
22|22|import {
23|23|    RelevantQuotes,
24|24|    type RelevantQuoteItem,
25|25|} from "../shared/RelevantQuotes";
26|26|import {
27|27|    getCourtlistenerOpinions,
28|28|    type CaseLawOpinion,
29|29|} from "@/app/lib/misuApi";
30|30|import { cn } from "@/lib/utils";
31|31|
32|32|export type CaseTab = {
33|33|    kind: "case";
34|34|    id: `case:${number}`;
35|35|    chatId: string;
36|36|    clusterId: number;
37|37|    citationRef?: number;
38|38|    caseName: string | null;
39|39|    citation: string | null;
40|40|    url: string | null;
41|41|    dateFiled: string | null;
42|42|    pdfUrl: string | null;
43|43|    quotes?: CaseCitationQuote[];
44|44|    opinions?: CaseLawOpinion[];
45|45|};
46|46|
47|47|const courtlistenerOpinionsCache = new Map<number, CaseLawOpinion[]>();
48|48|const caseOpinionsRequestCache = new Map<
49|49|    string,
50|50|    ReturnType<typeof getCourtlistenerOpinions>
51|51|>();
52|52|
53|53|const CASE_OPINION_SANITIZER_CONFIG = {
54|54|    ALLOWED_TAGS: [
55|55|        "a",
56|56|        "blockquote",
57|57|        "br",
58|58|        "code",
59|59|        "div",
60|60|        "em",
61|61|        "h1",
62|62|        "h2",
63|63|        "h3",
64|64|        "h4",
65|65|        "h5",
66|66|        "h6",
67|67|        "i",
68|68|        "li",
69|69|        "ol",
70|70|        "p",
71|71|        "pre",
72|72|        "small",
73|73|        "span",
74|74|        "strong",
75|75|        "sub",
76|76|        "sup",
77|77|        "table",
78|78|        "tbody",
79|79|        "td",
80|80|        "th",
81|81|        "thead",
82|82|        "tr",
83|83|        "u",
84|84|        "ul",
85|85|    ],
86|86|    ALLOWED_ATTR: [
87|87|        "aria-label",
88|88|        "class",
89|89|        "colspan",
90|90|        "href",
91|91|        "id",
92|92|        "rel",
93|93|        "rowspan",
94|94|        "target",
95|95|        "title",
96|96|    ],
97|97|    ALLOW_DATA_ATTR: false,
98|98|    ALLOW_ARIA_ATTR: true,
99|99|    ALLOWED_URI_REGEXP: /^(?:https:\/\/www\.courtlistener\.com\/|#)/i,
100|100|    FORBID_ATTR: ["style"],
101|101|    FORBID_TAGS: [
102|102|        "embed",
103|103|        "form",
104|104|        "iframe",
105|105|        "math",
106|106|        "object",
107|107|        "script",
108|108|        "style",
109|109|        "svg",
110|110|    ],
111|111|    RETURN_TRUSTED_TYPE: false,
112|112|};
113|113|
114|114|function sanitizeCaseOpinionHtml(value: string): string {
115|115|    const sanitized = DOMPurify.sanitize(
116|116|        value,
117|117|        CASE_OPINION_SANITIZER_CONFIG,
118|118|    );
119|119|    if (typeof document === "undefined") return sanitized;
120|120|
121|121|    const template = document.createElement("template");
122|122|    template.innerHTML = sanitized;
123|123|    template.content.querySelectorAll("a[href]").forEach((anchor) => {
124|124|        const href = anchor.getAttribute("href") ?? "";
125|125|        if (href.startsWith("#")) return;
126|126|        anchor.setAttribute("target", "_blank");
127|127|        anchor.setAttribute("rel", "noopener noreferrer");
128|128|    });
129|129|    return template.innerHTML;
130|130|}
131|131|
132|132|function friendlyCaseError(message: string): string {
133|133|    try {
134|134|        const parsed = JSON.parse(message) as { detail?: unknown };
135|135|        if (typeof parsed.detail === "string") {
136|136|            message = parsed.detail;
137|137|        }
138|138|    } catch {
139|139|        /* keep original message */
140|140|    }
141|141|
142|142|    if (message.includes("429") || /rate limit|throttled/i.test(message)) {
143|143|        const waitMatch = message.match(/available in\s+(\d+)\s+seconds/i);
144|144|        const wait = waitMatch?.[1];
145|145|        return wait
146|146|            ? `CourtListener is rate limiting requests. Please try again in about ${wait} seconds.`
147|147|            : "CourtListener is rate limiting requests. Please try again shortly.";
148|148|    }
149|149|    if (message.includes("401") || /credentials|token|auth/i.test(message)) {
150|150|        return "CourtListener authentication is not configured correctly.";
151|151|    }
152|152|    return "Could not load this case from CourtListener. Please try again shortly.";
153|153|}
154|154|
155|155|function formatCaseDate(value: string | null | undefined): string | null {
156|156|    if (!value) return null;
157|157|    const date = new Date(`${value}T00:00:00`);
158|158|    if (Number.isNaN(date.getTime())) return value;
159|159|    return new Intl.DateTimeFormat("en-US", {
160|160|        month: "long",
161|161|        day: "numeric",
162|162|        year: "numeric",
163|163|        timeZone: "UTC",
164|164|    }).format(date);
165|165|}
166|166|
167|167|function hashString(value: string): string {
168|168|    let hash = 0;
169|169|    for (let i = 0; i < value.length; i += 1) {
170|170|        hash = (hash * 31 + value.charCodeAt(i)) | 0;
171|171|    }
172|172|    return Math.abs(hash).toString(36);
173|173|}
174|174|
175|175|function caseTabQuoteKey(tab: CaseTab): string {
176|176|    const quoteKey =
177|177|        tab.quotes
178|178|            ?.map((quote) => quote.quote)
179|179|            .filter(Boolean)
180|180|            .join("\n---\n") ?? "";
181|181|    return [tab.clusterId, tab.citationRef ?? "source", hashString(quoteKey)].join(":");
182|182|}
183|183|
184|184|function relevantQuoteKey(quote: CaseCitationQuote, index: number): string {
185|185|    return `${quote.opinionId ?? "unknown"}:${index}:${hashString(quote.quote)}`;
186|186|}
187|187|
188|188|function caseCitationRequestKey(tab: CaseTab) {
189|189|    return String(tab.clusterId);
190|190|}
191|191|
192|192|export function CaseLawPanel({
193|193|    tab,
194|194|    compactActions = false,
195|195|}: {
196|196|    tab: CaseTab;
197|197|    compactActions?: boolean;
198|198|}) {
199|199|    const cachedOpinions = courtlistenerOpinionsCache.get(tab.clusterId);
200|200|    const [opinions, setOpinions] = useState<CaseLawOpinion[]>(
201|201|        tab.opinions?.length ? tab.opinions : (cachedOpinions ?? []),
202|202|    );
203|203|    const [error, setError] = useState<string | null>(null);
204|204|    const [loading, setLoading] = useState(false);
205|205|    const [activeOpinionId, setActiveOpinionId] = useState<number | null>(null);
206|206|    const [relevantQuotes, setRelevantQuotes] = useState<CaseCitationQuote[]>(
207|207|        tab.quotes ?? [],
208|208|    );
209|209|    const [activeQuoteKey, setActiveQuoteKey] = useState<string | null>(null);
210|210|    const [quoteIndexState, setQuoteIndexState] = useState({
211|211|        cacheKey: "",
212|212|        index: 0,
213|213|    });
214|214|    const opinionScrollRef = useRef<HTMLDivElement | null>(null);
215|215|    const opinionContentRef = useRef<HTMLElement | null>(null);
216|216|
217|217|    useEffect(() => {
218|218|        if (tab.opinions?.length) {
219|219|            setOpinions(tab.opinions);
220|220|            setLoading(false);
221|221|            setError(null);
222|222|            return;
223|223|        }
224|224|        const cached = courtlistenerOpinionsCache.get(tab.clusterId);
225|225|        if (cached?.length) {
226|226|            setOpinions(cached);
227|227|            setLoading(false);
228|228|            setError(null);
229|229|            return;
230|230|        }
231|231|
232|232|        let cancelled = false;
233|233|        setLoading(true);
234|234|        setError(null);
235|235|        const requestKey = caseCitationRequestKey(tab);
236|236|        let request = caseOpinionsRequestCache.get(requestKey);
237|237|        if (!request) {
238|238|            request = getCourtlistenerOpinions(tab.clusterId).finally(() => {
239|239|                caseOpinionsRequestCache.delete(requestKey);
240|240|            });
241|241|            caseOpinionsRequestCache.set(requestKey, request);
242|242|        }
243|243|        request
244|244|            .then((nextOpinions) => {
245|245|                if (!cancelled) {
246|246|                    setOpinions(nextOpinions);
247|247|                    courtlistenerOpinionsCache.set(tab.clusterId, nextOpinions);
248|248|                }
249|249|            })
250|250|            .catch((err: unknown) => {
251|251|                if (!cancelled) {
252|252|                    setError(
253|253|                        err instanceof Error
254|254|                            ? friendlyCaseError(err.message)
255|255|                            : "Failed to load case",
256|256|                    );
257|257|                }
258|258|            })
259|259|            .finally(() => {
260|260|                if (!cancelled) setLoading(false);
261|261|            });
262|262|        return () => {
263|263|            cancelled = true;
264|264|        };
265|265|    }, [tab]);
266|266|
267|267|    useEffect(() => {
268|268|        const firstOpinionId =
269|269|            orderOpinions(opinions).find(
270|270|                ({ opinion }) => typeof opinion.opinionId === "number",
271|271|            )?.opinion.opinionId ?? null;
272|272|        setActiveOpinionId(firstOpinionId);
273|273|    }, [opinions]);
274|274|
275|275|    useEffect(() => {
276|276|        setRelevantQuotes(tab.quotes ?? []);
277|277|    }, [tab.quotes]);
278|278|
279|279|    const title = tab.caseName;
280|280|    const citation = tab.citation;
281|281|    const courtlistenerUrl = tab.url;
282|282|    const filedDate = formatCaseDate(tab.dateFiled);
283|283|    const orderedOpinions = orderOpinions(opinions);
284|284|    const activeOpinion = opinions.find(
285|285|        (opinion) => opinion.opinionId === activeOpinionId,
286|286|    );
287|287|    const quoteCacheKey = caseTabQuoteKey(tab);
288|288|    const currentQuoteIndex =
289|289|        quoteIndexState.cacheKey === quoteCacheKey
290|290|            ? Math.min(
291|291|                  quoteIndexState.index,
292|292|                  Math.max(relevantQuotes.length - 1, 0),
293|293|              )
294|294|            : 0;
295|295|    const relevantQuoteItems: RelevantQuoteItem[] = relevantQuotes.map(
296|296|        (quote, index) => ({
297|297|            id: relevantQuoteKey(quote, index),
298|298|            quote: quote.quote,
299|299|            eyebrow:
300|300|                quote.author || quote.type
301|301|                    ? opinionTitle({
302|302|                          opinionId: quote.opinionId,
303|303|                          type: quote.type,
304|304|                          author: quote.author,
305|305|                          url: null,
306|306|                      })
307|307|                    : null,
308|308|        }),
309|309|    );
310|310|
311|311|    const selectRelevantQuote = useCallback(
312|312|        (quote: CaseCitationQuote, index: number) => {
313|313|            const key = relevantQuoteKey(quote, index);
314|314|            setQuoteIndexState({ cacheKey: quoteCacheKey, index });
315|315|            setActiveQuoteKey((current) => (current === key ? null : key));
316|316|            if (typeof quote.opinionId === "number") {
317|317|                setActiveOpinionId(quote.opinionId);
318|318|            }
319|319|        },
320|320|        [quoteCacheKey],
321|321|    );
322|322|
323|323|    useEffect(() => {
324|324|        setQuoteIndexState({ cacheKey: quoteCacheKey, index: 0 });
325|325|        const firstQuote = relevantQuotes[0];
326|326|        setActiveQuoteKey(firstQuote ? relevantQuoteKey(firstQuote, 0) : null);
327|327|        if (typeof firstQuote?.opinionId === "number") {
328|328|            setActiveOpinionId(firstQuote.opinionId);
329|329|        }
330|330|    }, [quoteCacheKey, relevantQuotes]);
331|331|
332|332|    useEffect(() => {
333|333|        const root = opinionContentRef.current;
334|334|        if (!root) return;
335|335|        clearDocxQuoteHighlights(root);
336|336|        if (!activeQuoteKey) return;
337|337|
338|338|        const activeEntry = relevantQuotes
339|339|            .map((quote, index) => ({ quote, index }))
340|340|            .find(
341|341|                ({ quote, index }) =>
342|342|                    relevantQuoteKey(quote, index) === activeQuoteKey,
343|343|            );
344|344|        if (!activeEntry) return;
345|345|        if (
346|346|            typeof activeEntry.quote.opinionId === "number" &&
347|347|            activeEntry.quote.opinionId !== activeOpinionId
348|348|        ) {
349|349|            return;
350|350|        }
351|351|
352|352|        const match = highlightDocxQuote(root, activeEntry.quote.quote);
353|353|        if (!match) return;
354|354|        window.setTimeout(() => {
355|355|            match.scrollIntoView({ behavior: "smooth", block: "center" });
356|356|        }, 50);
357|357|    }, [
358|358|        activeOpinionId,
359|359|        activeOpinion?.html,
360|360|        activeOpinion?.opinionId,
361|361|        activeOpinion?.text,
362|362|        activeQuoteKey,
363|363|        relevantQuotes,
364|364|    ]);
365|365|
366|366|    const opinionSurfaceClassName = "bg-white/60 backdrop-blur-xl";
367|367|
368|368|    return (
369|369|        <div className="flex h-full flex-col">
370|370|            <div className="flex items-start gap-3 px-3 pt-4 pb-3">
371|371|                <div className="min-w-0 flex-1">
372|372|                    <h2 className="font-serif text-xl text-gray-900">
373|373|                        {title}
374|374|                        {citation && (
375|375|                            <span className="text-gray-500">, {citation}</span>
376|376|                        )}
377|377|                    </h2>
378|378|                    {filedDate ? (
379|379|                        <p className="mt-1 font-serif text-sm text-gray-600">
380|380|                            Date: {filedDate}
381|381|                        </p>
382|382|                    ) : null}
383|383|                </div>
384|384|                <div className="flex min-w-0 shrink flex-wrap items-center justify-end gap-2">
385|385|                    {tab.pdfUrl && (
386|386|                        <a
387|387|                            href={tab.pdfUrl}
388|388|                            target="_blank"
389|389|                            rel="noopener noreferrer"
390|390|                            download
391|391|                            aria-label="Download PDF"
392|392|                            title="Download PDF"
393|393|                            className={`inline-flex min-w-0 shrink items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 ${
394|394|                                compactActions
395|395|                                    ? "h-8 w-8 p-0"
396|396|                                    : "gap-1.5 px-2.5 py-1.5"
397|397|                            }`}
398|398|                        >
399|399|                            <span
400|400|                                className={
401|401|                                    compactActions ? "sr-only" : "truncate"
402|402|                                }
403|403|                            >
404|404|                                PDF
405|405|                            </span>
406|406|                            <Download className="h-3.5 w-3.5" />
407|407|                        </a>
408|408|                    )}
409|409|                    {courtlistenerUrl && (
410|410|                        <a
411|411|                            href={courtlistenerUrl}
412|412|                            target="_blank"
413|413|                            rel="noopener noreferrer"
414|414|                            aria-label="Open in CourtListener"
415|415|                            title="Open in CourtListener"
416|416|                            className={`inline-flex min-w-0 shrink items-center justify-center rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 ${
417|417|                                compactActions
418|418|                                    ? "h-8 w-8 p-0"
419|419|                                    : "gap-1.5 px-2.5 py-1.5"
420|420|                            }`}
421|421|                        >
422|422|                            <span
423|423|                                className={
424|424|                                    compactActions ? "sr-only" : "truncate"
425|425|                                }
426|426|                            >
427|427|                                CourtListener
428|428|                            </span>
429|429|                            <ExternalLink className="h-3.5 w-3.5" />
430|430|                        </a>
431|431|                    )}
432|432|                </div>
433|433|            </div>
434|434|            {relevantQuoteItems.length > 0 && (
435|435|                <RelevantQuotes
436|436|                    quotes={relevantQuoteItems}
437|437|                    activeQuoteId={activeQuoteKey}
438|438|                    currentIndex={currentQuoteIndex}
439|439|                    citationRef={tab.citationRef}
440|440|                    citationText={[title, citation].filter(Boolean).join(", ")}
441|441|                    onSelect={(_quote, index) => {
442|442|                        const quote = relevantQuotes[index];
443|443|                        if (quote) selectRelevantQuote(quote, index);
444|444|                    }}
445|445|                    onIndexChange={(index) => {
446|446|                        const quote = relevantQuotes[index];
447|447|                        if (quote) selectRelevantQuote(quote, index);
448|448|                    }}
449|449|                />
450|450|            )}
451|451|            {!loading && !error && opinions.length > 1 && (
452|452|                <div className="relative mt-2 px-1 shadow-[inset_0_-1px_0_rgb(229_231_235)]">
453|453|                    <div className="relative z-10 flex items-end gap-1 overflow-hidden px-2 pt-1">
454|454|                        {orderedOpinions.map(({ opinion, index }) => {
455|455|                            const opinionId = opinion.opinionId;
456|456|                            const isActive =
457|457|                                opinionId !== null &&
458|458|                                opinionId === activeOpinionId;
459|459|                            return (
460|460|                                <button
461|461|                                    key={opinionId ?? index}
462|462|                                    type="button"
463|463|                                    disabled={opinionId === null}
464|464|                                    onClick={() => {
465|465|                                        if (opinionId === null) return;
466|466|                                        setActiveOpinionId(opinionId);
467|467|                                        setActiveQuoteKey(null);
468|468|                                    }}
469|469|                                    style={
470|470|                                        isActive
471|471|                                            ? {
472|472|                                                  filter: "drop-shadow(0 -1px 0 #e5e7eb) drop-shadow(-1px 0 0 #e5e7eb) drop-shadow(1px 0 0 #e5e7eb)",
473|473|                                              }
474|474|                                            : undefined
475|475|                                    }
476|476|                                    className={`group relative flex h-8 max-w-[180px] shrink-0 items-center rounded-t-lg px-3 font-serif text-[13px] transition-colors ${
477|477|                                        isActive
478|478|                                            ? "z-20 bg-white text-gray-800 before:content-[''] before:absolute before:bottom-0 before:-left-2 before:z-20 before:h-2 before:w-2 before:rounded-br-lg before:shadow-[4px_4px_0_4px_white] before:transition-shadow after:content-[''] after:absolute after:bottom-0 after:-right-2 after:z-20 after:h-2 after:w-2 after:rounded-bl-lg after:shadow-[-4px_4px_0_4px_white] after:transition-shadow"
479|479|                                            : "z-10 bg-gray-100 text-gray-600 hover:bg-gray-100 before:content-[''] before:absolute before:bottom-0 before:-left-2 before:h-2 before:w-2 before:rounded-br-lg before:shadow-[4px_4px_0_4px_#f3f4f6] before:transition-shadow after:content-[''] after:absolute after:bottom-0 after:-right-2 after:h-2 after:w-2 after:rounded-bl-lg after:shadow-[-4px_4px_0_4px_#f3f4f6] after:transition-shadow"
480|480|                                    } disabled:cursor-not-allowed disabled:opacity-50`}
481|481|                                >
482|482|                                    <span className="truncate">
483|483|                                        {opinionTitle(opinion, index)}
484|484|                                    </span>
485|485|                                </button>
486|486|                            );
487|487|                        })}
488|488|                    </div>
489|489|                </div>
490|490|            )}
491|491|            <div className="flex flex-1 min-h-0 flex-col px-3 py-3">
492|492|                {loading && (
493|493|                    <div className={cn("h-full min-h-0 rounded-lg border border-gray-200", opinionSurfaceClassName)}>
494|494|                        <div className="flex h-full items-center justify-center p-5">
495|495|                            <MisuIcon spin mike size={28} />
496|496|                        </div>
497|497|                    </div>
498|498|                )}
499|499|                {error && (
500|500|                    <p className={cn("rounded-md p-4 font-serif text-sm text-red-600", opinionSurfaceClassName)}>
501|