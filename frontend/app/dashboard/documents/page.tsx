"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { UploadCloud, FileText, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UploadingFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const [uploadList, setUploadList] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFilesToList(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFilesToList(e.target.files);
  };

  const addFilesToList = (files: FileList | null) => {
    if (!files) return;
    const allowedExtensions = [".pdf", ".docx", ".md", ".txt"];
    const validFiles: UploadingFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = "." + file.name.split('.').pop()?.toLowerCase();
      
      // Prevent duplicates in the current list
      const isDuplicate = uploadList.some(item => item.file.name === file.name && item.file.size === file.size);
      
      if (allowedExtensions.includes(extension) && !isDuplicate) {
        validFiles.push({
          id: Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
          file,
          status: "pending"
        });
      }
    }

    if (validFiles.length > 0) {
      setUploadList(prev => [...prev, ...validFiles]);
      setMessage(""); // Clear previous global messages
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadList(prev => prev.filter(item => item.id !== id));
  };

  const handleClearList = () => {
    setUploadList([]);
    setMessage("");
  };

  const handleUploadAll = async () => {
    if (uploadList.length === 0 || !workspaceId) return;

    // Filter files that are pending or errored
    const filesToUpload = uploadList.filter(f => f.status === "pending" || f.status === "error");
    if (filesToUpload.length === 0) return;

    setMessage("");

    for (const fileItem of filesToUpload) {
      // Set current file status to uploading
      setUploadList(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "uploading" } : f));

      try {
        const formData = new FormData();
        formData.append("file", fileItem.file);

        await api.postFormData(`/workspaces/${workspaceId}/upload`, formData);

        // Mark as done
        setUploadList(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "done" } : f));
      } catch (err: any) {
        console.error("Failed to upload file: " + fileItem.file.name, err);
        // Mark as error
        setUploadList(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "error", error: err.message || "Failed to process" } : f));
      }
    }

    // Summarize the sequential run results
    setUploadList(latestList => {
      const failed = latestList.filter(f => f.status === "error").length;
      const success = latestList.filter(f => f.status === "done").length;
      if (failed > 0) {
        setMessage(`Ingestion complete with errors. Success: ${success}, Failed: ${failed}.`);
      } else {
        setMessage(`All ${success} document(s) ingested successfully into your second brain!`);
      }
      return latestList;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!workspaceId) {
    return <div className="p-8 text-destructive text-center">Please select a workspace from the sidebar.</div>;
  }

  const isButtonDisabled = uploadList.length === 0 || uploadList.every(f => f.status === "done") || uploadList.some(f => f.status === "uploading");
  const isUploading = uploadList.some(f => f.status === "uploading");

  return (
    <div className="max-w-3xl mx-auto my-4 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <UploadCloud className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Document Ingestion</h2>
          <p className="text-sm text-muted-foreground">Upload guidelines, standards, and manuals to teach J.A.R.V.I.S. your industrial brain context.</p>
        </div>
      </div>

      <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-black/10">
          <CardTitle>File Upload Zone</CardTitle>
          <CardDescription>Drag and drop PDF, DOCX, MD, or TXT documents to add them to your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-3 ${
              isDragging
                ? "border-primary bg-primary/10 scale-[0.99] shadow-inner"
                : "border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".pdf,.docx,.md,.txt"
              className="hidden"
            />
            <div className="p-4 rounded-full bg-primary/10 border border-primary/25 text-primary">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                Drag and drop your files here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse from system files
              </p>
            </div>
            <div className="text-[10px] text-muted-foreground/60 tracking-wider">
              SUPPORTED FORMATS: .PDF, .DOCX, .MD, .TXT
            </div>
          </div>

          {/* Uploading Status Lists */}
          {uploadList.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ingestion Queue ({uploadList.length} files)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearList}
                  disabled={isUploading}
                  className="text-xs h-7 px-2 hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear List
                </Button>
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {uploadList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 shadow-sm text-xs transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{item.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatFileSize(item.file.size)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {/* Status Badges */}
                      {item.status === "pending" && (
                        <Badge variant="outline" className="border-white/10 text-muted-foreground text-[10px]">
                          Pending
                        </Badge>
                      )}
                      {item.status === "uploading" && (
                        <Badge className="bg-primary/20 text-primary border border-primary/30 flex items-center gap-1 text-[10px]">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Ingesting
                        </Badge>
                      )}
                      {item.status === "done" && (
                        <Badge className="bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1 text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Done
                        </Badge>
                      )}
                      {item.status === "error" && (
                        <Badge
                          variant="destructive"
                          className="bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1 text-[10px]"
                          title={item.error}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Failed
                        </Badge>
                      )}

                      {/* Remove item button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(item.id)}
                        disabled={isUploading}
                        className="text-muted-foreground/60 hover:text-destructive disabled:opacity-40 p-1 rounded-md transition-colors shrink-0"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Container (Matches original pattern) */}
          {message && (
            <div className={`p-4 rounded-xl border text-xs leading-normal font-medium ${
              message.includes("failed") || message.includes("errors")
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-green-500/10 border-green-500/20 text-green-500"
            }`}>
              {message}
            </div>
          )}

          {/* Action Trigger Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleUploadAll}
              disabled={isButtonDisabled}
              className="px-6 rounded-xl font-medium tracking-tight shadow-md flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingesting Second Brain...
                </>
              ) : (
                "Ingest All Documents"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading documents...</div>}>
      <DocumentsContent />
    </Suspense>
  );
}
