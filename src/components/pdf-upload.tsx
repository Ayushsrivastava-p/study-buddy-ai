import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUp, FileText, Loader2, CheckCircle2, X, ExternalLink, AlertTriangle } from "lucide-react";
import { getSessionId } from "@/lib/session";

type BackendStatus = "idle" | "uploading" | "connected" | "unavailable";

const UPLOAD_URL =
  "https://shawl-tasting-rice.ngrok-free.dev/webhook/study-buddy";
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export type UploadedPdf = {
  name: string;
  size: number;
  fileUrl?: string;
  previewUrl?: string;
  fileId?: string;
  pdfText?: string;
  raw?: unknown;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function PdfUpload({
  onUploaded,
}: {
  onUploaded?: (file: UploadedPdf | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedPdf | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("idle");
  const [backendWarning, setBackendWarning] = useState<string | null>(null);

  // Track current object URL so we can revoke it when replaced/unmounted
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Only PDF files are allowed.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setError(`File too large. Max ${formatBytes(MAX_SIZE)}.`);
        return;
      }

      // Create local browser preview URL instantly so the user sees the PDF
      // immediately, regardless of what the backend returns.
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;

      const initial: UploadedPdf = {
        name: file.name,
        size: file.size,
        previewUrl,
      };
      setUploaded(initial);
      onUploaded?.(initial);
      setBackendWarning(null);
      setBackendStatus("uploading");

      setUploading(true);
      try {
        const form = new FormData();
        // MUST MATCH n8n: "file"
        form.append("file", file);

        const res = await fetch(UPLOAD_URL, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          // Don't fail the whole flow — local preview still works.
          console.warn("Backend upload failed with status:", res.status);
          setBackendStatus("unavailable");
          setBackendWarning("PDF preview available locally, backend processing unavailable.");
          return;
        }

        const text = await res.text();
        let data: unknown = text;
        try { data = JSON.parse(text); } catch { /* keep text */ }

        const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
        // Extract extracted PDF text from common response shapes so we can
        // forward it with future AI questions for full-document context.
        const pdfText =
          (d.pdfText as string) ||
          (d.text as string) ||
          (d.content as string) ||
          (d.extractedText as string) ||
          (typeof data === "string" ? (data as string) : undefined);
        const result: UploadedPdf = {
          name: file.name,
          size: file.size,
          previewUrl,
          fileUrl: (d.fileUrl as string) || (d.url as string) || (d.file_url as string),
          fileId: (d.fileId as string) || (d.id as string) || (d.file_id as string),
          pdfText,
          raw: data,
        };
        setUploaded(result);
        onUploaded?.(result);
        setBackendStatus("connected");
      } catch (e) {
        // Network failure — keep local preview, surface warning instead of fatal error.
        console.warn("PDF backend upload error:", e);
        setBackendStatus("unavailable");
        setBackendWarning("PDF preview available locally, backend processing unavailable.");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <Card className="border-0 bg-gradient-card shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-4 w-4 text-primary" /> Upload PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border/60 bg-background/40 hover:bg-background/60"
          } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          <FileUp className="h-7 w-7 text-primary" />
          <p className="text-sm font-medium">Drag & drop your PDF here</p>
          <p className="text-xs text-muted-foreground">or click to browse (max 20 MB)</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            disabled={uploading}
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="mt-2 rounded-full bg-gradient-primary px-5 shadow-glow hover:opacity-90"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            {uploading ? "Uploading…" : "Choose PDF"}
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {uploaded && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <FileText className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  PDF Ready
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {uploaded.name} · {formatBytes(uploaded.size)}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {backendStatus === "uploading" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Uploading to backend…</span>
                    </>
                  )}
                  {backendStatus === "connected" && (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      <span className="text-primary">Backend connected</span>
                    </>
                  )}
                  {backendStatus === "unavailable" && (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span className="text-amber-600 dark:text-amber-400">Backend processing unavailable</span>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={uploading}
                onClick={() => {
                  if (previewUrlRef.current) {
                    URL.revokeObjectURL(previewUrlRef.current);
                    previewUrlRef.current = null;
                  }
                  setUploaded(null);
                  setBackendStatus("idle");
                  setBackendWarning(null);
                  onUploaded?.(null);
                }}
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {backendWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{backendWarning}</span>
              </div>
            )}

            {(uploaded.previewUrl || uploaded.fileUrl) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(uploaded.previewUrl || uploaded.fileUrl, "_blank")}
                className="rounded-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open PDF in New Tab
              </Button>
            )}

            {(uploaded.previewUrl || uploaded.fileUrl) ? (
              <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
                <embed
                  src={uploaded.previewUrl || uploaded.fileUrl}
                  type="application/pdf"
                  width="100%"
                  height="600px"
                  className="block w-full rounded-xl"
                />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                Preview unavailable.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
