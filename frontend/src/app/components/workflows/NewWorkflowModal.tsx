1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { MessageSquare, Table2 } from "lucide-react";
5|import { createWorkflow, updateWorkflow } from "@/app/lib/misuApi";
6|import type { Workflow } from "../shared/types";
7|import { PRACTICE_OPTIONS } from "./practices";
8|import { Modal } from "../shared/Modal";
9|
10|interface Props {
11|    open: boolean;
12|    onClose: () => void;
13|    onCreated: (workflow: Workflow) => void;
14|    editWorkflow?: Workflow;
15|    onUpdated?: (workflow: Workflow) => void;
16|}
17|
18|export function NewWorkflowModal({ open, onClose, onCreated, editWorkflow, onUpdated }: Props) {
19|    const [title, setTitle] = useState("");
20|    const [type, setType] = useState<"assistant" | "tabular">("assistant");
21|    const [practice, setPractice] = useState<string>("");
22|    const [customPractice, setCustomPractice] = useState("");
23|    const [loading, setLoading] = useState(false);
24|    const [error, setError] = useState("");
25|    const customInputRef = useRef<HTMLInputElement>(null);
26|
27|    const isEditing = !!editWorkflow;
28|    const isOthers = practice === "Others";
29|    const effectivePractice = isOthers ? (customPractice.trim() || null) : (practice || null);
30|    const formId = "workflow-modal-form";
31|
32|    useEffect(() => {
33|        if (open && editWorkflow) {
34|            setTitle(editWorkflow.title);
35|            setType(editWorkflow.type);
36|            const saved = editWorkflow.practice ?? "";
37|            const isKnown = (PRACTICE_OPTIONS as readonly string[]).includes(saved);
38|            if (!isKnown && saved) {
39|                setPractice("Others");
40|                setCustomPractice(saved);
41|            } else {
42|                setPractice(saved);
43|                setCustomPractice("");
44|            }
45|            setError("");
46|        }
47|    }, [open, editWorkflow?.id]);
48|
49|    useEffect(() => {
50|        if (isOthers) {
51|            customInputRef.current?.focus();
52|        }
53|    }, [isOthers]);
54|
55|    if (!open) return null;
56|
57|    async function handleSubmit(e: React.FormEvent) {
58|        e.preventDefault();
59|        if (!title.trim()) return;
60|        setLoading(true);
61|        setError("");
62|        try {
63|            if (isEditing && editWorkflow) {
64|                const updated = await updateWorkflow(editWorkflow.id, {
65|                    title: title.trim(),
66|                    practice: effectivePractice,
67|                });
68|                onUpdated?.(updated);
69|            } else {
70|                const workflow = await createWorkflow({
71|                    title: title.trim(),
72|                    type,
73|                    practice: effectivePractice,
74|                });
75|                onCreated(workflow);
76|            }
77|            resetForm();
78|            onClose();
79|        } catch (err: unknown) {
80|            setError((err as Error).message || `Failed to ${isEditing ? "update" : "create"} workflow`);
81|        } finally {
82|            setLoading(false);
83|        }
84|    }
85|
86|    function resetForm() {
87|        setTitle("");
88|        setType("assistant");
89|        setPractice("");
90|        setCustomPractice("");
91|        setError("");
92|    }
93|
94|    function handleClose() {
95|        resetForm();
96|        onClose();
97|    }
98|
99|    return (
100|        <Modal
101|            open={open}
102|            onClose={handleClose}
103|            breadcrumbs={[
104|                "Workflows",
105|                isEditing ? "Edit workflow" : "New workflow",
106|            ]}
107|            primaryAction={{
108|                label: loading
109|                    ? isEditing
110|                        ? "Saving…"
111|                        : "Creating…"
112|                    : isEditing
113|                      ? "Save changes"
114|                      : "Create workflow",
115|                type: "submit",
116|                form: formId,
117|                disabled: !title.trim() || loading,
118|            }}
119|        >
120|            <form
121|                id={formId}
122|                onSubmit={handleSubmit}
123|                className="flex flex-col flex-1 min-h-0"
124|            >
125|                <input
126|                    type="text"
127|                    value={title}
128|                    onChange={(e) => setTitle(e.target.value)}
129|                    placeholder="Workflow name"
130|                    className="w-full text-2xl font-serif text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent"
131|                    autoFocus
132|                />
133|
134|                {!isEditing && (
135|                    <div className="mt-5">
136|                        <p className="mb-2 text-sm font-medium text-gray-500">Type</p>
137|                        <div className="flex items-center gap-2">
138|                            <button
139|                                type="button"
140|                                onClick={() => setType("assistant")}
141|                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
142|                                    type === "assistant"
143|                                        ? "border-gray-900 bg-gray-900 text-white"
144|                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
145|                                }`}
146|                            >
147|                                <MessageSquare className="h-3 w-3" />
148|                                Assistant
149|                            </button>
150|                            <button
151|                                type="button"
152|                                onClick={() => setType("tabular")}
153|                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
154|                                    type === "tabular"
155|                                        ? "border-gray-900 bg-gray-900 text-white"
156|                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
157|                                }`}
158|                            >
159|                                <Table2 className="h-3 w-3" />
160|                                Tabular
161|                            </button>
162|                        </div>
163|                    </div>
164|                )}
165|
166|                <div className="mt-5">
167|                    <p className="mb-2 text-sm font-medium text-gray-500">Practice Area</p>
168|                    <div className="flex flex-wrap gap-2">
169|                        {PRACTICE_OPTIONS.map((p) => (
170|                            <button
171|                                key={p}
172|                                type="button"
173|                                onClick={() => setPractice(practice === p ? "" : p)}
174|                                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
175|                                    practice === p
176|                                        ? "border-gray-900 bg-gray-900 text-white"
177|                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
178|                                }`}
179|                            >
180|                                {p}
181|                            </button>
182|                        ))}
183|                    </div>
184|                    {isOthers && (
185|                        <input
186|                            ref={customInputRef}
187|                            type="text"
188|                            value={customPractice}
189|                            onChange={(e) => setCustomPractice(e.target.value)}
190|                            placeholder="Enter practice area…"
191|                            className="mt-3 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
192|                        />
193|                    )}
194|                </div>
195|
196|                {error && (
197|                    <p className="mt-4 text-sm text-red-500">{error}</p>
198|                )}
199|            </form>
200|        </Modal>
201|    );
202|}
203|