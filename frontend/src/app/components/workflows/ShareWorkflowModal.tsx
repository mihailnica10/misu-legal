1|"use client";
2|
3|import { useEffect, useState } from "react";
4|import { X } from "lucide-react";
5|import {
6|    deleteWorkflowShare,
7|    listWorkflowShares,
8|    shareWorkflow,
9|} from "@/app/lib/misuApi";
10|import { useAuth } from "@/contexts/AuthContext";
11|import { EmailPillInput } from "../shared/EmailPillInput";
12|import { Modal } from "../shared/Modal";
13|
14|interface Share {
15|    id: string;
16|    shared_with_email: string;
17|    allow_edit: boolean;
18|    created_at: string;
19|}
20|
21|interface Props {
22|    workflowId: string;
23|    workflowName: string;
24|    onClose: () => void;
25|}
26|
27|export function ShareWorkflowModal({
28|    workflowId,
29|    workflowName,
30|    onClose,
31|}: Props) {
32|    const [pendingEmails, setPendingEmails] = useState<string[]>([]);
33|    const [allowEdit, setAllowEdit] = useState(false);
34|    const [existingShares, setExistingShares] = useState<Share[]>([]);
35|    const [loading, setLoading] = useState(true);
36|    const [saving, setSaving] = useState(false);
37|    const [error, setError] = useState<string | null>(null);
38|    const { user } = useAuth();
39|    const ownEmail = user?.email?.trim().toLowerCase() ?? null;
40|
41|    useEffect(() => {
42|        listWorkflowShares(workflowId)
43|            .then(setExistingShares)
44|            .catch(() => {})
45|            .finally(() => setLoading(false));
46|    }, [workflowId]);
47|
48|    async function handleRemoveShare(shareId: string) {
49|        await deleteWorkflowShare(workflowId, shareId).catch(() => {});
50|        setExistingShares((prev) => prev.filter((s) => s.id !== shareId));
51|    }
52|
53|    async function handleConfirm() {
54|        const emails = ownEmail
55|            ? pendingEmails.filter((email) => email !== ownEmail)
56|            : pendingEmails;
57|        if (emails.length === 0) return;
58|        setSaving(true);
59|        setError(null);
60|        try {
61|            await shareWorkflow(workflowId, { emails, allow_edit: allowEdit });
62|            const updated = await listWorkflowShares(workflowId);
63|            setExistingShares(updated);
64|            setPendingEmails([]);
65|        } catch (err) {
66|            setError(
67|                err instanceof Error && err.message
68|                    ? err.message
69|                    : "Unable to share this workflow. Please try again.",
70|            );
71|        } finally {
72|            setSaving(false);
73|        }
74|    }
75|
76|    return (
77|        <Modal
78|            open
79|            onClose={onClose}
80|            breadcrumbs={["Workflows", workflowName, "People"]}
81|            primaryAction={{
82|                label: saving ? "Sharing…" : "Share",
83|                onClick: handleConfirm,
84|                disabled: saving || pendingEmails.length === 0,
85|            }}
86|        >
87|                <EmailPillInput
88|                    emails={pendingEmails}
89|                    onChange={setPendingEmails}
90|                    validate={async (email) =>
91|                        ownEmail && email === ownEmail
92|                            ? "You cannot share a workflow with yourself."
93|                            : null
94|                    }
95|                    placeholder="Add people by email…"
96|                    autoFocus
97|                />
98|
99|                {error ? (
100|                    <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
101|                        {error}
102|                    </div>
103|                ) : null}
104|
105|                {/* Permission toggle */}
106|                <div className="flex flex-col gap-2">
107|                    <span className="text-xs font-medium text-gray-700">Allow editing by share recipients</span>
108|                    <button
109|                        type="button"
110|                        onClick={() => setAllowEdit((v) => !v)}
111|                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${allowEdit ? "bg-gray-900" : "bg-gray-200"}`}
112|                    >
113|                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${allowEdit ? "translate-x-4" : "translate-x-0"}`} />
114|                    </button>
115|                </div>
116|
117|                {/* Existing access */}
118|                <div>
119|                    <p className="text-xs font-medium text-gray-700 mb-2">People with access</p>
120|                    {loading ? (
121|                        <div className="space-y-2">
122|                            {[1, 2].map((i) => (
123|                                <div key={i} className="flex items-center justify-between">
124|                                    <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
125|                                    <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
126|                                </div>
127|                            ))}
128|                        </div>
129|                    ) : existingShares.length === 0 ? (
130|                        <p className="text-sm text-gray-400">None</p>
131|                    ) : (
132|                        <div className="space-y-1">
133|                            {existingShares.map((share) => (
134|                                <div key={share.id} className="flex items-center justify-between py-1">
135|                                    <span className="text-sm text-gray-700 truncate">{share.shared_with_email}</span>
136|                                    <div className="flex items-center gap-3 shrink-0">
137|                                        <span className="text-xs text-gray-400">{share.allow_edit ? "Can edit" : "Read-only"}</span>
138|                                        <button
139|                                            onClick={() => handleRemoveShare(share.id)}
140|                                            className="text-gray-300 hover:text-red-500 transition-colors"
141|                                        >
142|                                            <X className="h-3.5 w-3.5" />
143|                                        </button>
144|                                        </div>
145|                                    </div>
146|                                ))}
147|                            </div>
148|                        )}
149|                    </div>
150|        </Modal>
151|    );
152|}
153|