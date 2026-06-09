1|"use client";
2|
3|import { useState } from "react";
4|import { ChevronDown, Check, AlertCircle } from "lucide-react";
5|import {
6|    DropdownMenu,
7|    DropdownMenuContent,
8|    DropdownMenuItem,
9|    DropdownMenuLabel,
10|    DropdownMenuSeparator,
11|    DropdownMenuTrigger,
12|} from "@/components/ui/dropdown-menu";
13|import { isModelAvailable } from "@/app/lib/modelAvailability";
14|import type { ApiKeyState } from "@/app/lib/misuApi";
15|
16|export interface ModelOption {
17|    id: string;
18|    label: string;
19|    group: "Anthropic" | "Google" | "OpenAI";
20|}
21|
22|export const MODELS: ModelOption[] = [
23|    { id: "claude-opus-4-7", label: "Claude Opus 4.7", group: "Anthropic" },
24|    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", group: "Anthropic" },
25|    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", group: "Google" },
26|    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", group: "Google" },
27|    { id: "gpt-5.5", label: "GPT-5.5", group: "OpenAI" },
28|    { id: "gpt-5.4", label: "GPT-5.4", group: "OpenAI" },
29|];
30|
31|export const SETTINGS_MODELS: ModelOption[] = [
32|    ...MODELS,
33|    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", group: "Anthropic" },
34|    {
35|        id: "gemini-3.1-flash-lite-preview",
36|        label: "Gemini 3.1 Flash Lite",
37|        group: "Google",
38|    },
39|    { id: "gpt-5.4-lite", label: "GPT-5.4 Lite", group: "OpenAI" },
40|];
41|
42|export const DEFAULT_MODEL_ID = "gemini-3-flash-preview";
43|
44|export const ALLOWED_MODEL_IDS = new Set(MODELS.map((m) => m.id));
45|
46|const GROUP_ORDER: ModelOption["group"][] = ["Anthropic", "Google", "OpenAI"];
47|
48|interface Props {
49|    value: string;
50|    onChange: (id: string) => void;
51|    apiKeys?: ApiKeyState;
52|}
53|
54|export function ModelToggle({ value, onChange, apiKeys }: Props) {
55|    const [isOpen, setIsOpen] = useState(false);
56|    const selected = MODELS.find((m) => m.id === value);
57|    const selectedLabel = selected?.label ?? "Model";
58|    const selectedAvailable = apiKeys
59|        ? isModelAvailable(value, apiKeys)
60|        : true;
61|
62|    return (
63|        <DropdownMenu onOpenChange={setIsOpen}>
64|            <DropdownMenuTrigger asChild>
65|                <button
66|                    type="button"
67|                    className={`flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm transition-colors cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${isOpen ? "bg-gray-100 text-gray-700" : ""}`}
68|                    title={
69|                        !selectedAvailable
70|                            ? "API key missing for selected model"
71|                            : "Choose model"
72|                    }
73|                >
74|                    {!selectedAvailable && (
75|                        <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
76|                    )}
77|                    <span className="max-w-[140px] truncate">{selectedLabel}</span>
78|                    <ChevronDown
79|                        className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
80|                    />
81|                </button>
82|            </DropdownMenuTrigger>
83|            <DropdownMenuContent className="w-56 z-50" side="top" align="end">
84|                {GROUP_ORDER.map((group, gi) => {
85|                    const items = MODELS.filter((m) => m.group === group);
86|                    if (items.length === 0) return null;
87|                    return (
88|                        <div key={group}>
89|                            {gi > 0 && <DropdownMenuSeparator />}
90|                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400">
91|                                {group}
92|                            </DropdownMenuLabel>
93|                            {items.map((m) => {
94|                                const available = apiKeys
95|                                    ? isModelAvailable(m.id, apiKeys)
96|                                    : true;
97|                                return (
98|                                    <DropdownMenuItem
99|                                        key={m.id}
100|                                        className="cursor-pointer"
101|                                        onSelect={() => onChange(m.id)}
102|                                    >
103|                                        <span
104|                                            className={`flex-1 ${available ? "" : "text-gray-400"}`}
105|                                        >
106|                                            {m.label}
107|                                        </span>
108|                                        {!available && (
109|                                            <AlertCircle
110|                                                className="h-3.5 w-3.5 text-red-500 ml-1"
111|                                                aria-label="API key missing"
112|                                            />
113|                                        )}
114|                                        {m.id === value && available && (
115|                                            <Check className="h-3.5 w-3.5 text-gray-600 ml-1" />
116|                                        )}
117|                                    </DropdownMenuItem>
118|                                );
119|                            })}
120|                        </div>
121|                    );
122|                })}
123|            </DropdownMenuContent>
124|        </DropdownMenu>
125|    );
126|}
127|