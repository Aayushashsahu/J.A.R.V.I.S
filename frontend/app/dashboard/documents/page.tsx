"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { UploadCloud, FileText, CheckCircle2, XCircle, Loader2, Trash2, Search, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface UploadingFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress?: number;
  error?: string;
}

interface ServerDoc {
  id: string;
  filename: string;
  content_type: string;
  created_at: string;
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const { toast } = useToast();
  
  const [uploadList, setUploadList] = useState<UploadingFile[]>([]);
  const [serverDocs, setServerDocs] = useState<ServerDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents from server
  const fetchDocuments = async () => {
    if (!workspaceId) return;
    setIsDocsLoading(true);
    try {
      const data = await api.get(`/workspaces/${workspaceId}/documents`);
      setServerDocs(data);
    } catch (err: any) {
      toast({
        title: "Error loading documents",
        description: err.message || "Failed to fetch workspace documents",
        variant: "error",
      });
    } finally {
      setIsDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Listen for global data updates (e.g. after uploading or resetting)
    const handleDataUpdate = () => {
      fetchDocuments();
    };
    window.addEventListener("data-updated", handleDataUpdate);
    return () => window.removeEventListener("data-updated", handleDataUpdate);
  }, [workspaceId]);

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
      const extension = "." + file.name.split(".").pop()?.toLowerCase();

      // Prevent duplicates in the current upload queue
      const isDuplicate = uploadList.some(item => item.file.name === file.name && item.file.size === file.size);

      if (allowedExtensions.includes(extension) && !isDuplicate) {
        validFiles.push({
          id: Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
          file,
          status: "pending",
          progress: 0
        });
      }
    }

    if (validFiles.length > 0) {
      setUploadList(prev => [...prev, ...validFiles]);
      setMessage(""); 
      toast({
        title: "Added to queue",
        description: `Successfully queued ${validFiles.length} file(s).`,
        variant: "info",
      });
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

    const filesToUpload = uploadList.filter(f => f.status === "pending" || f.status === "error");
    if (filesToUpload.length === 0) return;

    setMessage("");

    for (const fileItem of filesToUpload) {
      setUploadList(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "uploading", progress: 0 } : f));

      try {
        const formData = new FormData();
        formData.append("file", fileItem.file);

        const progressInterval = setInterval(() => {
          setUploadList(prev => prev.map(f =>
            f.id === fileItem.id
              ? { ...f, progress: Math.min((f.progress || 0) + 15, 95) }
              : f
          ));
        }, 120);

        await api.postFormData(`/workspaces/${workspaceId}/upload`, formData);

        clearInterval(progressInterval);
        setUploadList(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "done", progress: 100 } : f));
        
        toast({
          title: "File ingested",
          description: `${fileItem.file.name} is now inside your second brain!`,
          variant: "success",
        });

      } catch (err: any) {
        console.error("Failed to upload file: " + fileItem.file.name, err);
        setUploadList(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "error", error: err.message || "Failed to process" } : f));
        toast({
          title: "Upload failed",
          description: `Failed to ingest ${fileItem.file.name}.`,
          variant: "error",
        });
      }
    }

    setUploadList(latestList => {
      const failed = latestList.filter(f => f.status === "error").length;
      const success = latestList.filter(f => f.status === "done").length;
      if (failed > 0) {
        setMessage(`Ingestion complete with errors. Success: ${success}, Failed: ${failed}.`);
      } else {
        setMessage(`All ${success} document(s) ingested successfully into your second brain!`);
        setUploadList([]); // clear queue on success
      }
      fetchDocuments(); // Refresh backend document list
      return latestList;
    });
  };

  const handleDeleteDoc = async (docId: string, filename: string) => {
    if (!workspaceId) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/documents/${docId}`);
      toast({
        title: "Document deleted",
        description: `Successfully removed ${filename} and its vector indices.`,
        variant: "success",
      });
      fetchDocuments(); // Refresh documents list
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "Failed to delete document",
        variant: "error",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredDocs = serverDocs.filter(d => 
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Workspace Required</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-2">
          Please select a workspace from the sidebar selector to manage your documents.
        </p>
      </div>
    );
  }

  const isButtonDisabled = uploadList.length === 0 || uploadList.every(f => f.status === "done") || uploadList.some(f => f.status === "uploading");
  const isUploading = uploadList.some(f => f.status === "uploading");

  return (
    <div className="max-w-5xl mx-auto my-6 px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Document Ingestion & Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload guidelines, standards, and manuals to teach J.A.R.V.I.S. your industrial brain context.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Zone Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-white/5 bg-black/10">
              <CardTitle className="text-base font-semibold">Upload Hub</CardTitle>
              <CardDescription className="text-xs">Drag files here to queue for vector index ingestion.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <motion.div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-2 ${
                  isDragging
                    ? "border-primary bg-primary/10 scale-[1.02] shadow-inner"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
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
                <div className="p-3 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">Drag & drop files here</p>
                  <p className="text-[10px] text-muted-foreground">PDF, DOCX, MD, or TXT</p>
                </div>
              </motion.div>

              {/* Uploading Queue */}
              <AnimatePresence>
                {uploadList.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-2"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Queue</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearList}
                        disabled={isUploading}
                        className="text-[10px] h-6 px-1.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                      {uploadList.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-white/5 bg-white/5 text-[11px]">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate text-foreground font-medium">{item.file.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {item.status === "uploading" ? (
                              <Loader2 className="w-3 h-3 text-primary animate-spin" />
                            ) : item.status === "done" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            ) : item.status === "error" ? (
                              <XCircle className="w-3.5 h-3.5 text-destructive" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(item.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {message && (
                <div className={`p-3 rounded-lg border text-[11px] font-medium leading-relaxed ${
                  message.includes("failed") || message.includes("errors")
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-green-500/10 border-green-500/20 text-green-500"
                }`}>
                  {message}
                </div>
              )}

              <Button
                onClick={handleUploadAll}
                disabled={isButtonDisabled}
                className="w-full rounded-xl text-xs font-semibold h-9 shadow-md flex items-center justify-center gap-2 mt-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing vector ingestion...
                  </>
                ) : (
                  "Ingest Files"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Server Documents Directory */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden min-h-[400px] flex flex-col">
            <CardHeader className="border-b border-white/5 bg-black/10 flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Workspace Library</CardTitle>
                <CardDescription className="text-xs">Manage active manuals and source specifications.</CardDescription>
              </div>
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className="pl-9 bg-background/40 border-white/10 h-9 text-xs rounded-lg"
                />
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-between">
              {isDocsLoading ? (
                <div className="space-y-4">
                  <SkeletonTable rows={4} cols={3} />
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-3">
                    <FileDown className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">No documents found</h4>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    {searchQuery ? "No matches for your search query." : "Upload documents using the zone to the left to see them listed."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/15 text-muted-foreground font-semibold">
                        <th className="py-3 px-4">Filename</th>
                        <th className="py-3 px-4">Format</th>
                        <th className="py-3 px-4">Added</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredDocs.map((doc) => (
                        <tr key={doc.id} className="group hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground flex items-center gap-2 max-w-[240px] truncate">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{doc.filename}</span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground uppercase">{doc.content_type}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-md cursor-pointer"
                              title="Delete from workspace"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
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