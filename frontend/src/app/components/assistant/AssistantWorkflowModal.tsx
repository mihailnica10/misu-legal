1|"use client";
2|
3|import { useEffect, useState } from "react";
4|import { ChevronLeft, Search, X } from "lucide-react";
5|import ReactMarkdown from "react-markdown";
6|import remarkGfm from "remark-gfm";
7|import type { Workflow } from "../shared/types";
8|import { listWorkflows } from "@/app/lib/misuApi";
9|import { BUILT_IN_WORKFLOWS } from "../workflows/builtinWorkflows";
10|import { Modal } from "../shared/Modal";
11|
12|interface Props {
13|    open: boolean;
14|    onClose: () => void;
15|    onSelect: (workflow: Workflow) => void;
16|    projectName?: string;
17|    projectCmNumber?: string | null;
18|    initialWorkflowId?: string;
19|}
20|
21|export function AssistantWorkflowModal({
22|    open,
23|    onClose,
24|    onSelect,
25|    projectName,
26|    projectCmNumber,
27|    initialWorkflowId,
28|}: Props) {
29|    const [workflows, setWorkflows] = useState<Workflow[]>([]);
30|    const [loading, setLoading] = useState(false);
31|    const [selected, setSelected] = useState<Workflow | null>(null);
32|    const [search, setSearch] = useState("");
33|    const [rightVisible, setRightVisible] = useState(false);
34|
35|    useEffect(() => {
36|        if (!selected) {
37|            setRightVisible(false);
38|            return;
39|        }
40|        const frame = requestAnimationFrame(() => setRightVisible(true));
41|        return () => cancelAnimationFrame(frame);
42|    }, [selected]);
43|
44|    useEffect(() => {
45|        if (!open) {
46|            setSelected(null);
47|            setSearch("");
48|            return;
49|        }
50|        const builtins = BUILT_IN_WORKFLOWS.filter(
51|            (w) => w.type === "assistant",
52|        );
53|        setWorkflows(builtins);
54|        setLoading(true);
55|        listWorkflows("assistant")
56|            .then((custom) => {
57|                const all = [...builtins, ...custom];
58|                setWorkflows(all);
59|                if (initialWorkflowId) {
60|                    const match = all.find((w) => w.id === initialWorkflowId);
61|                    if (match) setSelected(match);
62|                }
63|            })
64|            .catch(() => {
65|                if (initialWorkflowId) {
66|                    const match = builtins.find((w) => w.id === initialWorkflowId);
67|                    if (match) setSelected(match);
68|                }
69|            })
70|            .finally(() => setLoading(false));
71|        // Pre-select from builtins immediately if possible
72|        if (initialWorkflowId) {
73|            const match = builtins.find((w) => w.id === initialWorkflowId);
74|            if (match) setSelected(match);
75|        }
76|    }, [open, initialWorkflowId]);
77|
78|    if (!open) return null;
79|
80|    const filteredWorkflows = search
81|        ? workflows.filter((w) => w.title.toLowerCase().includes(search.toLowerCase()))
82|        : workflows;
83|
84|    function handleUse() {
85|        if (!selected) return;
86|        onSelect(selected);
87|        onClose();
88|    }
89|
90|    const breadcrumbs = projectName
91|        ? [
92|              "Projects",
93|              `${projectName}${projectCmNumber ? ` (#${projectCmNumber})` : ""}`,
94|              "Assistant",
95|              "Add workflow",
96|          ]
97|        : ["Assistant", "Add workflow"];
98|
99|    return (
100|        <Modal
101|            open={open}
102|            onClose={onClose}
103|            size={selected ? "xl" : "lg"}
104|            breadcrumbs={breadcrumbs}
105|            primaryAction={{
106|                label: "Use",
107|                type: "button",
108|                onClick: handleUse,
109|                disabled: !selected,
110|            }}
111|        >
112|                {/* Content */}
113|                <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
114|                    {/* Left panel — workflow list */}
115|                    <div
116|                        className={`overflow-y-auto ${selected ? "w-80 shrink-0" : "flex-1"}`}
117|                    >
118|                        {/* Search */}
119|                        <div className="pt-3 pb-2 shrink-0">
120|                            <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1">
121|                                <Search className="h-3 w-3 text-gray-400 shrink-0" />
122|                                <input
123|                                    type="text"
124|                                    placeholder="Search workflows…"
125|                                    value={search}
126|                                    onChange={(e) => setSearch(e.target.value)}
127|                                    className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 outline-none"
128|                                />
129|                                {search && (
130|                                    <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
131|                                        <X className="h-3 w-3" />
132|                                    </button>
133|                                )}
134|                            </div>
135|                        </div>
136|
137|                        {loading ? (
138|                            <div className="space-y-px pt-1">
139|                                {[60, 45, 75, 50, 65, 40, 55].map((w, i) => (
140|                                    <div
141|                                        key={i}
142|                                        className="flex items-center justify-between gap-3 py-3 border-b border-gray-50"
143|                                    >
144|                                        <div
145|                                            className="h-3 rounded bg-gray-100 animate-pulse"
146|                                            style={{ width: `${w}%` }}
147|                                        />
148|                                        <div className="h-3 w-10 rounded bg-gray-100 animate-pulse shrink-0" />
149|                                    </div>
150|                                ))}
151|                            </div>
152|                        ) : filteredWorkflows.length === 0 ? (
153|                            <p className="py-8 text-sm text-center text-gray-400">
154|                                {search ? "No matches found" : "No assistant workflows found"}
155|                            </p>
156|                        ) : (
157|                            filteredWorkflows.map((wf) => (
158|                                <button
159|                                    key={wf.id}
160|                                    type="button"
161|                                    onClick={() =>
162|                                        setSelected((prev) =>
163|                                            prev?.id === wf.id ? null : wf,
164|                                        )
165|                                    }
166|                                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs text-left transition-colors border-b border-gray-50 ${
167|                                        selected?.id === wf.id
168|                                            ? "bg-gray-50"
169|                                            : "hover:bg-gray-50"
170|                                    }`}
171|                                >
172|                                    <span className="flex-1 truncate text-gray-800">
173|                                        {wf.title}
174|                                    </span>
175|                                    <span className="shrink-0 text-xs text-gray-400">
176|                                        {wf.is_system ? "Built-in" : "Custom"}
177|                                    </span>
178|                                </button>
179|                            ))
180|                        )}
181|                    </div>
182|
183|                    {/* Right panel — prompt preview */}
184|                    {selected && (
185|                        <div className={`flex-1 border-l border-gray-100 flex flex-col overflow-hidden px-3 pb-3 transition-opacity duration-200 ${rightVisible ? "opacity-100" : "opacity-0"}`}>
186|                            <div className="flex items-center justify-between py-3 shrink-0">
187|                                <p className="text-xs font-medium text-gray-700">
188|                                    Workflow Prompt
189|                                </p>
190|                                <button
191|                                    onClick={() => setSelected(null)}
192|                                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
193|                                >
194|                                    <ChevronLeft className="h-3.5 w-3.5" />
195|                                </button>
196|                            </div>
197|                            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm border border-gray-200 rounded-md text-gray-600 leading-relaxed font-serif bg-gray-50">
198|                                <ReactMarkdown
199|                                    remarkPlugins={[remarkGfm]}
200|                                    components={{
201|                                        h1: ({ children }) => (
202|                                            <h1 className="text-base font-semibold text-gray-900 mt-4 mb-1 first:mt-0">
203|                                                {children}
204|                                            </h1>
205|                                        ),
206|                                        h2: ({ children }) => (
207|                                            <h2 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0">
208|                                                {children}
209|                                            </h2>
210|                                        ),
211|                                        h3: ({ children }) => (
212|                                            <h3 className="text-xs font-semibold text-gray-900 mt-2 mb-0.5 first:mt-0">
213|                                                {children}
214|                                            </h3>
215|                                        ),
216|                                        p: ({ children }) => (
217|                                            <p className="mb-2 last:mb-0">
218|                                                {children}
219|                                            </p>
220|                                        ),
221|                                        ul: ({ children }) => (
222|                                            <ul className="list-disc pl-4 mb-2 space-y-0.5">
223|                                                {children}
224|                                            </ul>
225|                                        ),
226|                                        ol: ({ children }) => (
227|                                            <ol className="list-decimal pl-4 mb-2 space-y-0.5">
228|                                                {children}
229|                                            </ol>
230|                                        ),
231|                                        li: ({ children }) => (
232|                                            <li>{children}</li>
233|                                        ),
234|                                        strong: ({ children }) => (
235|                                            <strong className="font-semibold text-gray-800">
236|                                                {children}
237|                                            </strong>
238|                                        ),
239|                                        em: ({ children }) => (
240|                                            <em className="italic">
241|                                                {children}
242|                                            </em>
243|                                        ),
244|                                    }}
245|                                >
246|                                    {selected.prompt_md ??
247|                                        "_No prompt defined._"}
248|                                </ReactMarkdown>
249|                            </div>
250|                        </div>
251|                    )}
252|                </div>
253|
254|        </Modal>
255|    );
256|}
257|