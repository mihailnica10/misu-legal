1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { Check, Loader2, Search, Upload, X } from "lucide-react";
5|import { getProject, uploadProjectDocument } from "@/app/lib/misuApi";
6|import type { Document } from "./types";
7|import { DocFileIcon } from "./FileDirectory";
8|import { VersionChip } from "./VersionChip";
9|import { Modal } from "./Modal";
10|
11|interface Props {
12|    open: boolean;
13|    onClose: () => void;
14|    onSelect: (documents: Document[]) => void;
15|    breadcrumb: string[];
16|    projectId: string;
17|    /** Docs already in the target list — rendered checked + disabled. */
18|    excludeDocIds?: Set<string>;
19|    allowMultiple?: boolean;
20|}
21|
22|function formatDate(iso: string | null) {
23|    if (!iso) return null;
24|    return new Date(iso).toLocaleDateString(undefined, {
25|        day: "numeric",
26|        month: "short",
27|        year: "numeric",
28|    });
29|}
30|
31|export function AddProjectDocsModal({
32|    open,
33|    onClose,
34|    onSelect,
35|    breadcrumb,
36|    projectId,
37|    excludeDocIds,
38|    allowMultiple = true,
39|}: Props) {
40|    const [docs, setDocs] = useState<Document[]>([]);
41|    const [loading, setLoading] = useState(false);
42|    const [search, setSearch] = useState("");
43|    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
44|    const [uploading, setUploading] = useState(false);
45|    const fileInputRef = useRef<HTMLInputElement>(null);
46|
47|    useEffect(() => {
48|        if (!open) return;
49|        setSearch("");
50|        setSelectedIds(new Set());
51|        let cancelled = false;
52|        setLoading(true);
53|        getProject(projectId)
54|            .then((p) => {
55|                if (!cancelled) setDocs(p.documents ?? []);
56|            })
57|            .catch(() => {
58|                if (!cancelled) setDocs([]);
59|            })
60|            .finally(() => {
61|                if (!cancelled) setLoading(false);
62|            });
63|        return () => {
64|            cancelled = true;
65|        };
66|    }, [open, projectId]);
67|
68|    if (!open) return null;
69|
70|    const q = search.toLowerCase().trim();
71|    const filtered = q
72|        ? docs.filter((d) => d.filename.toLowerCase().includes(q))
73|        : docs;
74|
75|    const isExcluded = (id: string) => !!excludeDocIds?.has(id);
76|
77|    function toggle(id: string) {
78|        if (isExcluded(id)) return;
79|        if (!allowMultiple) {
80|            setSelectedIds(new Set([id]));
81|            return;
82|        }
83|        setSelectedIds((prev) => {
84|            const next = new Set(prev);
85|            next.has(id) ? next.delete(id) : next.add(id);
86|            return next;
87|        });
88|    }
89|
90|    function handleConfirm() {
91|        const selected = docs.filter((d) => selectedIds.has(d.id));
92|        onSelect(selected);
93|        onClose();
94|    }
95|
96|    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
97|        const files = Array.from(e.target.files || []);
98|        if (!files.length) return;
99|        setUploading(true);
100|        try {
101|            const uploaded = await Promise.all(
102|                files.map((f) => uploadProjectDocument(projectId, f)),
103|            );
104|            setDocs((prev) => [...uploaded, ...prev]);
105|            setSelectedIds((prev) => {
106|                const next = new Set(prev);
107|                uploaded.forEach((d) => next.add(d.id));
108|                return next;
109|            });
110|        } catch (err) {
111|            console.error("Upload failed:", err);
112|        } finally {
113|            setUploading(false);
114|            if (fileInputRef.current) fileInputRef.current.value = "";
115|        }
116|    }
117|
118|    return (
119|        <Modal
120|            open={open}
121|            onClose={onClose}
122|            breadcrumbs={breadcrumb}
123|            secondaryAction={{
124|                label: uploading ? "Uploading…" : "Upload",
125|                icon: uploading ? (
126|                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
127|                ) : (
128|                    <Upload className="h-3.5 w-3.5" />
129|                ),
130|                onClick: () => fileInputRef.current?.click(),
131|                disabled: uploading,
132|            }}
133|            footerStatus={
134|                selectedIds.size > 0 ? (
135|                    <span className="text-xs text-gray-400">
136|                        {selectedIds.size} selected
137|                    </span>
138|                ) : null
139|            }
140|            primaryAction={{
141|                label: "Confirm",
142|                onClick: handleConfirm,
143|                disabled: selectedIds.size === 0 || uploading,
144|            }}
145|        >
146|            <input
147|                ref={fileInputRef}
148|                type="file"
149|                accept=".pdf,.docx,.doc"
150|                multiple
151|                className="hidden"
152|                onChange={handleUpload}
153|            />
154|            {/* Search */}
155|            <div className="pt-1 pb-2">
156|                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
157|                    <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
158|                    <input
159|                        type="text"
160|                        placeholder="Search…"
161|                        value={search}
162|                        onChange={(e) => setSearch(e.target.value)}
163|                        className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
164|                        autoFocus
165|                    />
166|                    {search && (
167|                        <button
168|                            onClick={() => setSearch("")}
169|                            className="text-gray-400 hover:text-gray-600"
170|                        >
171|                            <X className="h-3.5 w-3.5" />
172|                        </button>
173|                    )}
174|                </div>
175|            </div>
176|
177|            {/* File list */}
178|            {loading ? (
179|                <div className="rounded-sm border border-gray-100 overflow-hidden">
180|                    {[60, 45, 75, 55, 40].map((w, i) => (
181|                        <div
182|                            key={i}
183|                            className="flex items-center gap-2 px-2 py-2"
184|                        >
185|                            <div className="h-3.5 w-3.5 rounded border border-gray-200 shrink-0" />
186|                            <div className="h-3.5 w-3.5 rounded bg-gray-200 animate-pulse shrink-0" />
187|                            <div
188|                                className="h-3 rounded bg-gray-200 animate-pulse"
189|                                style={{ width: `${w}%` }}
190|                            />
191|                        </div>
192|                    ))}
193|                </div>
194|            ) : filtered.length === 0 ? (
195|                <p className="text-center text-sm text-gray-400 py-8">
196|                    {q ? "No matches found" : "No documents in this project"}
197|                </p>
198|            ) : (
199|                <div className="rounded-sm border border-gray-100 overflow-hidden">
200|                    {filtered.map((doc) => {
201|                        const excluded = isExcluded(doc.id);
202|                        const checked = excluded || selectedIds.has(doc.id);
203|                        return (
204|                            <button
205|                                type="button"
206|                                key={doc.id}
207|                                disabled={excluded}
208|                                onClick={() => toggle(doc.id)}
209|                                className={`w-full flex items-center gap-2 px-2 py-2 text-xs text-left transition-colors ${
210|                                    excluded
211|                                        ? "opacity-50 cursor-not-allowed"
212|                                        : checked
213|                                          ? "bg-gray-100"
214|                                          : "hover:bg-gray-50"
215|                                }`}
216|                            >
217|                                <span
218|                                    className={`shrink-0 h-3.5 w-3.5 rounded border flex items-center justify-center ${
219|                                        checked
220|                                            ? "bg-gray-900 border-gray-900"
221|                                            : "border-gray-300"
222|                                    }`}
223|                                >
224|                                    {checked && (
225|                                        <Check className="h-2.5 w-2.5 text-white" />
226|                                    )}
227|                                </span>
228|                                <DocFileIcon fileType={doc.file_type} />
229|                                <span
230|                                    className={`flex-1 truncate ${
231|                                        checked
232|                                            ? "text-gray-900"
233|                                            : "text-gray-700"
234|                                    }`}
235|                                >
236|                                    {doc.filename}
237|                                </span>
238|                                {excluded && (
239|                                    <span className="text-[10px] text-gray-400 shrink-0">
240|                                        Already added
241|                                    </span>
242|                                )}
243|                                <VersionChip
244|                                    n={
245|                                        doc.active_version_number ??
246|                                        doc.latest_version_number
247|                                    }
248|                                />
249|                                {doc.created_at && (
250|                                    <span className="shrink-0 text-gray-300">
251|                                        {formatDate(doc.created_at)}
252|                                    </span>
253|                                )}
254|                            </button>
255|                        );
256|                    })}
257|                </div>
258|            )}
259|        </Modal>
260|    );
261|}
262|