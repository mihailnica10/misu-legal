1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import { Upload } from "lucide-react";
5|import { listDocumentVersions } from "@/app/lib/misuApi";
6|import type { Document } from "./types";
7|import { Modal } from "./Modal";
8|
9|interface Props {
10|    open: boolean;
11|    onClose: () => void;
12|    doc: Document | null;
13|    onSubmit: (file: File, filename: string) => Promise<void>;
14|}
15|
16|export function UploadNewVersionModal({ open, onClose, doc, onSubmit }: Props) {
17|    const [name, setName] = useState("");
18|    const [stagedFile, setStagedFile] = useState<File | null>(null);
19|    const [submitting, setSubmitting] = useState(false);
20|    const [currentVersion, setCurrentVersion] = useState<number | null>(null);
21|    const fileInputRef = useRef<HTMLInputElement>(null);
22|
23|    useEffect(() => {
24|        if (!open || !doc) return;
25|        setName(doc.filename);
26|        setStagedFile(null);
27|        setSubmitting(false);
28|        setCurrentVersion(null);
29|        let cancelled = false;
30|        (async () => {
31|            try {
32|                const { current_version_id, versions } =
33|                    await listDocumentVersions(doc.id);
34|                const current = versions.find(
35|                    (v) => v.id === current_version_id,
36|                );
37|                const initial =
38|                    (current?.filename && current.filename.trim()) ||
39|                    doc.filename;
40|                if (!cancelled) {
41|                    setName(initial);
42|                    setCurrentVersion(current?.version_number ?? null);
43|                }
44|            } catch {
45|                /* keep fallback */
46|            }
47|        })();
48|        return () => {
49|            cancelled = true;
50|        };
51|    }, [open, doc]);
52|
53|    if (!open || !doc) return null;
54|
55|    const accept = doc.file_type === "pdf" ? ".pdf" : ".docx,.doc";
56|
57|    function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
58|        const file = e.target.files?.[0] ?? null;
59|        setStagedFile(file);
60|        if (fileInputRef.current) fileInputRef.current.value = "";
61|    }
62|
63|    async function handleSubmit() {
64|        if (!stagedFile || submitting || !doc) return;
65|        const finalName = name.trim() || doc.filename;
66|        setSubmitting(true);
67|        try {
68|            await onSubmit(stagedFile, finalName);
69|            onClose();
70|        } finally {
71|            setSubmitting(false);
72|        }
73|    }
74|
75|    return (
76|        <Modal
77|            open={open}
78|            onClose={onClose}
79|            breadcrumbs={["Upload new version", doc.filename]}
80|            secondaryAction={{
81|                label: stagedFile ? "Change file" : "Upload",
82|                icon: <Upload className="h-3.5 w-3.5" />,
83|                onClick: () => fileInputRef.current?.click(),
84|                disabled: submitting,
85|            }}
86|            primaryAction={{
87|                label: submitting ? "Saving…" : "Save",
88|                onClick: handleSubmit,
89|                disabled: !stagedFile || submitting,
90|            }}
91|        >
92|            <input
93|                ref={fileInputRef}
94|                type="file"
95|                accept={accept}
96|                className="hidden"
97|                onChange={handleFilePick}
98|            />
99|            <label className="block text-xs font-medium text-gray-500 mb-1">
100|                New version name
101|            </label>
102|            <input
103|                type="text"
104|                value={name}
105|                onChange={(e) => setName(e.target.value)}
106|                placeholder="Version name"
107|                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
108|            />
109|            <div className="mt-2 text-xs text-gray-500">
110|                Current Version:{" "}
111|                <span className="text-gray-700 font-medium">
112|                    {currentVersion ?? "—"}
113|                </span>
114|            </div>
115|            {stagedFile && (
116|                <div className="mt-2 text-xs text-gray-500 truncate">
117|                    New Version File:{" "}
118|                    <span className="text-gray-700">{stagedFile.name}</span>
119|                </div>
120|            )}
121|        </Modal>
122|    );
123|}
124|