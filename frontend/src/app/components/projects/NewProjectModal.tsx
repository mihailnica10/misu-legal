1|"use client";
2|
3|import { useRef, useState } from "react";
4|import { Users, Upload } from "lucide-react";
5|import {
6|    addDocumentToProject,
7|    createProject,
8|    uploadProjectDocument,
9|} from "@/app/lib/misuApi";
10|import { useDirectoryData } from "../shared/useDirectoryData";
11|import { FileDirectory } from "../shared/FileDirectory";
12|import { EmailPillInput } from "../shared/EmailPillInput";
13|import type { Project } from "../shared/types";
14|import { useAuth } from "@/contexts/AuthContext";
15|import { Modal } from "../shared/Modal";
16|
17|interface Props {
18|    open: boolean;
19|    onClose: () => void;
20|    onCreated: (project: Project) => void;
21|}
22|
23|export function NewProjectModal({ open, onClose, onCreated }: Props) {
24|    const [name, setName] = useState("");
25|    const [cmNumber, setCmNumber] = useState("");
26|    const [sharedEmails, setSharedEmails] = useState<string[]>([]);
27|    const [showMembers, setShowMembers] = useState(false);
28|    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
29|    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
30|    const [loading, setLoading] = useState(false);
31|    const [error, setError] = useState("");
32|    const fileInputRef = useRef<HTMLInputElement>(null);
33|    const { user } = useAuth();
34|    const ownEmail = user?.email?.trim().toLowerCase() ?? null;
35|    const formId = "new-project-modal-form";
36|
37|    const { loading: dirLoading, standaloneDocuments, projects: dirProjects } = useDirectoryData(open);
38|
39|    if (!open) return null;
40|
41|    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
42|        const files = Array.from(e.target.files ?? []);
43|        e.target.value = "";
44|        if (!files.length) return;
45|        setPendingFiles((prev) => [...prev, ...files.filter((f) => !prev.some((p) => p.name === f.name))]);
46|    }
47|
48|    async function handleSubmit(e: React.FormEvent) {
49|        e.preventDefault();
50|        if (!name.trim()) return;
51|        setLoading(true);
52|        setError("");
53|        try {
54|            const project = await createProject(
55|                name.trim(),
56|                cmNumber.trim() || undefined,
57|                ownEmail
58|                    ? sharedEmails.filter((email) => email !== ownEmail)
59|                    : sharedEmails,
60|            );
61|            await Promise.all([
62|                ...[...selectedDocIds].map((id) => addDocumentToProject(project.id, id).catch(() => {})),
63|                ...pendingFiles.map((f) => uploadProjectDocument(project.id, f).catch(() => {})),
64|            ]);
65|            onCreated({ ...project, document_count: selectedDocIds.size + pendingFiles.length });
66|            resetForm();
67|            onClose();
68|        } catch (err: unknown) {
69|            setError((err as Error).message || "Failed to create project");
70|        } finally {
71|            setLoading(false);
72|        }
73|    }
74|
75|    function resetForm() {
76|        setName("");
77|        setCmNumber("");
78|        setSharedEmails([]);
79|        setShowMembers(false);
80|        setSelectedDocIds(new Set());
81|        setPendingFiles([]);
82|        setError("");
83|    }
84|
85|    function handleClose() {
86|        resetForm();
87|        onClose();
88|    }
89|
90|    return (
91|        <Modal
92|            open={open}
93|            onClose={handleClose}
94|            breadcrumbs={["Projects", "New project"]}
95|            secondaryAction={{
96|                label: `Upload files${pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ""}`,
97|                icon: <Upload className="h-3.5 w-3.5" />,
98|                onClick: () => fileInputRef.current?.click(),
99|            }}
100|            primaryAction={{
101|                label: loading ? "Creating…" : "Create project",
102|                type: "submit",
103|                form: formId,
104|                disabled: !name.trim() || loading,
105|            }}
106|        >
107|            <input
108|                ref={fileInputRef}
109|                type="file"
110|                multiple
111|                className="hidden"
112|                onChange={handleFileChange}
113|            />
114|            <form
115|                id={formId}
116|                onSubmit={handleSubmit}
117|                className="flex flex-col flex-1 min-h-0"
118|            >
119|                <input
120|                    type="text"
121|                    value={name}
122|                    onChange={(e) => setName(e.target.value)}
123|                    placeholder="Project name"
124|                    className="w-full text-2xl font-serif text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent"
125|                    autoFocus
126|                />
127|
128|                <input
129|                    type="text"
130|                    value={cmNumber}
131|                    onChange={(e) => setCmNumber(e.target.value)}
132|                    placeholder="Add a CM number..."
133|                    className="mt-1.5 w-full text-sm text-gray-500 placeholder-gray-300 focus:outline-none bg-transparent"
134|                />
135|
136|                <div className="mt-4 flex flex-wrap items-center gap-2">
137|                    <button
138|                        type="button"
139|                        onClick={() => setShowMembers((v) => !v)}
140|                        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
141|                    >
142|                        <Users className="h-3 w-3 text-gray-400" />
143|                        Members{sharedEmails.length > 0 ? ` (${sharedEmails.length})` : ""}
144|                    </button>
145|                </div>
146|
147|                {showMembers && (
148|                    <div className="mt-3">
149|                        <EmailPillInput
150|                            emails={sharedEmails}
151|                            onChange={setSharedEmails}
152|                            validate={async (email) =>
153|                                ownEmail && email === ownEmail
154|                                    ? "You cannot share a project with yourself."
155|                                    : null
156|                            }
157|                            placeholder="Add colleagues by email…"
158|                        />
159|                    </div>
160|                )}
161|
162|                <div className="mt-4 space-y-2">
163|                    <p className="text-xs font-medium text-gray-700">Select documents</p>
164|                    <FileDirectory
165|                        standaloneDocs={standaloneDocuments}
166|                        directoryProjects={dirProjects}
167|                        loading={dirLoading}
168|                        selectedIds={selectedDocIds}
169|                        onChange={setSelectedDocIds}
170|                        emptyMessage="No existing documents"
171|                    />
172|                </div>
173|
174|                {error && (
175|                    <p className="mt-3 text-sm text-red-500">{error}</p>
176|                )}
177|            </form>
178|        </Modal>
179|    );
180|}
181|