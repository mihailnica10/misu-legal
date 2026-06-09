1|"use client";
2|
3|import { useEffect, useLayoutEffect, useRef, useState } from "react";
4|import { useAuth } from "@/contexts/AuthContext";
5|import { useUserProfile } from "@/contexts/UserProfileContext";
6|import { MisuIcon } from "@/components/chat/misu-icon";
7|import { ChatInput } from "./ChatInput";
8|import { SelectAssistantProjectModal } from "./SelectAssistantProjectModal";
9|import type { Message } from "../shared/types";
10|
11|interface InitialViewProps {
12|    onSubmit: (message: Message) => void;
13|}
14|
15|const ICON_SIZE = 30;
16|const GAP = 12; // gap-4 = 1rem = 16px
17|
18|export function InitialView({ onSubmit }: InitialViewProps) {
19|    const { user } = useAuth();
20|    const { profile } = useUserProfile();
21|    const [loaded, setLoaded] = useState(false);
22|    const [projectModalOpen, setProjectModalOpen] = useState(false);
23|    const [iconOffset, setIconOffset] = useState(0);
24|    const [textOffset, setTextOffset] = useState(0);
25|    const textRef = useRef<HTMLHeadingElement>(null);
26|
27|    const username =
28|        profile?.displayName?.trim() || user?.email?.split("@")[0] || "there";
29|
30|    useLayoutEffect(() => {
31|        if (!profile || !textRef.current) return;
32|        const h1Width = textRef.current.offsetWidth;
33|        setIconOffset((h1Width + GAP) / 2);
34|        setTextOffset((ICON_SIZE + GAP) / 2);
35|    }, [profile]);
36|
37|    useEffect(() => {
38|        if (!iconOffset) return;
39|        const t = setTimeout(() => setLoaded(true), 100);
40|        return () => clearTimeout(t);
41|    }, [iconOffset]);
42|
43|    return (
44|        <div className="flex flex-col h-full w-full px-6">
45|            <div className="flex-1 flex flex-col items-center justify-center">
46|                <div className="flex-col items-center w-full max-w-4xl relative px-0 xl:px-8">
47|                    <div className="mb-10 relative flex items-center justify-center">
48|                        <div
49|                            className="absolute h-[30px] w-[30px] top-[-14px]"
50|                            style={{
51|                                left: "50%",
52|                                transform: loaded
53|                                    ? `translateX(calc(-50% - ${iconOffset}px))`
54|                                    : "translateX(-50%)",
55|                                transition:
56|                                    "transform 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
57|                            }}
58|                        >
59|                            <MisuIcon size={ICON_SIZE} />
60|                        </div>
61|                        <h1
62|                            ref={textRef}
63|                            className="absolute text-4xl font-serif font-light text-gray-900 whitespace-nowrap"
64|                            style={{
65|                                left: "50%",
66|                                transform: loaded
67|                                    ? `translateX(calc(-50% + ${textOffset}px))`
68|                                    : "translateX(-50%)",
69|                                opacity: loaded ? 1 : 0,
70|                                transition:
71|                                    "transform 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 800ms ease-in-out 300ms",
72|                            }}
73|                        >
74|                            Hi, {username}
75|                        </h1>
76|                    </div>
77|
78|                    <ChatInput
79|                        onSubmit={onSubmit}
80|                        onCancel={() => {}}
81|                        isLoading={false}
82|                        onProjectsClick={() => setProjectModalOpen(true)}
83|                    />
84|
85|                    <div className="text-center">
86|                        <p className="text-xs py-3 mb-3 text-gray-500">
87|                            AI can make mistakes. Answers are not legal advice.
88|                        </p>
89|                    </div>
90|                </div>
91|            </div>
92|
93|            <SelectAssistantProjectModal
94|                open={projectModalOpen}
95|                onClose={() => setProjectModalOpen(false)}
96|            />
97|        </div>
98|    );
99|}
100|