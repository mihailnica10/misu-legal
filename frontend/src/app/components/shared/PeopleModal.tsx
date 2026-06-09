1|"use client";
2|
3|import { useEffect, useState } from "react";
4|import { User, UserPlus, Loader2, Plus } from "lucide-react";
5|import type { ProjectPeople } from "@/app/lib/misuApi";
6|import { Modal } from "./Modal";
7|
8|/**
9| * Any resource the modal can manage members for — projects today, tabular
10| * reviews now, anything else with a `shared_with` email list later.
11| */
12|export interface SharedResource {
13|    id: string;
14|    shared_with?: string[] | null;
15|}
16|
17|interface Props {
18|    open: boolean;
19|    onClose: () => void;
20|    /** The thing being shared (project, review, …). */
21|    resource: SharedResource | null;
22|    /**
23|     * Resolve the owner + members roster for the given resource. Different
24|     * resource types hit different endpoints (`/projects/:id/people`,
25|     * `/tabular-review/:id/people`, …) so the caller passes the appropriate
26|     * fetcher.
27|     */
28|    fetchPeople: (id: string) => Promise<ProjectPeople>;
29|    /** Currently signed-in user's email — gets the "You" tag if it matches. */
30|    currentUserEmail?: string | null;
31|    breadcrumb: string[];
32|    /**
33|     * Persist a new shared_with list. Parent should PATCH the resource and
34|     * sync its local state on success. Throw to surface an error inline.
35|     */
36|    onSharedWithChange?: (sharedWith: string[]) => Promise<void> | void;
37|}
38|
39|const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
40|
41|type RosterRow = {
42|    email: string;
43|    display_name: string | null;
44|    role: "owner" | "member";
45|};
46|
47|/**
48| * Roster of every Mike member with access to the project, with controls to
49| * add/remove members. Mirrors AddDocumentsModal's frame.
50| */
51|export function PeopleModal({
52|    open,
53|    onClose,
54|    resource,
55|    fetchPeople,
56|    currentUserEmail,
57|    breadcrumb,
58|    onSharedWithChange,
59|}: Props) {
60|    const [newEmail, setNewEmail] = useState("");
61|    const [busy, setBusy] = useState<"add" | "remove" | null>(null);
62|    const [removingEmail, setRemovingEmail] = useState<string | null>(null);
63|    const [error, setError] = useState<string | null>(null);
64|
65|    // Server-resolved roster: owner email/display_name + members'
66|    // display_names. We keep `resource.shared_with` as the source of truth
67|    // for membership and just merge display_names from this fetch.
68|    const [people, setPeople] = useState<ProjectPeople | null>(null);
69|    const [peopleLoading, setPeopleLoading] = useState(false);
70|
71|    const resourceId = resource?.id ?? null;
72|    const sharedWith: string[] = Array.isArray(resource?.shared_with)
73|        ? (resource!.shared_with as string[])
74|        : [];
75|
76|    useEffect(() => {
77|        if (!open) return;
78|        setNewEmail("");
79|        setError(null);
80|        setBusy(null);
81|        setRemovingEmail(null);
82|    }, [open]);
83|
84|    // Re-fetch roster whenever the modal opens or membership changes —
85|    // keyed by the joined shared_with list so add/remove triggers a refresh.
86|    const sharedKey = sharedWith
87|        .map((e) => e.toLowerCase())
88|        .sort()
89|        .join(",");
90|
91|    useEffect(() => {
92|        if (!open || !resourceId) return;
93|        let cancelled = false;
94|        setPeopleLoading(true);
95|        fetchPeople(resourceId)
96|            .then((data) => {
97|                if (cancelled) return;
98|                setPeople(data);
99|            })
100|            .catch(() => {
101|                /* keep stale data; modal still works on emails alone */
102|            })
103|            .finally(() => {
104|                if (!cancelled) setPeopleLoading(false);
105|            });
106|        return () => {
107|            cancelled = true;
108|        };
109|    }, [open, resourceId, sharedKey, fetchPeople]);
110|
111|    if (!open || !resource) return null;
112|
113|    const memberDisplayByEmail = new Map<string, string | null>();
114|    for (const m of people?.members ?? []) {
115|        memberDisplayByEmail.set(m.email.toLowerCase(), m.display_name);
116|    }
117|    const ownerEmail = people?.owner.email ?? null;
118|    const ownerDisplayName = people?.owner.display_name ?? null;
119|
120|    const roster: RosterRow[] = [];
121|    if (ownerEmail) {
122|        roster.push({
123|            email: ownerEmail,
124|            display_name: ownerDisplayName,
125|            role: "owner",
126|        });
127|    }
128|    for (const email of sharedWith) {
129|        const lower = email.toLowerCase();
130|        if (ownerEmail && lower === ownerEmail.toLowerCase()) continue;
131|        roster.push({
132|            email,
133|            display_name: memberDisplayByEmail.get(lower) ?? null,
134|            role: "member",
135|        });
136|    }
137|
138|    const trimmedNewEmail = newEmail.trim().toLowerCase();
139|    const normalizedCurrentUserEmail =
140|        currentUserEmail?.trim().toLowerCase() ?? null;
141|    const isValidEmail = EMAIL_RE.test(trimmedNewEmail);
142|    const sharedLower = sharedWith.map((e) => e.toLowerCase());
143|    const alreadyShared = sharedLower.includes(trimmedNewEmail);
144|    const isOwnerEmail =
145|        !!ownerEmail && trimmedNewEmail === ownerEmail.toLowerCase();
146|    const isSelfEmail =
147|        !!normalizedCurrentUserEmail &&
148|        trimmedNewEmail === normalizedCurrentUserEmail;
149|    const canAdd =
150|        isValidEmail &&
151|        !alreadyShared &&
152|        !isOwnerEmail &&
153|        !isSelfEmail &&
154|        busy === null;
155|
156|    async function handleAdd() {
157|        if (!canAdd || !onSharedWithChange) return;
158|        setBusy("add");
159|        setError(null);
160|        try {
161|            const next = [...sharedWith, trimmedNewEmail];
162|            await onSharedWithChange(next);
163|            setNewEmail("");
164|        } catch (e) {
165|            setError(
166|                e instanceof Error
167|                    ? e.message
168|                    : "Couldn't add the member. Try again.",
169|            );
170|        } finally {
171|            setBusy(null);
172|        }
173|    }
174|
175|    async function handleRemove(email: string) {
176|        if (!onSharedWithChange || busy !== null) return;
177|        setBusy("remove");
178|        setRemovingEmail(email);
179|        setError(null);
180|        try {
181|            const next = sharedWith.filter(
182|                (e) => e.toLowerCase() !== email.toLowerCase(),
183|            );
184|            await onSharedWithChange(next);
185|        } catch (e) {
186|            setError(
187|                e instanceof Error
188|                    ? e.message
189|                    : "Couldn't remove the member. Try again.",
190|            );
191|        } finally {
192|            setBusy(null);
193|            setRemovingEmail(null);
194|        }
195|    }
196|
197|    return (
198|        <Modal
199|            open={open}
200|            onClose={onClose}
201|            breadcrumbs={breadcrumb}
202|            footerInfo={
203|                roster.length === 0
204|                    ? "No one has access yet."
205|                    : `${roster.length} ${
206|                          roster.length === 1 ? "person" : "people"
207|                      } with access.`
208|            }
209|        >
210|                {/* Add-member row */}
211|                {onSharedWithChange && (
212|                    <div className="pt-1 pb-2">
213|                        <div className="flex items-center gap-2">
214|                            <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
215|                                <UserPlus className="h-3.5 w-3.5 text-gray-400 shrink-0" />
216|                                <input
217|                                    type="email"
218|                                    placeholder="Add by email…"
219|                                    value={newEmail}
220|                                    onChange={(e) =>
221|                                        setNewEmail(e.target.value)
222|                                    }
223|                                    onKeyDown={(e) => {
224|                                        if (e.key === "Enter") void handleAdd();
225|                                    }}
226|                                    className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
227|                                    autoFocus
228|                                />
229|                            </div>
230|                            <button
231|                                onClick={() => void handleAdd()}
232|                                disabled={!canAdd}
233|                                title="Add member"
234|                                className="inline-flex items-center justify-center rounded-lg border border-gray-900 bg-gray-900 p-2 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
235|                            >
236|                                {busy === "add" ? (
237|                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
238|                                ) : (
239|                                    <Plus className="h-3.5 w-3.5" />
240|                                )}
241|                            </button>
242|                        </div>
243|                        {alreadyShared && trimmedNewEmail && (
244|                            <p className="mt-1.5 text-xs text-gray-400">
245|                                {trimmedNewEmail} already has access.
246|                            </p>
247|                        )}
248|                        {isOwnerEmail && trimmedNewEmail && (
249|                            <p className="mt-1.5 text-xs text-gray-400">
250|                                {trimmedNewEmail} is the owner.
251|                            </p>
252|                        )}
253|                        {isSelfEmail && !isOwnerEmail && trimmedNewEmail && (
254|                            <p className="mt-1.5 text-xs text-gray-400">
255|                                You cannot share this with yourself.
256|                            </p>
257|                        )}
258|                        {trimmedNewEmail &&
259|                            !isValidEmail &&
260|                            !alreadyShared &&
261|                            !isOwnerEmail &&
262|                            !isSelfEmail && (
263|                                <p className="mt-1.5 text-xs text-gray-400">
264|                                    Enter a valid email.
265|                                </p>
266|                            )}
267|                        {error && (
268|                            <p className="mt-1.5 text-xs text-red-500">
269|                                {error}
270|                            </p>
271|                        )}
272|                    </div>
273|                )}
274|
275|                {/* Section heading */}
276|                <div className="pt-3 pb-1 flex items-center gap-2">
277|                    <h3 className="text-xs font-medium text-gray-500">
278|                        People with Access
279|                    </h3>
280|                    {peopleLoading && (
281|                        <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
282|                    )}
283|                </div>
284|
285|                {/* Member list */}
286|                {roster.length === 0 ? (
287|                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
288|                        No one has access yet.
289|                    </div>
290|                ) : (
291|                    <ul className="divide-y divide-gray-100 [&>li:nth-child(2)]:border-t-0">
292|                        {roster.map((entry) => {
293|                            const isYou =
294|                                !!currentUserEmail &&
295|                                entry.email.toLowerCase() ===
296|                                    currentUserEmail.toLowerCase();
297|                            const isRemoving =
298|                                busy === "remove" &&
299|                                removingEmail === entry.email;
300|                            const primary =
301|                                entry.display_name?.trim() || entry.email;
302|                            const showSecondary =
303|                                !!entry.display_name?.trim() &&
304|                                primary !== entry.email;
305|                            return (
306|                                <li
307|                                    key={`${entry.role}-${entry.email}`}
308|                                    className="flex items-center gap-3 py-3"
309|                                >
310|                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
311|                                        <User className="h-3 w-3" />
312|                                    </div>
313|                                    <div className="min-w-0 flex-1">
314|                                        <p className="truncate text-sm text-gray-800">
315|                                            {primary}
316|                                            {isYou && (
317|                                                <span className="ml-1.5 text-xs text-gray-400">
318|                                                    (You)
319|                                                </span>
320|                                            )}
321|                                            {entry.role === "owner" && (
322|                                                <span className="ml-1.5 text-[10px] text-gray-400">
323|                                                    Owner
324|                                                </span>
325|                                            )}
326|                                        </p>
327|                                        {showSecondary && (
328|                                            <p className="truncate text-xs text-gray-400">
329|                                                {entry.email}
330|                                            </p>
331|                                        )}
332|                                    </div>
333|                                    {entry.role === "member" &&
334|                                        onSharedWithChange && (
335|                                            <button
336|                                                onClick={() =>
337|                                                    void handleRemove(
338|                                                        entry.email,
339|                                                    )
340|                                                }
341|                                                disabled={busy !== null}
342|                                                title="Remove access"
343|                                                className="self-center inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
344|                                            >
345|                                                {isRemoving && (
346|                                                    <Loader2 className="h-3 w-3 animate-spin" />
347|                                                )}
348|                                                Remove
349|                                            </button>
350|                                        )}
351|                                </li>
352|                            );
353|                        })}
354|                    </ul>
355|                )}
356|
357|        </Modal>
358|    );
359|}
360|