/* ================================================================
   Upload Service — Image & Document uploads via Bunny CDN
   ================================================================ */
import api from "@/lib/axios";
import type { ApiResponse } from "@/types";

// ─── Response Types ──────────────────────────────────────────
export interface UploadResult {
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
}

// ─── Allowed Types ───────────────────────────────────────────
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"];

export const MAX_IMAGE_SIZE_MB = 10;
export const MAX_DOCUMENT_SIZE_MB = 50;

// ─── Upload Image ────────────────────────────────────────────
export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ApiResponse<UploadResult>> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<ApiResponse<UploadResult>>(
    "/uploads/image",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }
  );
  return data;
}

// ─── Upload Document ─────────────────────────────────────────
export async function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void
): Promise<ApiResponse<UploadResult>> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<ApiResponse<UploadResult>>(
    "/uploads/document",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    }
  );
  return data;
}

// ─── Validation Helpers ──────────────────────────────────────
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Unsupported image type. Allowed: ${IMAGE_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `File too large. Maximum size: ${MAX_IMAGE_SIZE_MB}MB`;
  }
  return null;
}

export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return `Unsupported file type. Allowed: ${DOCUMENT_EXTENSIONS.join(", ")}`;
  }
  if (file.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
    return `File too large. Maximum size: ${MAX_DOCUMENT_SIZE_MB}MB`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "fa-image";
  if (mimeType === "application/pdf") return "fa-file-pdf";
  if (mimeType.includes("word")) return "fa-file-word";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "fa-file-excel";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "fa-file-powerpoint";
  if (mimeType === "text/csv") return "fa-file-csv";
  if (mimeType === "text/plain") return "fa-file-lines";
  return "fa-file";
}

export function getFileColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "#4A90D9";
  if (mimeType === "application/pdf") return "#DC3545";
  if (mimeType.includes("word")) return "#2B579A";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "#217346";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "#D24726";
  if (mimeType === "text/csv") return "#198754";
  return "#6C757D";
}
