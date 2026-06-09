1|"use client";
2|
3|import { useEffect, useState } from "react";
4|import { createPortal } from "react-dom";
5|import { Download, Trash2, X } from "lucide-react";
6|import { DocView } from "./DocView";
7|import { getDocumentUrl } from "@/app/lib/misuApi";
8|import type { Document } from "./types";
9|
10|interface Props {
11|    doc: Document | null;
12|    /** Optional specific version to display. Only honoured for DOCX. */
13|    versionId?: string | null;
14|    /** Optional label suffix for the header (e.g. "V3"). */
15|    versionLabel?: string | null;
16|    onClose: () => void;
17|    onDelete?: (doc: Document) => void;
18|}
19|
20|export function DocViewModal({
21|    doc,
22|    versionId,
23|    versionLabel,
24|    onClose,
25|    onDelete,
26|}: Props) {
27|    const [mounted, setMounted] = useState(false);
28|    useEffect(() => setMounted(true), []);
29|
30|    if (!doc || !mounted) return null;
31|
32|    async function handleDownload() {
33|        if (!doc) return;
34|        const { url, filename } = await getDocumentUrl(doc.id, versionId ?? null);
35|        const a = document.createElement("a");
36|        a.href = url;
37|        a.download = filename;
38|        a.click();
39|    }
40|
41|    return createPortal(
42|        <div
43|            className="fixed inset-0 z-100 flex items-center justify-center bg-black/40"
44|            onClick={onClose}
45|        >
46|            <div
47|                className="relative flex flex-col bg-white rounded-xl shadow-2xl w-[800px] max-w-[90vw] h-[90vh]"
48|                onClick={(e) => e.stopPropagation()}
49|            >
50|                {/* Header */}
51|                <div className="flex items-center justify-between px-5 py-3 shrink-0">
52|                    <span className="text-base font-medium font-serif text-gray-800 truncate pr-4">
53|                        {doc.filename}
54|                        {versionLabel && (
55|                            <span className="ml-2 text-xs font-normal text-gray-500">
56|                                {versionLabel}
57|                            </span>
58|                        )}
59|                    </span>
60|                    <div className="flex items-center gap-1 shrink-0">
61|                        <button
62|                            onClick={handleDownload}
63|                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
64|                        >
65|                            <Download className="h-4 w-4" />
66|                        </button>
67|                        {onDelete && (
68|                            <button
69|                                onClick={() => { onDelete(doc); onClose(); }}
70|                                className="flex items-center justify-center w-6 h-6 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
71|                            >
72|                                <Trash2 className="h-4 w-4" />
73|                            </button>
74|                        )}
75|                        <button
76|                            onClick={onClose}
77|                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
78|                        >
79|                            <X className="h-4 w-4" />
80|                        </button>
81|                    </div>
82|                </div>
83|
84|                {/* DocView serves PDF when available and falls back to
85|                    docx-preview internally if the active version has no
86|                    PDF rendition. Passing no versionId tells the backend
87|                    to resolve the latest tracked-changes version. */}
88|                <div className="flex flex-col flex-1 overflow-hidden px-3 pb-3">
89|                    <DocView
90|                        key={versionId ?? "current"}
91|                        doc={{
92|                            document_id: doc.id,
93|                            version_id: versionId ?? null,
94|                        }}
95|                    />
96|                </div>
97|            </div>
98|        </div>,
99|        document.body,
100|    );
101|}
102|