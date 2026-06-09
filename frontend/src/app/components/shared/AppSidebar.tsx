1|1|"use client";
2|2|
3|3|import { useState, useEffect, useMemo } from "react";
4|4|import {
5|5|    PanelLeft,
6|6|    MessageSquare,
7|7|    FolderOpen,
8|8|    Table2,
9|9|    Library,
10|10|    User,
11|11|    ChevronsUpDown,
12|12|    ChevronDown,
13|13|} from "lucide-react";
14|14|import { useAuth } from "@/contexts/AuthContext";
15|15|import { useUserProfile } from "@/contexts/UserProfileContext";
16|16|import { useChatHistoryContext } from "@/app/contexts/ChatHistoryContext";
17|17|import { useRouter, usePathname } from "next/navigation";
18|18|import Link from "next/link";
19|19|import { MisuIcon } from "@/components/chat/misu-icon";
20|20|import { SidebarChatItem } from "@/app/components/shared/SidebarChatItem";
21|21|import { listProjects } from "@/app/lib/misuApi";
22|22|import type { Project } from "@/app/components/shared/types";
23|23|import { cn } from "@/lib/utils";
24|24|
25|25|const NAV_ITEMS = [
26|26|    { href: "/assistant", label: "Assistant", icon: MessageSquare },
27|27|    { href: "/projects", label: "Projects", icon: FolderOpen },
28|28|    { href: "/tabular-reviews", label: "Tabular Review", icon: Table2 },
29|29|    { href: "/workflows", label: "Workflows", icon: Library },
30|30|];
31|31|
32|32|interface AppSidebarProps {
33|33|    isOpen: boolean;
34|34|    onToggle: () => void;
35|35|}
36|36|
37|37|export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
38|38|    const { user } = useAuth();
39|39|    const { profile } = useUserProfile();
40|40|    const { chats, hasMoreChats, loadMoreChats, setCurrentChatId } =
41|41|        useChatHistoryContext();
42|42|    const router = useRouter();
43|43|    const pathname = usePathname();
44|44|    const routeChatId = useMemo(() => {
45|45|        if (pathname.startsWith("/assistant/chat/")) {
46|46|            return pathname.split("/").pop() ?? null;
47|47|        }
48|48|
49|49|        const projectChatMatch = pathname.match(
50|50|            /^\/projects\/[^/]+\/assistant\/chat\/([^/]+)/,
51|51|        );
52|52|        return projectChatMatch?.[1] ?? null;
53|53|    }, [pathname]);
54|54|    const [shouldAnimate, setShouldAnimate] = useState(false);
55|55|    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
56|56|    const [projectsCollapsed, setProjectsCollapsed] = useState(false);
57|57|    const [historyCollapsed, setHistoryCollapsed] = useState(false);
58|58|    const [projectNames, setProjectNames] = useState<Record<string, string>>(
59|59|        {},
60|60|    );
61|61|    const [recentProjects, setRecentProjects] = useState<Project[] | null>(
62|62|        null,
63|63|    );
64|64|
65|65|    useEffect(() => {
66|66|        if (!user) return;
67|67|        listProjects()
68|68|            .then((projects) => {
69|69|                const map: Record<string, string> = {};
70|70|                for (const p of projects) map[p.id] = p.name;
71|71|                setProjectNames(map);
72|72|                setRecentProjects(
73|73|                    [...projects]
74|74|                        .sort(
75|75|                            (a, b) =>
76|76|                                Date.parse(b.updated_at || b.created_at) -
77|77|                                Date.parse(a.updated_at || a.created_at),
78|78|                        )
79|79|                        .slice(0, 5),
80|80|                );
81|81|            })
82|82|            .catch(() => {
83|83|                setProjectNames({});
84|84|                setRecentProjects([]);
85|85|            });
86|86|    }, [user]);
87|87|
88|88|    useEffect(() => {
89|89|        if (!isOpen) setShouldAnimate(true);
90|90|    }, [isOpen]);
91|91|
92|92|    useEffect(() => {
93|93|        const handleClickOutside = () => setIsDropdownOpen(false);
94|94|        if (isDropdownOpen) {
95|95|            document.addEventListener("click", handleClickOutside);
96|96|            return () =>
97|97|                document.removeEventListener("click", handleClickOutside);
98|98|        }
99|99|    }, [isDropdownOpen]);
100|100|
101|101|    useEffect(() => {
102|102|        setCurrentChatId(routeChatId);
103|103|    }, [routeChatId, setCurrentChatId]);
104|104|
105|105|    const getUserInitials = (email: string) => {
106|106|        if (profile?.displayName)
107|107|            return profile.displayName.charAt(0).toUpperCase();
108|108|        return email.charAt(0).toUpperCase();
109|109|    };
110|110|
111|111|    const getDisplayName = () => {
112|112|        if (!profile) return "";
113|113|        return profile.displayName || user?.email?.split("@")[0] || "";
114|114|    };
115|115|
116|116|    const getUserTier = () => {
117|117|        if (!profile) return "";
118|118|        return profile.tier || "Free";
119|119|    };
120|120|
121|121|    if (!user) return null;
122|122|
123|123|    return (
124|124|        <div
125|125|            className={cn(
126|126|                isOpen
127|127|                    ? "w-64 h-[calc(100dvh-1rem)] md:h-[calc(100dvh-1.5rem)] bg-white/65"
128|128|                    : "max-md:hidden w-14 md:h-[calc(100dvh-1.5rem)] md:bg-white/65 h-auto bg-transparent pointer-events-none md:pointer-events-auto",
129|129|                "my-2 ml-2 mr-0 md:my-3 md:ml-3 md:mr-0 rounded-2xl border border-white/70 shadow-[0_-2px_7px_rgba(15,23,42,0.044),0_5px_12px_rgba(15,23,42,0.095),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl overflow-visible",
130|130|                "flex flex-col transition-all duration-300 absolute md:relative z-[99]",
131|131|            )}
132|132|        >
133|133|            {/* Toggle + Logo */}
134|134|            <div
135|135|                className={`items-center justify-between px-2.5 py-3 ${
136|136|                    !isOpen ? "hidden md:flex" : "flex"
137|137|                }`}
138|138|            >
139|139|                {isOpen && (
140|140|                    <div className="px-2">
141|141|                        <Link
142|142|                            href="/assistant"
143|143|                            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
144|144|                        >
145|145|                            <MisuIcon size={22} />
146|146|                            <span
147|147|                                className={`text-2xl font-light font-serif ${
148|148|                                    shouldAnimate ? "sidebar-fade-in" : ""
149|149|                                }`}
150|150|                            >
151|151|                                Mike
152|152|                            </span>
153|153|                        </Link>
154|154|                    </div>
155|155|                )}
156|156|                <button
157|157|                    onClick={onToggle}
158|158|                    className={cn(
159|159|                        "h-9 w-9 p-2.5 items-center flex transition-colors",
160|160|                        "rounded-xl hover:bg-gray-100",
161|161|                    )}
162|162|                    title={isOpen ? "Close sidebar" : "Open sidebar"}
163|163|                >
164|164|                    <PanelLeft className="h-4 w-4" />
165|165|                </button>
166|166|            </div>
167|167|
168|168|            {/* Nav items */}
169|169|            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
170|170|                const isActive =
171|171|                    href === "/assistant"
172|172|                        ? pathname === href
173|173|                        : href === "/projects"
174|174|                          ? pathname === href
175|175|                          : pathname === href ||
176|176|                            pathname.startsWith(href + "/");
177|177|                return (
178|178|                    <div key={href} className="py-0.5 px-2.5">
179|179|                        <button
180|180|                            onClick={() => router.push(href)}
181|181|                            title={!isOpen ? label : ""}
182|182|                            className={cn(
183|183|                                "w-full h-9 flex items-center gap-3 px-2.5 py-2 rounded-md transition-colors text-left",
184|184|                                isActive
185|185|                                    ? "bg-gray-200/60 text-gray-900"
186|186|                                    : "text-gray-700 hover:bg-gray-100",
187|187|                                !isOpen ? "hidden md:flex" : "flex",
188|188|                            )}
189|189|                        >
190|190|                            <Icon
191|191|                                className={`h-4 w-4 flex-shrink-0 ${
192|192|                                    isActive ? "text-gray-900" : "text-black"
193|193|                                }`}
194|194|                            />
195|195|                            {isOpen && (
196|196|                                <span
197|197|                                    className={`text-sm font-medium ${
198|198|                                        shouldAnimate ? "sidebar-fade-in-2" : ""
199|199|                                    }`}
200|200|                                >
201|201|                                    {label}
202|202|                                </span>
203|203|                            )}
204|204|                        </button>
205|205|                    </div>
206|206|                );
207|207|            })}
208|208|
209|209|            {isOpen && (
210|210|                <div className="mt-4 flex-1 min-h-0 flex flex-col gap-4">
211|211|                    {/* Recent Projects */}
212|212|                    <div>
213|213|                        <button
214|214|                            onClick={() => setProjectsCollapsed((v) => !v)}
215|215|                            className={`mb-2 flex w-full items-center justify-between px-5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 ${
216|216|                                shouldAnimate ? "sidebar-fade-in" : ""
217|217|                            }`}
218|218|                        >
219|219|                            <span>Recent Projects</span>
220|220|                            <ChevronDown
221|221|                                className={`h-3.5 w-3.5 transition-transform ${
222|222|                                    projectsCollapsed ? "-rotate-90" : ""
223|223|                                }`}
224|224|                            />
225|225|                        </button>
226|226|                        {!projectsCollapsed && (
227|227|                            <>
228|228|                                {!recentProjects ? (
229|229|                                    <div className="space-y-1 px-2.5">
230|230|                                        {[50, 65, 45].map((w, i) => (
231|231|                                            <div
232|232|                                                key={i}
233|233|                                                className="h-9 flex items-center px-3 rounded-md"
234|234|                                            >
235|235|                                                <div
236|236|                                                    className="h-3 bg-gray-200 rounded animate-pulse"
237|237|                                                    style={{ width: `${w}%` }}
238|238|                                                />
239|239|                                            </div>
240|240|                                        ))}
241|241|                                    </div>
242|242|                                ) : recentProjects.length === 0 ? (
243|243|                                    <div
244|244|                                        className={`px-5 py-2 text-xs text-gray-500 ${
245|245|                                            shouldAnimate
246|246|                                                ? "sidebar-fade-in-2"
247|247|                                                : ""
248|248|                                        }`}
249|249|                                    >
250|250|                                        No projects yet
251|251|                                    </div>
252|252|                                ) : (
253|253|                                    <div
254|254|                                        className={`space-y-1 px-2.5 ${
255|255|                                            shouldAnimate
256|256|                                                ? "sidebar-fade-in-2"
257|257|                                                : ""
258|258|                                        }`}
259|259|                                    >
260|260|                                        {recentProjects.map((project) => {
261|261|                                            const isActive =
262|262|                                                pathname ===
263|263|                                                    `/projects/${project.id}` ||
264|264|                                                pathname.startsWith(
265|265|                                                    `/projects/${project.id}/`,
266|266|                                                );
267|267|                                            return (
268|268|                                                <button
269|269|                                                    key={project.id}
270|270|                                                    onClick={() =>
271|271|                                                        router.push(
272|272|                                                            `/projects/${project.id}`,
273|273|                                                        )
274|274|                                                    }
275|275|                                                    title={project.name}
276|276|                                                    className={cn(
277|277|                                                        "flex h-9 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
278|278|                                                        isActive
279|279|                                                            ? "bg-gray-200/60 text-gray-900"
280|280|                                                            : "text-gray-700 hover:bg-gray-100",
281|281|                                                    )}
282|282|                                                >
283|283|                                                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-gray-500" />
284|284|                                                    <span className="min-w-0 flex-1 truncate">
285|285|                                                        {project.name}
286|286|                                                    </span>
287|287|                                                </button>
288|288|                                            );
289|289|                                        })}
290|290|                                    </div>
291|291|                                )}
292|292|                            </>
293|293|                        )}
294|294|                    </div>
295|295|
296|296|                    {/* Assistant History */}
297|297|                    <div className="flex min-h-0 flex-1 flex-col">
298|298|                        <button
299|299|                            onClick={() => setHistoryCollapsed((v) => !v)}
300|300|                            className={`mb-2 flex w-full items-center justify-between px-5 text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 ${
301|301|                                shouldAnimate ? "sidebar-fade-in" : ""
302|302|                            }`}
303|303|                        >
304|304|                            <span>Assistant History</span>
305|305|                            <ChevronDown
306|306|                                className={`h-3.5 w-3.5 transition-transform ${
307|307|                                    historyCollapsed ? "-rotate-90" : ""
308|308|                                }`}
309|309|                            />
310|310|                        </button>
311|311|                        <div
312|312|                            className={`overflow-y-auto flex-1 ${
313|313|                                historyCollapsed ? "hidden" : ""
314|314|                            }`}
315|315|                        >
316|316|                            {!chats ? (
317|317|                                <div className="space-y-1 px-2.5">
318|318|                                    {[40, 60, 50, 70, 45].map((w, i) => (
319|319|                                        <div
320|320|                                            key={i}
321|321|                                            className="h-9 flex items-center px-3 rounded-md"
322|322|                                        >
323|323|                                            <div
324|324|                                                className="h-3 bg-gray-200 rounded animate-pulse"
325|325|                                                style={{ width: `${w}%` }}
326|326|                                            />
327|327|                                        </div>
328|328|                                    ))}
329|329|                                </div>
330|330|                            ) : chats.length === 0 ? (
331|331|                                <div
332|332|                                    className={`text-xs text-gray-500 py-2 px-5 ${
333|333|                                        shouldAnimate ? "sidebar-fade-in-2" : ""
334|334|                                    }`}
335|335|                                >
336|336|                                    No chats yet
337|337|                                </div>
338|338|                            ) : (
339|339|                                <>
340|340|                                    <div
341|341|                                        className={`space-y-1 px-2.5 ${
342|342|                                            shouldAnimate
343|343|                                                ? "sidebar-fade-in-2"
344|344|                                                : ""
345|345|                                        }`}
346|346|                                    >
347|347|                                        {chats.map((chat) => (
348|348|                                            <SidebarChatItem
349|349|                                                key={chat.id}
350|350|                                                chat={chat}
351|351|                                                isActive={
352|352|                                                    routeChatId === chat.id
353|353|                                                }
354|354|                                                projectName={
355|355|                                                    chat.project_id
356|356|                                                        ? projectNames[
357|357|                                                              chat.project_id
358|358|                                                          ]
359|359|                                                        : undefined
360|360|                                                }
361|361|                                                onSelect={() => {
362|362|                                                    setCurrentChatId(chat.id);
363|363|                                                    router.push(
364|364|                                                        chat.project_id
365|365|                                                            ? `/projects/${chat.project_id}/assistant/chat/${chat.id}`
366|366|                                                            : `/assistant/chat/${chat.id}`,
367|367|                                                    );
368|368|                                                }}
369|369|                                            />
370|370|                                        ))}
371|371|                                    </div>
372|372|                                    {hasMoreChats && (
373|373|                                        <div className="px-2.5 pt-1">
374|374|                                            <button
375|375|                                                onClick={loadMoreChats}
376|376|                                                className={cn(
377|377|                                                    "flex h-8 w-full items-center justify-start rounded-md px-3 text-left text-xs font-medium text-gray-500 transition-colors hover:text-gray-700",
378|378|                                                    "hover:bg-gray-100",
379|379|                                                )}
380|380|                                            >
381|381|                                                Load more
382|382|                                            </button>
383|383|                                        </div>
384|384|                                    )}
385|385|                                </>
386|386|                            )}
387|387|                        </div>
388|388|                    </div>
389|389|                </div>
390|390|            )}
391|391|
392|392|            {/* User Profile */}
393|393|            <div className="mt-auto p-1">
394|394|                {user && (
395|395|                    <div className="relative">
396|396|                        <button
397|397|                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
398|398|                            className={cn(
399|399|                                "flex items-center transition-colors w-full px-2.5 py-3 border-t",
400|400|                                "rounded-xl border-white/60",
401|401|                                !isOpen ? "hidden md:flex" : "",
402|402|                                pathname === "/account" || isDropdownOpen
403|403|                                    ? "bg-gray-200/60"
404|404|                                    : "hover:bg-gray-100",
405|405|                            )}
406|406|                            title={!isOpen ? user.email : undefined}
407|407|                        >
408|408|                            <div className="h-6.5 w-6.5 flex-shrink-0 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-medium font-serif">
409|409|                                {getUserInitials(user.email)}
410|410|                            </div>
411|411|                            {isOpen && (
412|412|                                <div
413|413|                                    className={`text-left flex-1 min-w-0 pl-3 flex items-center justify-between gap-2 ${
414|414|                                        shouldAnimate ? "sidebar-fade-in-2" : ""
415|415|                                    }`}
416|416|                                >
417|417|                                    <div className="flex flex-col gap-0.5 min-w-0">
418|418|                                        <div className="text-sm font-medium text-gray-900 leading-none">
419|419|                                            {getDisplayName()}
420|420|                                        </div>
421|421|                                        <div className="text-[12px] text-gray-500 leading-none">
422|422|                                            {getUserTier()}
423|423|                                        </div>
424|424|                                    </div>
425|425|                                    <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
426|426|                                </div>
427|427|                            )}
428|428|                        </button>
429|429|
430|430|                        {isDropdownOpen && (
431|431|                            <div
432|432|                                className={cn(
433|433|                                    "absolute bottom-full left-0 right-0 z-50 mb-1 p-1 whitespace-nowrap",
434|434|                                    "bg-white/80 rounded-xl shadow-[0_6px_17px_rgba(15,23,42,0.1)] border border-white/70 backdrop-blur-xl",
435|435|                                )}
436|436|                            >
437|437|                                <button
438|438|                                    onClick={() => {
439|439|                                        router.push("/account");
440|440|                                        setIsDropdownOpen(false);
441|441|                                    }}
442|442|                                    className={cn(
443|443|                                        "w-full px-4 py-2 text-left text-sm text-gray-700 flex items-center gap-2 rounded-md",
444|444|                                        "hover:bg-white/70",
445|445|                                    )}
446|446|                                >
447|447|                                    <User className="h-4 w-4" />
448|448|                                    Account Settings
449|449|                                </button>
450|450|                            </div>
451|451|                        )}
452|452|                    </div>
453|453|                )}
454|454|            </div>
455|455|        </div>
456|456|    );
457|457|}
458|458|