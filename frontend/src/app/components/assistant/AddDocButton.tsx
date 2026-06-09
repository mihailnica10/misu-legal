1|"use client";
2|
3|import { useRef, useState } from "react";
4|import { PlusIcon, Upload, LayoutGridIcon, Loader2Icon } from "lucide-react";
5|import {
6|    DropdownMenu,
7|    DropdownMenuContent,
8|    DropdownMenuItem,
9|    DropdownMenuTrigger,
10|} from "@/components/ui/dropdown-menu";
11|import { uploadStandaloneDocument } from "@/app/lib/misuApi";
12|import type { Document } from "../shared/types";
13|
14|interface Props {
15|    onSelectDoc: (doc: Document) => void;
16|    onBrowseAll: () => void;
17|    selectedDocIds?: string[];
18|    hideLabel?: boolean;
19|}
20|
21|export function AddDocButton({
22|    onSelectDoc,
23|    onBrowseAll,
24|    selectedDocIds = [],
25|    hideLabel = false,
26|}: Props) {
27|    const [isOpen, setIsOpen] = useState(false);
28|    const [uploading, setUploading] = useState(false);
29|    const fileInputRef = useRef<HTMLInputElement>(null);
30|
31|    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
32|        const files = Array.from(e.target.files || []);
33|        if (!files.length) return;
34|        setUploading(true);
35|        try {
36|            const uploaded = await Promise.all(
37|                files.map((f) => uploadStandaloneDocument(f)),
38|            );
39|            uploaded.forEach((doc) => onSelectDoc(doc));
40|        } catch (err) {
41|            console.error("Upload failed:", err);
42|        } finally {
43|            setUploading(false);
44|            if (fileInputRef.current) fileInputRef.current.value = "";
45|        }
46|    };
47|
48|    return (
49|        <>
50|            <input
51|                ref={fileInputRef}
52|                type="file"
53|                accept=".pdf,.docx,.doc"
54|                multiple
55|                className="hidden"
56|                onChange={handleUpload}
57|            />
58|            <DropdownMenu onOpenChange={setIsOpen}>
59|                <DropdownMenuTrigger asChild>
60|                    <button
61|                        className={`flex items-center gap-1 px-2 h-8 rounded-lg text-sm transition-colors cursor-pointer ${
62|                            selectedDocIds.length > 0
63|                                ? "text-black hover:bg-gray-100"
64|                                : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
65|                        } ${isOpen ? "bg-gray-100" : ""}`}
66|                        title="Add documents"
67|                        aria-label="Add documents"
68|                    >
69|                        {selectedDocIds.length > 0 ? (
70|                            <span className="font-medium tabular-nums">{selectedDocIds.length}</span>
71|                        ) : (
72|                            <PlusIcon
73|                                className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-[135deg]" : ""}`}
74|                            />
75|                        )}
76|                        <span className={hideLabel ? "hidden" : "hidden sm:inline"}>
77|                            {selectedDocIds.length === 1
78|                                ? "Document"
79|                                : "Documents"}
80|                        </span>
81|                    </button>
82|                </DropdownMenuTrigger>
83|                <DropdownMenuContent
84|                    className="w-44 z-50"
85|                    side="bottom"
86|                    align="start"
87|                >
88|                    <DropdownMenuItem
89|                        className="cursor-pointer"
90|                        disabled={uploading}
91|                        onSelect={(e) => {
92|                            e.preventDefault();
93|                            fileInputRef.current?.click();
94|                        }}
95|                    >
96|                        {uploading ? (
97|                            <Loader2Icon className="h-4 w-4 mr-2 animate-spin text-gray-400" />
98|                        ) : (
99|                            <Upload className="h-4 w-4 mr-2 text-gray-500" />
100|                        )}
101|                        <span className="text-sm">
102|                            {uploading ? "Uploading…" : "Upload files"}
103|                        </span>
104|                    </DropdownMenuItem>
105|                    <DropdownMenuItem
106|                        className="cursor-pointer"
107|                        onClick={onBrowseAll}
108|                    >
109|                        <LayoutGridIcon className="h-4 w-4 mr-2 text-gray-500" />
110|                        <span className="text-sm">Browse all</span>
111|                    </DropdownMenuItem>
112|                </DropdownMenuContent>
113|            </DropdownMenu>
114|        </>
115|    );
116|}
117|