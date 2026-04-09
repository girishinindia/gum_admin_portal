"use client";
/* ================================================================
   Uploads Page — Image & Document upload with drag-drop, preview
   Uses Bunny CDN via /uploads/image and /uploads/document endpoints
   ================================================================ */
import { useState, useRef, useCallback } from "react";
import {
  uploadImage,
  uploadDocument,
  validateImageFile,
  validateDocumentFile,
  formatFileSize,
  getFileIcon,
  getFileColor,
  IMAGE_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  MAX_IMAGE_SIZE_MB,
  MAX_DOCUMENT_SIZE_MB,
  ALLOWED_IMAGE_TYPES,
  type UploadResult,
} from "@/services/uploadService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";

type UploadType = "image" | "document";

interface UploadEntry {
  id: string;
  file: File;
  type: UploadType;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  result?: UploadResult;
  error?: string;
}

function UploadsPage() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [activeTab, setActiveTab] = useState<UploadType>("image");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Upload a single file entry ────────────────────────────
  const startUpload = useCallback(async (entry: UploadEntry) => {
    setUploads((prev) =>
      prev.map((u) => u.id === entry.id ? { ...u, status: "uploading" as const, progress: 0 } : u)
    );

    try {
      const onProgress = (percent: number) => {
        setUploads((prev) =>
          prev.map((u) => u.id === entry.id ? { ...u, progress: percent } : u)
        );
      };

      const res = entry.type === "image"
        ? await uploadImage(entry.file, onProgress)
        : await uploadDocument(entry.file, onProgress);

      setUploads((prev) =>
        prev.map((u) => u.id === entry.id ? { ...u, status: "success" as const, progress: 100, result: res.data } : u)
      );
      toast.success("Upload complete", `${entry.file.name} uploaded successfully.`);
    } catch (err: unknown) {
      const msg = extractError(err);
      setUploads((prev) =>
        prev.map((u) => u.id === entry.id ? { ...u, status: "error" as const, error: msg } : u)
      );
      toast.error("Upload failed", msg);
    }
  }, []);

  // ─── File selection / drop ────────────────────────────────
  const handleFiles = useCallback((files: FileList | File[]) => {
    const newEntries: UploadEntry[] = [];

    Array.from(files).forEach((file) => {
      const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
      const type: UploadType = isImage ? "image" : "document";

      // Validate
      const error = type === "image" ? validateImageFile(file) : validateDocumentFile(file);

      newEntries.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        type,
        status: error ? "error" : "pending",
        progress: 0,
        error: error || undefined,
      });
    });

    setUploads((prev) => [...newEntries, ...prev]);

    // Auto-upload valid files
    newEntries.filter((e) => e.status === "pending").forEach((entry) => {
      startUpload(entry);
    });
  }, [startUpload]);

  const retryUpload = (entry: UploadEntry) => {
    setUploads((prev) =>
      prev.map((u) => u.id === entry.id ? { ...u, status: "pending" as const, error: undefined, progress: 0 } : u)
    );
    startUpload(entry);
  };

  const removeEntry = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== "success"));
  };

  // ─── Drag & Drop ──────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ""; // Reset so same file can be re-selected
    }
  };

  const acceptTypes = activeTab === "image"
    ? IMAGE_EXTENSIONS.map((e) => `.${e}`).join(",")
    : DOCUMENT_EXTENSIONS.map((e) => `.${e}`).join(",");

  const successUploads = uploads.filter((u) => u.status === "success");
  const activeUploads = uploads.filter((u) => u.status === "uploading" || u.status === "pending");

  // ─── Copy URL ─────────────────────────────────────────────
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Copied", "URL copied to clipboard.");
    }).catch(() => {
      toast.error("Failed to copy URL");
    });
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Uploads</h1>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Upload images and documents to the GrowUpMore CDN</p>
      </div>

      {/* Tab selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <TabButton active={activeTab === "image"} onClick={() => setActiveTab("image")} icon="fa-image" label="Images" />
        <TabButton active={activeTab === "document"} onClick={() => setActiveTab("document")} icon="fa-file-lines" label="Documents" />
      </div>

      {/* Drop Zone */}
      <div
        className="gum-card"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
        style={{
          marginBottom: 20, cursor: "pointer",
          border: `2px dashed ${dragOver ? "var(--gum-primary)" : "var(--gum-border)"}`,
          background: dragOver ? "var(--gum-primary-bg, #4A90D908)" : "transparent",
          transition: "all 0.2s",
          borderRadius: 12,
        }}
      >
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <i className={`fa-solid ${activeTab === "image" ? "fa-cloud-arrow-up" : "fa-file-arrow-up"}`}
            style={{ fontSize: 40, color: dragOver ? "var(--gum-primary)" : "var(--gum-text-muted)", marginBottom: 16, opacity: dragOver ? 1 : 0.4, transition: "all 0.2s" }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--gum-text)", marginBottom: 6 }}>
            {dragOver ? "Drop files here" : `Drag & drop ${activeTab === "image" ? "images" : "documents"} here`}
          </p>
          <p style={{ fontSize: 13, color: "var(--gum-text-muted)", marginBottom: 12 }}>
            or <span style={{ color: "var(--gum-primary)", fontWeight: 500 }}>click to browse</span>
          </p>
          <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>
            {activeTab === "image"
              ? `Supported: ${IMAGE_EXTENSIONS.join(", ")} — Max ${MAX_IMAGE_SIZE_MB}MB`
              : `Supported: ${DOCUMENT_EXTENSIONS.join(", ")} — Max ${MAX_DOCUMENT_SIZE_MB}MB`}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          multiple
          onChange={handleInputChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Active Uploads */}
      {activeUploads.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--gum-text)", marginBottom: 10 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
            Uploading ({activeUploads.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeUploads.map((entry) => (
              <UploadCard key={entry.id} entry={entry} onRemove={removeEntry} onRetry={retryUpload} onCopyUrl={copyUrl} />
            ))}
          </div>
        </div>
      )}

      {/* Error entries */}
      {uploads.filter((u) => u.status === "error").length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#DC3545", marginBottom: 10 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }} />
            Failed ({uploads.filter((u) => u.status === "error").length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {uploads.filter((u) => u.status === "error").map((entry) => (
              <UploadCard key={entry.id} entry={entry} onRemove={removeEntry} onRetry={retryUpload} onCopyUrl={copyUrl} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Uploads */}
      {successUploads.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: 8, color: "#198754" }} />
              Completed ({successUploads.length})
            </h3>
            <button onClick={clearCompleted}
              style={{ height: 30, padding: "0 12px", background: "none", border: "1px solid var(--gum-border)", borderRadius: 6, fontSize: 11, color: "var(--gum-text-muted)", cursor: "pointer" }}>
              Clear All
            </button>
          </div>

          {/* Grid for images, list for documents */}
          {successUploads.some((u) => u.type === "image") && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
              {successUploads.filter((u) => u.type === "image").map((entry) => (
                <ImageCard key={entry.id} entry={entry} onRemove={removeEntry} onCopyUrl={copyUrl} />
              ))}
            </div>
          )}

          {successUploads.some((u) => u.type === "document") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {successUploads.filter((u) => u.type === "document").map((entry) => (
                <UploadCard key={entry.id} entry={entry} onRemove={removeEntry} onRetry={retryUpload} onCopyUrl={copyUrl} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {uploads.length === 0 && (
        <div className="gum-card" style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
          <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }} />
          <p style={{ fontSize: 13 }}>No uploads yet. Drop files above or click to browse.</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} style={{
      height: 36, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 6,
      background: active ? "var(--gum-primary)" : "var(--gum-surface)",
      color: active ? "#fff" : "var(--gum-text)",
      border: active ? "none" : "1px solid var(--gum-border)",
    }}>
      <i className={`fa-solid ${icon}`} /> {label}
    </button>
  );
}

function UploadCard({ entry, onRemove, onRetry, onCopyUrl }: {
  entry: UploadEntry;
  onRemove: (id: string) => void;
  onRetry: (entry: UploadEntry) => void;
  onCopyUrl: (url: string) => void;
}) {
  const icon = entry.result ? getFileIcon(entry.result.mimeType) : getFileIcon(entry.file.type);
  const color = entry.result ? getFileColor(entry.result.mimeType) : getFileColor(entry.file.type);

  return (
    <div className="gum-card" style={{ padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
          background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className={`fa-solid ${icon}`} style={{ fontSize: 16, color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.file.name}
          </p>
          <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>
            {formatFileSize(entry.file.size)}
            {entry.result && (
              <> — <a href={entry.result.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gum-primary)", textDecoration: "none" }}>
                View on CDN <i className="fa-solid fa-external-link" style={{ fontSize: 9 }} />
              </a></>
            )}
          </p>
          {entry.error && <p style={{ fontSize: 11, color: "#DC3545", marginTop: 2 }}>{entry.error}</p>}

          {/* Progress bar */}
          {entry.status === "uploading" && (
            <div style={{ marginTop: 6, height: 4, background: "var(--gum-border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${entry.progress}%`, background: "var(--gum-primary)", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          )}
        </div>

        {/* Status & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {entry.status === "uploading" && (
            <span style={{ fontSize: 11, color: "var(--gum-primary)", fontWeight: 500 }}>{entry.progress}%</span>
          )}
          {entry.status === "success" && entry.result && (
            <button onClick={() => onCopyUrl(entry.result!.url)} title="Copy URL"
              style={smallBtn("var(--gum-primary)")}>
              <i className="fa-solid fa-copy" />
            </button>
          )}
          {entry.status === "error" && (
            <button onClick={() => onRetry(entry)} title="Retry"
              style={smallBtn("#F59E0B")}>
              <i className="fa-solid fa-rotate-right" />
            </button>
          )}
          <button onClick={() => onRemove(entry.id)} title="Remove"
            style={smallBtn("var(--gum-text-muted)")}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageCard({ entry, onRemove, onCopyUrl }: {
  entry: UploadEntry;
  onRemove: (id: string) => void;
  onCopyUrl: (url: string) => void;
}) {
  const url = entry.result?.url || "";

  return (
    <div className="gum-card" style={{ overflow: "hidden" }}>
      {/* Preview */}
      <div style={{
        height: 140, background: "var(--gum-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={entry.file.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <i className="fa-solid fa-image" style={{ fontSize: 32, color: "var(--gum-text-muted)", opacity: 0.3 }} />
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--gum-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
          {entry.result?.fileName || entry.file.name}
        </p>
        <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginBottom: 8 }}>
          {formatFileSize(entry.file.size)}
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {url && (
            <>
              <button onClick={() => onCopyUrl(url)} title="Copy URL"
                style={{ ...smallBtn("var(--gum-primary)"), flex: 1, justifyContent: "center", gap: 4 }}>
                <i className="fa-solid fa-copy" /> Copy URL
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer"
                style={{ ...smallBtn("var(--gum-text-muted)"), display: "inline-flex", textDecoration: "none" }}>
                <i className="fa-solid fa-external-link" />
              </a>
            </>
          )}
          <button onClick={() => onRemove(entry.id)} title="Remove"
            style={smallBtn("var(--gum-text-muted)")}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const smallBtn = (color: string): React.CSSProperties => ({
  height: 28, padding: "0 8px", display: "inline-flex", alignItems: "center",
  borderRadius: 6, border: "1px solid var(--gum-border)", background: "transparent",
  color, cursor: "pointer", fontSize: 11, gap: 4,
});

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr.response?.data?.message || "Upload failed";
  }
  return "Network error";
}

export default withPermission(UploadsPage, PERMISSIONS.PERMISSION_MANAGE);
