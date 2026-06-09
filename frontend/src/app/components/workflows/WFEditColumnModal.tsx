1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { createPortal } from "react-dom";
5|import { ChevronDown, Plus, X } from "lucide-react";
6|import type { ColumnConfig, ColumnFormat } from "../shared/types";
7|import { generateTabularColumnPrompt } from "@/app/lib/misuApi";
8|import { FORMAT_OPTIONS, formatLabel, formatIcon } from "../tabular/columnFormat";
9|import { TAG_COLORS } from "../tabular/pillUtils";
10|import { getPresetConfig, PROMPT_PRESETS } from "../tabular/columnPresets";
11|import {
12|    DropdownMenu,
13|    DropdownMenuContent,
14|    DropdownMenuRadioGroup,
15|    DropdownMenuRadioItem,
16|    DropdownMenuTrigger,
17|} from "@/components/ui/dropdown-menu";
18|
19|interface ColumnDraft {
20|    name: string;
21|    prompt: string;
22|    format: ColumnFormat;
23|    tags: string[];
24|    tagInput: string;
25|}
26|
27|interface Props {
28|    column: ColumnConfig;
29|    onClose: () => void;
30|    onSave: (col: ColumnConfig) => void;
31|    onDelete: () => void;
32|}
33|
34|export function WFEditColumnModal({ column, onClose, onSave, onDelete }: Props) {
35|    const [draft, setDraft] = useState<ColumnDraft>({
36|        name: column.name,
37|        prompt: column.prompt,
38|        format: column.format ?? "text",
39|        tags: column.tags ?? [],
40|        tagInput: "",
41|    });
42|    const [generating, setGenerating] = useState(false);
43|    const [presetsOpen, setPresetsOpen] = useState(false);
44|    const presetsRef = useRef<HTMLDivElement>(null);
45|
46|    useEffect(() => {
47|        setDraft({
48|            name: column.name,
49|            prompt: column.prompt,
50|            format: column.format ?? "text",
51|            tags: column.tags ?? [],
52|            tagInput: "",
53|        });
54|        setPresetsOpen(false);
55|    }, [column]);
56|
57|    useEffect(() => {
58|        if (!presetsOpen) return;
59|        function handleClickOutside(e: MouseEvent) {
60|            if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
61|                setPresetsOpen(false);
62|            }
63|        }
64|        document.addEventListener("mousedown", handleClickOutside);
65|        return () => document.removeEventListener("mousedown", handleClickOutside);
66|    }, [presetsOpen]);
67|
68|    function update(patch: Partial<ColumnDraft>) {
69|        setDraft((prev) => ({ ...prev, ...patch }));
70|    }
71|
72|    function commitTag() {
73|        const tag = draft.tagInput.trim();
74|        if (!tag || draft.tags.includes(tag)) {
75|            update({ tagInput: "" });
76|            return;
77|        }
78|        update({ tags: [...draft.tags, tag], tagInput: "" });
79|    }
80|
81|    function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
82|        if (e.key === "Enter" || e.key === ",") {
83|            e.preventDefault();
84|            commitTag();
85|        } else if (e.key === "Backspace" && draft.tagInput === "" && draft.tags.length > 0) {
86|            update({ tags: draft.tags.slice(0, -1) });
87|        }
88|    }
89|
90|    async function autoGeneratePrompt() {
91|        const title = draft.name.trim();
92|        if (!title) return;
93|        setGenerating(true);
94|        try {
95|            const { prompt } = await generateTabularColumnPrompt(title, {
96|                format: draft.format,
97|                tags: draft.format === "tag" ? draft.tags : undefined,
98|            });
99|            update({ prompt });
100|        } finally {
101|            setGenerating(false);
102|        }
103|    }
104|
105|    function handleSubmit(e: React.FormEvent) {
106|        e.preventDefault();
107|        if (!draft.name.trim() || !draft.prompt.trim()) return;
108|        onSave({
109|            index: column.index,
110|            name: draft.name.trim(),
111|            prompt: draft.prompt.trim(),
112|            format: draft.format,
113|            tags: draft.format === "tag" ? draft.tags : undefined,
114|        });
115|    }
116|
117|    const FormatIcon = formatIcon(draft.format);
118|
119|    return createPortal(
120|        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/20 backdrop-blur-xs">
121|            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col h-[600px]">
122|                {/* Header */}
123|                <div className="flex items-center justify-between px-6 pt-5 pb-2">
124|                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
125|                        <span>Workflows</span>
126|                        <span>›</span>
127|                        <span>Edit column</span>
128|                    </div>
129|                    <button
130|                        onClick={onClose}
131|                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
132|                    >
133|                        <X className="h-4 w-4" />
134|                    </button>
135|                </div>
136|
137|                <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
138|                    {/* Body */}
139|                    <div className="px-6 pt-3 pb-5 overflow-y-auto flex-1">
140|                        {/* Name row */}
141|                        <div className="flex items-start gap-2">
142|                            <div className="relative flex flex-1 items-start" ref={presetsRef}>
143|                                <input
144|                                    type="text"
145|                                    value={draft.name}
146|                                    onChange={(e) => {
147|                                        const name = e.target.value;
148|                                        const preset = getPresetConfig(name);
149|                                        update({
150|                                            name,
151|                                            ...(preset ? {
152|                                                prompt: preset.prompt,
153|                                                format: preset.format,
154|                                                tags: preset.tags ?? [],
155|                                                tagInput: "",
156|                                            } : {}),
157|                                        });
158|                                    }}
159|                                    placeholder="Column name"
160|                                    className="flex-1 text-2xl font-serif text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
161|                                    autoFocus
162|                                />
163|                                <button
164|                                    type="button"
165|                                    onClick={() => setPresetsOpen((v) => !v)}
166|                                    title="Column presets"
167|                                    className="mt-1.5 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
168|                                >
169|                                    <ChevronDown className={`h-4 w-4 transition-transform ${presetsOpen ? "rotate-180" : ""}`} />
170|                                </button>
171|                                {presetsOpen && (
172|                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-gray-100 bg-white shadow-lg overflow-y-auto max-h-64">
173|                                        <button
174|                                            type="button"
175|                                            onClick={() => { update({ name: "", prompt: "", format: "text", tags: [], tagInput: "" }); setPresetsOpen(false); }}
176|                                            className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 transition-colors border-b border-gray-100"
177|                                        >
178|                                            No Preset
179|                                        </button>
180|                                        {PROMPT_PRESETS.map((preset) => (
181|                                            <button
182|                                                key={preset.name}
183|                                                type="button"
184|                                                onClick={() => {
185|                                                    update({ name: preset.name, prompt: preset.prompt, format: preset.format, tags: preset.tags ?? [], tagInput: "" });
186|                                                    setPresetsOpen(false);
187|                                                }}
188|                                                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
189|                                            >
190|                                                {preset.name}
191|                                            </button>
192|                                        ))}
193|                                    </div>
194|                                )}
195|                            </div>
196|                        </div>
197|
198|                        {/* Format */}
199|                        <div className="mt-4">
200|                            <label className="text-sm font-medium text-gray-500">Format</label>
201|                            <DropdownMenu>
202|                                <DropdownMenuTrigger asChild>
203|                                    <button className="mt-1 flex items-center justify-between rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 hover:border-gray-400 focus:outline-none">
204|                                        <span className="flex items-center gap-2">
205|                                            <FormatIcon className="h-3.5 w-3.5 text-gray-400" />
206|                                            {formatLabel(draft.format)}
207|                                        </span>
208|                                        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
209|                                    </button>
210|                                </DropdownMenuTrigger>
211|                                <DropdownMenuContent align="start" className="z-[200]">
212|                                    <DropdownMenuRadioGroup
213|                                        value={draft.format}
214|                                        onValueChange={(v) => update({ format: v as ColumnFormat, tags: [], tagInput: "" })}
215|                                    >
216|                                        {FORMAT_OPTIONS.map((o) => (
217|                                            <DropdownMenuRadioItem key={o.value} value={o.value}>
218|                                                <o.icon className="h-3.5 w-3.5 text-gray-400" />
219|                                                {o.label}
220|                                            </DropdownMenuRadioItem>
221|                                        ))}
222|                                    </DropdownMenuRadioGroup>
223|                                </DropdownMenuContent>
224|                            </DropdownMenu>
225|                        </div>
226|
227|                        {/* Tag input */}
228|                        {draft.format === "tag" && (
229|                            <div className="mt-3">
230|                                <label className="text-sm font-medium text-gray-500">Tags</label>
231|                                <div className="mt-1 flex flex-wrap gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 focus-within:border-gray-400">
232|                                    {draft.tags.map((tag, tagIdx) => (
233|                                        <span
234|                                            key={tag}
235|                                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${TAG_COLORS[tagIdx % TAG_COLORS.length]}`}
236|                                        >
237|                                            {tag}
238|                                            <button
239|                                                type="button"
240|                                                onClick={() => update({ tags: draft.tags.filter((t) => t !== tag) })}
241|                                                className="text-gray-400 hover:text-gray-600"
242|                                            >
243|                                                <X className="h-2.5 w-2.5" />
244|                                            </button>
245|                                        </span>
246|                                    ))}
247|                                    <input
248|                                        type="text"
249|                                        value={draft.tagInput}
250|                                        onChange={(e) => update({ tagInput: e.target.value })}
251|                                        onKeyDown={handleTagKeyDown}
252|                                        onBlur={commitTag}
253|                                        placeholder="Add tag…"
254|                                        className="min-w-[80px] flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
255|                                    />
256|                                </div>
257|                                <p className="mt-1 text-xs text-gray-400">Press Enter or comma to add a tag.</p>
258|                            </div>
259|                        )}
260|
261|                        {/* Prompt */}
262|                        <div className="mt-4 flex items-center justify-between">
263|                            <label className="text-sm font-medium text-gray-500">Prompt</label>
264|                            <button
265|                                type="button"
266|                                onClick={autoGeneratePrompt}
267|                                disabled={!draft.name.trim() || generating}
268|                                className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 disabled:text-gray-300"
269|                            >
270|                                {generating ? (
271|                                    <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin block" />
272|                                ) : (
273|                                    <Plus className="h-4 w-4" />
274|                                )}
275|                                Auto-Generate Prompt
276|                            </button>
277|                        </div>
278|                        <textarea
279|                            rows={6}
280|                            value={draft.prompt}
281|                            onChange={(e) => update({ prompt: e.target.value })}
282|                            placeholder="Write the analysis prompt — describe what Mișu should extract from each document for this column…"
283|                            className="mt-2 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none bg-transparent resize-none leading-relaxed"
284|                        />
285|                    </div>
286|
287|                    {/* Footer */}
288|                    <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
289|                        <button
290|                            type="button"
291|                            onClick={onDelete}
292|                            className="rounded-lg px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
293|                        >
294|                            Delete
295|                        </button>
296|                        <div className="flex items-center gap-2">
297|                            <button
298|                                type="button"
299|                                onClick={onClose}
300|                                className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
301|                            >
302|                                Cancel
303|                            </button>
304|                            <button
305|                                type="submit"
306|                                disabled={!draft.name.trim() || !draft.prompt.trim()}
307|                                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
308|                            >
309|                                Save changes
310|                            </button>
311|                        </div>
312|                    </div>
313|                </form>
314|            </div>
315|        </div>,
316|        document.body,
317|    );
318|}
319|