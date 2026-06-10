"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    AlertCircle,
    Check,
    Download,
    Loader2,
    Pencil,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { ConfirmPopup } from "@/app/components/shared/ConfirmPopup";
import { DocView } from "@/app/components/shared/DocView";
import { WarningPopup } from "@/app/components/shared/WarningPopup";
import type { Document } from "@/app/components/shared/types";
import type { DocumentVersion } from "@/app/lib/misuApi";
import { cn } from "@/lib/utils";
import { formatBytes, formatDate } from "./ProjectPageParts";

const MIN_DOC_COLUMN_WIDTH = 420;
const DEFAULT_DOC_COLUMN_WIDTH = 620;
const MIN_DATA_COLUMN_WIDTH = 280;
const DEFAULT_DATA_COLUMN_WIDTH = 340;
const RESIZER_WIDTH = 6;
const MAX_PANEL_WIDTH = 1180;
const primaryGlassButtonClass =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-gray-700/40 bg-gray-950/88 px-3 text-xs font-medium text-white shadow-[0_3px_9px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-4px_9px_rgba(15,23,42,0.2)] backdrop-blur-xl transition-all hover:bg-gray-900/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";
const dangerGlassButtonClass =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-red-700/35 bg-red-600/90 px-3 text-xs font-medium text-white shadow-[0_3px_9px_rgba(127,29,29,0.16),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-4px_9px_rgba(127,29,29,0.18)] backdrop-blur-xl transition-all hover:bg-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

interface DocumentSidePanelProps {
    doc: Document | null;
    versionId?: string | null;
    currentVersionId?: string | null;
    versions: DocumentVersion[];
    versionsLoading: boolean;
    onClose: () => void;
    onLoadVersions: (docId: string) => Promise<void> | void;
    onSelectVersion: (versionId: string, label: string) => void;
    onDownloadDocument: (docId: string) => Promise<void> | void;
    onDownloadVersion: (
        docId: string,
        versionId: string,
        filename: string,
    ) => Promise<void> | void;
    onRenameVersion: (
        docId: string,
        versionId: string,
        filename: string,
    ) => Promise<void> | void;
    onDeleteVersion: (docId: string, versionId: string) => Promise<void> | void;
    onUploadNewVersion: (
        doc: Document,
        file: File,
        filename: string,
    ) => Promise<void>;
    onDelete: (doc: Document) => Promise<void> | void;
}

export function DocumentSidePanel({
    doc,
    versionId,
    currentVersionId,
    versions,
    versionsLoading,
    onClose,
    onLoadVersions,
    onSelectVersion,
    onDownloadVersion,
    onRenameVersion,
    onDeleteVersion,
    onUploadNewVersion,
    onDelete,
}: DocumentSidePanelProps) {
    const [mounted, setMounted] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [extensionWarningOpen, setExtensionWarningOpen] = useState(false);
    const [deletingVersionId, setDeletingVersionId] = useState<string | null>(
        null,
    );
    const [deletingDocument, setDeletingDocument] = useState(false);
    const [confirmDeleteDocumentOpen, setConfirmDeleteDocumentOpen] =
        useState(false);
    const [deleteDocumentStatus, setDeleteDocumentStatus] = useState<
        "idle" | "deleting" | "deleted"
    >("idle");
    const [dataColumnWidth, setDataColumnWidth] = useState(
        DEFAULT_DATA_COLUMN_WIDTH,
    );
    const [panelWidth, setPanelWidth] = useState(
        DEFAULT_DOC_COLUMN_WIDTH + RESIZER_WIDTH + DEFAULT_DATA_COLUMN_WIDTH,
    );
    const panelRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragStartX = useRef(0);
    const dragStartDataWidth = useRef(DEFAULT_DATA_COLUMN_WIDTH);
    const dragStartPanelWidth = useRef(
        DEFAULT_DOC_COLUMN_WIDTH + RESIZER_WIDTH + DEFAULT_DATA_COLUMN_WIDTH,
    );

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!mounted) return;
        function handleWindowResize() {
            setPanelWidth((width) => clampPanelWidth(width, dataColumnWidth));
        }
        handleWindowResize();
        window.addEventListener("resize", handleWindowResize);
        return () => window.removeEventListener("resize", handleWindowResize);
    }, [dataColumnWidth, mounted]);

    useEffect(() => {
        if (!doc) return;
        setUploadError(null);
        void onLoadVersions(doc.id);
    }, [doc?.id]);

    useEffect(() => {
        setEditingName(false);
        setNameDraft("");
        setNameError(null);
        setExtensionWarningOpen(false);
    }, [doc?.id, versionId, currentVersionId]);

    if (!mounted || !doc) return null;

    const activeDoc = doc;
    const documentId = activeDoc.id;
    const accept = doc.file_type === "pdf" ? ".pdf" : ".docx,.doc";
    const orderedVersions = [...versions].reverse();
    const selectedVersion =
        versions.find((version) => version.id === versionId) ??
        versions.find((version) => version.id === currentVersionId) ??
        orderedVersions[0] ??
        null;
    const selectedVersionId = selectedVersion?.id ?? versionId ?? null;
    const selectedFilename = selectedVersion?.filename?.trim() || doc.filename;
    const selectedFileType =
        selectedVersion != null
            ? fileTypeForVersion(selectedVersion, doc.file_type)
            : doc.file_type;
    const selectedSizeBytes =
        selectedVersion?.size_bytes === undefined
            ? doc.size_bytes
            : selectedVersion.size_bytes;
    const selectedPageCount =
        selectedVersion?.page_count === undefined
            ? doc.page_count
            : selectedVersion.page_count;
    const selectedVersionNumber =
        selectedVersion?.version_number ?? doc.active_version_number ?? null;
    const selectedUploadedAt = selectedVersion?.created_at ?? doc.created_at;
    const selectedExtension = filenameExtension(selectedFilename);

    async function handleSaveName() {
        if (!selectedVersionId) return;
        const trimmed = nameDraft.trim();
        if (!trimmed) {
            setNameError("Name is required.");
            return;
        }
        if (hasExtensionChange(selectedFilename, trimmed)) {
            setExtensionWarningOpen(true);
            return;
        }
        if (trimmed === selectedFilename) {
            setEditingName(false);
            setNameError(null);
            return;
        }

        setSavingName(true);
        setNameError(null);
        try {
            await onRenameVersion(documentId, selectedVersionId, trimmed);
            setEditingName(false);
        } catch (err) {
            console.error("rename version failed", err);
            setNameError("Could not save name.");
        } finally {
            setSavingName(false);
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null;
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (!file || !doc) return;
        setUploadError(null);
        setUploading(true);
        try {
            await onUploadNewVersion(doc, file, file.name);
        } catch (err) {
            console.error("upload new version failed", err);
            setUploadError("Could not upload the new version.");
        } finally {
            setUploading(false);
        }
    }

    async function handleDeleteVersion(versionIdToDelete: string) {
        setDeletingVersionId(versionIdToDelete);
        try {
            await onDeleteVersion(documentId, versionIdToDelete);
        } catch (err) {
            console.error("delete version failed", err);
        } finally {
            setDeletingVersionId(null);
        }
    }

    async function handleDeleteDocument() {
        if (deleteDocumentStatus === "deleting") return;
        setDeleteDocumentStatus("deleting");
        setDeletingDocument(true);
        try {
            await onDelete(activeDoc);
            setDeleteDocumentStatus("deleted");
            window.setTimeout(() => {
                setConfirmDeleteDocumentOpen(false);
                setDeleteDocumentStatus("idle");
                onClose();
            }, 650);
        } catch (err) {
            console.error("delete document failed", err);
            setDeleteDocumentStatus("idle");
        } finally {
            setDeletingDocument(false);
        }
    }

    function requestDeleteDocument() {
        if (versions.length > 1) {
            setDeleteDocumentStatus("idle");
            setConfirmDeleteDocumentOpen(true);
            return;
        }
        void handleDeleteDocument();
    }

    function handleResizeMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        dragStartX.current = e.clientX;
        dragStartDataWidth.current = dataColumnWidth;

        const handleMouseMove = (event: MouseEvent) => {
            const panelWidth =
                panelRef.current?.clientWidth ?? window.innerWidth;
            const maxDataWidth = Math.max(
                MIN_DATA_COLUMN_WIDTH,
                panelWidth - MIN_DOC_COLUMN_WIDTH - RESIZER_WIDTH,
            );
            const nextWidth =
                dragStartDataWidth.current +
                (dragStartX.current - event.clientX);
            setDataColumnWidth(
                Math.min(
                    maxDataWidth,
                    Math.max(MIN_DATA_COLUMN_WIDTH, nextWidth),
                ),
            );
        };

        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }

    function handlePanelResizeMouseDown(e: React.MouseEvent<HTMLDivElement>) {
        e.preventDefault();
        dragStartX.current = e.clientX;
        dragStartPanelWidth.current = panelWidth;

        const handleMouseMove = (event: MouseEvent) => {
            const nextWidth =
                dragStartPanelWidth.current +
                (dragStartX.current - event.clientX);
            setPanelWidth(clampPanelWidth(nextWidth, dataColumnWidth));
        };

        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }

    return createPortal(
        <div
            ref={panelRef}
            className={cn(
                "fixed z-[190] flex flex-col",
                "inset-y-3 right-3 rounded-2xl border border-white/70 bg-white/72 shadow-[0_8px_24px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-10px_24px_rgba(255,255,255,0.18),inset_1px_0_0_rgba(255,255,255,0.5)] backdrop-blur-2xl overflow-hidden",
            )}
            style={{ width: panelWidth }}
        >
            <div
                onMouseDown={handlePanelResizeMouseDown}
                className="absolute inset-y-0 left-0 z-20 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-blue-400/60"
                title="Resize document view"
            />
            <div
                className={cn(
                    "flex h-11 shrink-0 items-center justify-between px-4",
                    "border-b border-white/60 bg-white/35",
                )}
            >
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-700">
                        {selectedFilename}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-7 w-7 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                        title="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div
                className="grid min-h-0 flex-1"
                style={{
                    gridTemplateColumns: `minmax(${MIN_DOC_COLUMN_WIDTH}px, 1fr) ${RESIZER_WIDTH}px ${dataColumnWidth}px`,
                }}
            >
                <section
                    className={cn(
                        "flex min-h-0 min-w-0 pb-3 pl-3",
                        "bg-white/20",
                    )}
                >
                    <div
                        className={cn(
                            "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                            "rounded-xl border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl",
                        )}
                    >
                        <DocView
                            key={selectedVersionId ?? "current"}
                            doc={{
                                document_id: doc.id,
                                version_id: selectedVersionId,
                            }}
                        />
                    </div>
                </section>

                <div
                    onMouseDown={handleResizeMouseDown}
                    className={cn(
                        "relative cursor-col-resize transition-colors",
                        "bg-white/25 hover:bg-blue-400/60",
                    )}
                    title="Resize document panel"
                />

                <aside
                    className={cn(
                        "mb-3 ml-2 mr-3 flex min-h-0 flex-col overflow-hidden rounded-xl",
                        "border border-white/70 bg-white/55 shadow-[0_3px_9px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-4px_9px_rgba(255,255,255,0.08)] backdrop-blur-2xl",
                    )}
                >
                    <div
                        className={cn(
                            "shrink-0 px-4 py-3",
                            "border-b border-white/60",
                        )}
                    >
                        <div className="mb-4">
                            <div className="mb-3 text-xs font-medium text-gray-900">
                                Name
                            </div>
                            {editingName ? (
                                <div className="space-y-1.5">
                                    <div className="flex min-h-6 items-center gap-2">
                                        <input
                                            value={nameDraft}
                                            onChange={(e) => {
                                                setNameDraft(e.target.value);
                                                setNameError(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    void handleSaveName();
                                                }
                                                if (e.key === "Escape") {
                                                    setEditingName(false);
                                                    setNameError(null);
                                                }
                                            }}
                                            className="h-6 min-w-0 flex-1 border-0 border-b border-gray-300 bg-transparent px-0 text-xs leading-6 text-gray-900 outline-none transition-colors focus:border-gray-500"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                void handleSaveName()
                                            }
                                            disabled={savingName}
                                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/65 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                                            title="Save name"
                                        >
                                            {savingName ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Check className="h-3.5 w-3.5" />
                                            )}
                                        </button>
                                    </div>
                                    {nameError && (
                                        <div className="text-xs text-red-600">
                                            {nameError}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex min-h-6 items-center gap-2">
                                    <div className="min-w-0 flex-1 truncate text-xs leading-6 text-gray-800">
                                        {selectedFilename}
                                    </div>
                                    {selectedVersionId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNameDraft(selectedFilename);
                                                setEditingName(true);
                                                setNameError(null);
                                            }}
                                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/65 hover:text-gray-900"
                                            title="Edit name"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mb-3 text-xs font-medium text-gray-900">
                            Document Data
                        </div>
                        <div className="rounded-xl bg-gray-100/70 px-3 py-3">
                            <div className="space-y-1.5">
                                <DataRow
                                    label="Type"
                                    value={selectedFileType ?? "—"}
                                />
                                <DataRow
                                    label="Size"
                                    value={
                                        selectedSizeBytes != null
                                            ? formatBytes(selectedSizeBytes)
                                            : "—"
                                    }
                                />
                                <DataRow
                                    label="Version"
                                    value={
                                        selectedVersionNumber != null
                                            ? String(selectedVersionNumber)
                                            : "—"
                                    }
                                />
                                <DataRow
                                    label="Uploaded"
                                    value={
                                        selectedUploadedAt
                                            ? formatDate(selectedUploadedAt)
                                            : "—"
                                    }
                                />
