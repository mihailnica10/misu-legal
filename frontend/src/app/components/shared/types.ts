1|// Shared TypeScript types for Mișu AI legal assistant
2|
3|export interface Folder {
4|  id: string;
5|  project_id: string;
6|  user_id: string;
7|  name: string;
8|  parent_folder_id: string | null;
9|  created_at: string;
10|  updated_at: string;
11|}
12|
13|export interface Project {
14|  id: string;
15|  user_id: string;
16|  is_owner?: boolean;
17|  name: string;
18|  cm_number: string | null;
19|  shared_with: string[];
20|  created_at: string;
21|  updated_at: string;
22|  documents?: Document[];
23|  folders?: Folder[];
24|  document_count?: number;
25|  chat_count?: number;
26|  review_count?: number;
27|}
28|
29|export interface Document {
30|  id: string;
31|  user_id?: string;
32|  project_id: string | null;
33|  folder_id?: string | null;
34|  filename: string;
35|  file_type: string | null; // pdf | docx | doc
36|  storage_path: string | null;
37|  pdf_storage_path: string | null;
38|  size_bytes: number | null;
39|  page_count: number | null;
40|  structure_tree: StructureNode[] | null;
41|  status: "pending" | "processing" | "ready" | "error";
42|  created_at: string | null;
43|  updated_at?: string | null;
44|  /** Version number of the document row pointed to by current_version_id. */
45|  active_version_number?: number | null;
46|  /** Legacy: max version_number across assistant_edit rows, null if doc is unedited. */
47|  latest_version_number?: number | null;
48|}
49|
50|export interface StructureNode {
51|  id: string;
52|  title: string;
53|  level: number;
54|  page_number: number | null;
55|  children: StructureNode[];
56|}
57|
58|export interface Chat {
59|  id: string;
60|  project_id: string | null;
61|  user_id: string;
62|  title: string | null;
63|  created_at: string;
64|}
65|
66|export interface EditAnnotation {
67|  type?: "edit_data";
68|  kind?: "edit";
69|  edit_id: string;
70|  document_id: string;
71|  version_id: string;
72|  /** Per-document monotonic Vn for the edit's target version. */
73|  version_number?: number | null;
74|  change_id: string;
75|  del_w_id?: string;
76|  ins_w_id?: string;
77|  deleted_text: string;
78|  inserted_text: string;
79|  context_before?: string;
80|  context_after?: string;
81|  reason?: string;
82|  status: "pending" | "accepted" | "rejected";
83|}
84|
85|export type AssistantEvent =
86|  | { type: "reasoning"; text: string; isStreaming?: boolean }
87|  | { type: "error"; message: string }
88|  | {
89|      type: "tool_call_start";
90|      name: string;
91|      isStreaming?: boolean;
92|    }
93|  | { type: "thinking"; isStreaming?: boolean }
94|  | {
95|      type: "doc_read";
96|      filename: string;
97|      document_id?: string;
98|      isStreaming?: boolean;
99|    }
100|  | {
101|      type: "doc_find";
102|      filename: string;
103|      query: string;
104|      total_matches: number;
105|      isStreaming?: boolean;
106|    }
107|  | {
108|      type: "doc_created";
109|      filename: string;
110|      download_url: string;
111|      /** Set when the generated doc is persisted as a first-class document. */
112|      document_id?: string;
113|      version_id?: string;
114|      version_number?: number | null;
115|      isStreaming?: boolean;
116|    }
117|  | { type: "doc_download"; filename: string; download_url: string }
118|  | {
119|      type: "doc_replicated";
120|      /** Source document filename. */
121|      filename: string;
122|      /** How many copies were produced in this single tool call. */
123|      count: number;
124|      /** One entry per new copy. Empty while streaming. */
125|      copies?: {
126|        new_filename: string;
127|        document_id: string;
128|        version_id: string;
129|      }[];
130|      error?: string;
131|      isStreaming?: boolean;
132|    }
133|  | { type: "workflow_applied"; workflow_id: string; title: string }
134|  | {
135|      type: "doc_edited";
136|      filename: string;
137|      document_id: string;
138|      version_id: string;
139|      /** Per-document monotonic Vn written at emit time. */
140|      version_number?: number | null;
141|      download_url: string;
142|      annotations: EditAnnotation[];
143|      error?: string;
144|      isStreaming?: boolean;
145|    }
146|  | {
147|      type: "courtlistener_search_case_law";
148|      query: string;
149|      result_count?: number;
150|      error?: string;
151|      isStreaming?: boolean;
152|    }
153|  | {
154|      type: "courtlistener_get_cases";
155|      cluster_ids: number[];
156|      case_count?: number;
157|      opinion_count?: number;
158|      cases?: {
159|        cluster_id: number;
160|        case_name: string | null;
161|        citation: string | null;
162|        dateFiled?: string | null;
163|        url?: string | null;
164|      }[];
165|      error?: string;
166|      isStreaming?: boolean;
167|    }
168|  | {
169|      type: "courtlistener_find_in_case";
170|      cluster_id: number | null;
171|      query: string;
172|      total_matches?: number;
173|      case_name?: string | null;
174|      citation?: string | null;
175|      searches?: {
176|        cluster_id: number | null;
177|        query: string;
178|        total_matches?: number;
179|        case_name?: string | null;
180|        citation?: string | null;
181|        error?: string;
182|      }[];
183|      error?: string;
184|      isStreaming?: boolean;
185|    }
186|  | {
187|      type: "courtlistener_read_case";
188|      cluster_id: number | null;
189|      case_name?: string | null;
190|      citation?: string | null;
191|      opinion_count?: number;
192|      error?: string;
193|      isStreaming?: boolean;
194|    }
195|  | {
196|      type: "courtlistener_verify_citations";
197|      citation_count?: number;
198|      match_count?: number;
199|      error?: string;
200|      isStreaming?: boolean;
201|    }
202|  | {
203|      type: "case_citation";
204|      cluster_id: number | null;
205|      case_name: string | null;
206|      citation: string | null;
207|      url: string;
208|      pdfUrl?: string | null;
209|      dateFiled?: string | null;
210|      case?: Extract<AssistantEvent, { type: "case_opinions" }>["case"];
211|    }
212|  | {
213|      type: "case_opinions";
214|      cluster_id: number;
215|      case: {
216|        id: number | null;
217|        caseName?: string | null;
218|        dateFiled?: string | null;
219|        citations?: string[];
220|        url?: string | null;
221|        pdfUrl?: string | null;
222|        opinions: {
223|          opinionId: number | null;
224|          apiUrl?: string | null;
225|          type: string | null;
226|          author: string | null;
227|          url: string | null;
228|          text?: string | null;
229|          html?: string | null;
230|        }[];
231|      };
232|    }
233|  | { type: "content"; text: string; isStreaming?: boolean };
234|
235|export type CaseCitationQuote = {
236|  opinionId: number | null;
237|  type: string | null;
238|  author: string | null;
239|  quote: string;
240|};
241|
242|export interface Message {
243|  role: "user" | "assistant";
244|  content: string;
245|  files?: { filename: string; document_id?: string }[];
246|  workflow?: { id: string; title: string };
247|  model?: string;
248|  annotations?: CitationAnnotation[];
249|  citationStatus?: "started" | "partial" | "final";
250|  events?: AssistantEvent[];
251|  /** Set when streaming failed; rendered as a red error block. */
252|  error?: string;
253|}
254|
255|export interface CitationQuote {
256|  page?: number;
257|  quote: string;
258|}
259|
260|export type DocumentCitationQuote = {
261|  page: number | string;
262|  quote: string;
263|};
264|
265|export type DocumentCitationAnnotation = {
266|  type: "citation_data";
267|  kind?: "document";
268|  ref: number;
269|  doc_id: string;
270|  document_id: string;
271|  version_id?: string | null;
272|  version_number?: number | null;
273|  filename: string;
274|  /** Legacy single-quote fields. Prefer `quotes` for new annotations. */
275|  page: number | string;
276|  quote: string;
277|  quotes?: DocumentCitationQuote[];
278|};
279|
280|export type CaseCitationAnnotation = {
281|  type: "citation_data";
282|  kind: "case";
283|  ref: number;
284|  cluster_id: number;
285|  case_name?: string | null;
286|  citation?: string | null;
287|  url?: string | null;
288|  pdfUrl?: string | null;
289|  dateFiled?: string | null;
290|  quotes: CaseCitationQuote[];
291|};
292|
293|/**
294| * A citation emitted by the assistant. Document citations have doc/page
295| * anchors. Case citations anchor to a CourtListener cluster and include a
296| * quoted opinion passage.
297| */
298|export type CitationAnnotation =
299|  | DocumentCitationAnnotation
300|  | CaseCitationAnnotation;
301|
302|const PAGE_BREAK_SENTINEL = "[[PAGE_BREAK]]";
303|
304|function expandDocumentQuoteEntry(entry: DocumentCitationQuote): CitationQuote[] {
305|  const rangeMatch =
306|    typeof entry.page === "string"
307|      ? entry.page.match(/^(\d+)\s*-\s*(\d+)$/)
308|      : null;
309|  if (rangeMatch && entry.quote.includes(PAGE_BREAK_SENTINEL)) {
310|    const startPage = parseInt(rangeMatch[1], 10);
311|    const endPage = parseInt(rangeMatch[2], 10);
312|    const [before, after] = entry.quote.split(PAGE_BREAK_SENTINEL);
313|    return [
314|      { page: startPage, quote: before.trim() },
315|      { page: endPage, quote: after.trim() },
316|    ].filter((e) => e.quote.length > 0);
317|  }
318|  const pageNum =
319|    typeof entry.page === "number"
320|      ? entry.page
321|      : parseInt(String(entry.page), 10);
322|  if (!Number.isFinite(pageNum)) return [];
323|  return [{ page: pageNum, quote: entry.quote }];
324|}
325|
326|export function getDocumentCitationQuotes(
327|  a: CitationAnnotation,
328|): DocumentCitationQuote[] {
329|  if (a.kind === "case") return [];
330|  if (Array.isArray(a.quotes) && a.quotes.length) {
331|    return a.quotes.filter((entry) => entry.quote.trim().length > 0);
332|  }
333|  return [{ page: a.page, quote: a.quote }];
334|}
335|
336|/**
337| * Expand a citation into one or more (page, quote) entries suitable for
338| * highlighting in the PDF viewer. A single-page citation yields one entry; a
339| * cross-page citation with page "N-M" and a `[[PAGE_BREAK]]` split yields two.
340| */
341|export function expandCitationToEntries(
342|  a: CitationAnnotation,
343|): CitationQuote[] {
344|  if (a.kind === "case") return [];
345|  return getDocumentCitationQuotes(a).flatMap(expandDocumentQuoteEntry);
346|}
347|
348|/** Format the page(s) of a citation for display, e.g. "Page 3" or "Page 41-42". */
349|export function formatCitationPage(a: CitationAnnotation): string {
350|  if (a.kind === "case") {
351|    return a.citation || a.case_name || `Case ${a.cluster_id}`;
352|  }
353|  const quotes = getDocumentCitationQuotes(a);
354|  const pages = Array.from(
355|    new Set(quotes.map((q) => String(q.page)).filter(Boolean)),
356|  );
357|  if (pages.length > 1) return `Pages ${pages.join(", ")}`;
358|  if (pages.length === 1) return `Page ${pages[0]}`;
359|  if (typeof a.page === "string") return `Page ${a.page}`;
360|  return `Page ${a.page}`;
361|}
362|
363|/** Produce a reader-friendly version of the quote (replaces [[PAGE_BREAK]] with "..."). */
364|export function displayCitationQuote(a: CitationAnnotation): string {
365|  if (a.kind === "case") {
366|    return a.quotes
367|      .map((q) => q.quote.replaceAll(PAGE_BREAK_SENTINEL, "..."))
368|      .join(" / ");
369|  }
370|  return getDocumentCitationQuotes(a)
371|    .map((q) => q.quote.replaceAll(PAGE_BREAK_SENTINEL, "..."))
372|    .join(" / ");
373|}
374|
375|// Tabular Review
376|
377|export type ColumnFormat =
378|  | "text"
379|  | "bulleted_list"
380|  | "number"
381|  | "currency"
382|  | "yes_no"
383|  | "date"
384|  | "tag"
385|  | "percentage"
386|  | "monetary_amount";
387|
388|export interface ColumnConfig {
389|  index: number;
390|  name: string;
391|  prompt: string;
392|  format?: ColumnFormat;
393|  tags?: string[];
394|}
395|
396|export interface TabularReview {
397|  id: string;
398|  project_id: string | null;
399|  user_id: string;
400|  title: string | null;
401|  columns_config: ColumnConfig[] | null;
402|  document_ids?: string[] | null;
403|  workflow_id: string | null;
404|  practice?: string | null;
405|  /** Per-review email list. Used so standalone (project_id null) reviews can be shared directly. */
406|  shared_with?: string[];
407|  /** Server-set: true when the requesting user is the review's creator. */
408|  is_owner?: boolean;
409|  created_at: string;
410|  updated_at: string;
411|  document_count?: number;
412|}
413|
414|export interface TabularCell {
415|  id: string;
416|  review_id: string;
417|  document_id: string;
418|  column_index: number;
419|  content: {
420|    summary: string;
421|    flag?: "green" | "grey" | "yellow" | "red";
422|    reasoning?: string;
423|  } | null;
424|  status: "pending" | "generating" | "done" | "error";
425|  created_at: string;
426|}
427|
428|// Workflows
429|
430|export interface Workflow {
431|  id: string;
432|  user_id: string | null;
433|  title: string;
434|  type: "assistant" | "tabular";
435|  prompt_md: string | null;
436|  columns_config: ColumnConfig[] | null;
437|  is_system: boolean;
438|  created_at: string;
439|  practice?: string | null;
440|  shared_by_name?: string | null;
441|  allow_edit?: boolean;
442|  is_owner?: boolean;
443|}
444|
445|// API helpers
446|
447|export interface ChatDetailOut {
448|  chat: Chat;
449|  messages: Message[];
450|}
451|
452|export interface TabularReviewDetailOut {
453|  review: TabularReview;
454|  cells: TabularCell[];
455|  documents: Document[];
456|}
457|