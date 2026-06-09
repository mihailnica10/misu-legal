1|"use client";
2|
3|import { useEffect, useRef, useState } from "react";
4|import {
5|    Download,
6|    Eye,
7|    EyeOff,
8|    FolderMinus,
9|    FolderPlus,
10|    Hash,
11|    History,
12|    Pencil,
13|    Trash2,
14|    Upload,
15|} from "lucide-react";
16|
17|const CLOSE_ROW_ACTIONS_EVENT = "misu:close-row-actions";
18|
19|export function closeRowActionMenus() {
20|    document.dispatchEvent(new Event(CLOSE_ROW_ACTIONS_EVENT));
21|}
22|
23|interface Props {
24|    onDelete?: () => void;
25|    onHide?: () => void;
26|    onUnhide?: () => void;
27|    onDownload?: () => void;
28|    onRemoveFromFolder?: () => void;
29|    onShowAllVersions?: () => void;
30|    onUploadNewVersion?: () => void;
31|    onNewSubfolder?: () => void;
32|    deleting?: boolean;
33|    onRename?: () => void;
34|    onUpdateCmNumber?: () => void;
35|    newSubfolderLabel?: string;
36|    renameLabel?: string;
37|    deleteLabel?: string;
38|}
39|
40|export function RowActionMenuItems({
41|    onDelete,
42|    onHide,
43|    onUnhide,
44|    onDownload,
45|    onRemoveFromFolder,
46|    onShowAllVersions,
47|    onUploadNewVersion,
48|    onNewSubfolder,
49|    deleting,
50|    onRename,
51|    onUpdateCmNumber,
52|    newSubfolderLabel = "New subfolder",
53|    renameLabel = "Rename",
54|    deleteLabel = "Delete",
55|    onClose,
56|}: Props & { onClose: () => void }) {
57|    return (
58|        <>
59|            {onNewSubfolder && (
60|                <button
61|                    onClick={() => { onClose(); onNewSubfolder(); }}
62|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left text-gray-600 hover:bg-gray-50 transition-colors"
63|                >
64|                    <FolderPlus className="h-3.5 w-3.5 shrink-0" />
65|                    {newSubfolderLabel}
66|                </button>
67|            )}
68|            {onRename && (
69|                <button
70|                    onClick={() => { onClose(); onRename(); }}
71|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
72|                >
73|                    <Pencil className="h-3.5 w-3.5" />
74|                    {renameLabel}
75|                </button>
76|            )}
77|            {onUpdateCmNumber && (
78|                <button
79|                    onClick={() => { onClose(); onUpdateCmNumber(); }}
80|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
81|                >
82|                    <Hash className="h-3.5 w-3.5" />
83|                    Edit CM No.
84|                </button>
85|            )}
86|            {onDownload && (
87|                <button
88|                    onClick={() => { onClose(); onDownload(); }}
89|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
90|                >
91|                    <Download className="h-3.5 w-3.5" />
92|                    Download
93|                </button>
94|            )}
95|            {onShowAllVersions && (
96|                <button
97|                    onClick={() => { onClose(); onShowAllVersions(); }}
98|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left text-gray-600 hover:bg-gray-50 transition-colors"
99|                >
100|                    <History className="h-3.5 w-3.5 shrink-0" />
101|                    Show all versions
102|                </button>
103|            )}
104|            {onUploadNewVersion && (
105|                <button
106|                    onClick={() => { onClose(); onUploadNewVersion(); }}
107|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left text-gray-600 hover:bg-gray-50 transition-colors"
108|                >
109|                    <Upload className="h-3.5 w-3.5 shrink-0" />
110|                    Upload new version
111|                </button>
112|            )}
113|            {onRemoveFromFolder && (
114|                <button
115|                    onClick={() => { onClose(); onRemoveFromFolder(); }}
116|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left text-gray-600 hover:bg-gray-50 transition-colors"
117|                >
118|                    <FolderMinus className="h-3.5 w-3.5 shrink-0" />
119|                    Remove from subfolder
120|                </button>
121|            )}
122|            {onUnhide && (
123|                <button
124|                    onClick={() => { onClose(); onUnhide(); }}
125|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
126|                >
127|                    <Eye className="h-3.5 w-3.5" />
128|                    Unhide
129|                </button>
130|            )}
131|            {onHide && (
132|                <button
133|                    onClick={() => { onClose(); onHide(); }}
134|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
135|                >
136|                    <EyeOff className="h-3.5 w-3.5" />
137|                    Hide
138|                </button>
139|            )}
140|            {onDelete && (
141|                <button
142|                    onClick={() => { onClose(); onDelete(); }}
143|                    disabled={deleting}
144|                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
145|                >
146|                    <Trash2 className="h-3.5 w-3.5" />
147|                    {deleteLabel}
148|                </button>
149|            )}
150|        </>
151|    );
152|}
153|
154|export function RowActions(props: Props) {
155|    const [open, setOpen] = useState(false);
156|    const [coords, setCoords] = useState({ top: 0, right: 0 });
157|    const btnRef = useRef<HTMLButtonElement>(null);
158|
159|    useEffect(() => {
160|        if (!open) return;
161|        function handleClick() {
162|            setOpen(false);
163|        }
164|        document.addEventListener("click", handleClick);
165|        return () => document.removeEventListener("click", handleClick);
166|    }, [open]);
167|
168|    useEffect(() => {
169|        function handleCloseRowActions() {
170|            setOpen(false);
171|        }
172|        document.addEventListener(CLOSE_ROW_ACTIONS_EVENT, handleCloseRowActions);
173|        return () =>
174|            document.removeEventListener(
175|                CLOSE_ROW_ACTIONS_EVENT,
176|                handleCloseRowActions,
177|            );
178|    }, []);
179|
180|    function handleToggle(e: React.MouseEvent) {
181|        e.stopPropagation();
182|        if (open) {
183|            setOpen(false);
184|            return;
185|        }
186|        closeRowActionMenus();
187|        if (btnRef.current) {
188|            const rect = btnRef.current.getBoundingClientRect();
189|            setCoords({
190|                top: rect.bottom + 4,
191|                right: window.innerWidth - rect.right,
192|            });
193|        }
194|        setOpen(true);
195|    }
196|
197|    return (
198|        <>
199|            <button
200|                ref={btnRef}
201|                onClick={handleToggle}
202|                className="flex items-center justify-center w-6 h-6 rounded text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors leading-none"
203|            >
204|                <span className="tracking-widest text-xs">···</span>
205|            </button>
206|
207|            {open && (
208|                <div
209|                    style={{ position: "fixed", top: coords.top, right: coords.right }}
210|                    className="z-[120] w-48 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden"
211|                    onClick={(e) => e.stopPropagation()}
212|                >
213|                    <RowActionMenuItems
214|                        {...props}
215|                        onClose={() => setOpen(false)}
216|                    />
217|                </div>
218|            )}
219|        </>
220|    );
221|}
222|