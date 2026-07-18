"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { 
  UploadCloud, FileText, CheckCircle2, XCircle, Loader2, Trash2, 
  Search, Eye, Database, Info, Calendar, HardDrive, Compass, Tag, Layers
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UploadingFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  processedSteps?: string[];
  activeStep?: number;
}


const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function UploadHub({
  isDragging, handleDragOver, handleDragLeave, handleDrop, fileInputRef, handleFileChange,
  uploadList, searchQuery, setSearchQuery, filteredUploadList, handleClearList,
  isUploading, selectedFile, setSelectedFile, handleRemoveFile, message, handleUploadAll, isButtonDisabled
}: {
  isDragging: boolean;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadList: UploadingFile[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredUploadList: UploadingFile[];
  handleClearList: () => void;
  isUploading: boolean;
  selectedFile: UploadingFile | null;
  setSelectedFile: (file: UploadingFile | null) => void;
  handleRemoveFile: (id: string) => void;
  message: string;
  handleUploadAll: () => void;
  isButtonDisabled: boolean;
}) {
  return (
    <>
    {/* Left Side: Upload zone and items list (65%) */}
    <div className="lg:col-span-7 space-y-6">
      <Card className="border border-border/40 bg-card/25 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-secondary/15 py-4">
          <CardTitle className="text-sm font-semibold">Upload Hub</CardTitle>
          <CardDescription className="text-xs">Drag and drop file resources to parse structured entities.</CardDescription>
            </CardHeader>
        <CardContent className="p-5 space-y-5">
              
              {/* Drag/Drop Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center space-y-3 ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[0.99] shadow-inner"
                    : "border-border/80 bg-secondary/10 hover:bg-secondary/25 hover:border-foreground/15"
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
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Drag & drop files here to parse
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Supports PDF, DOCX, Markdown, or Text files
                  </p>
            </div>
          </div>

              {/* Search Bar for files list */}
              {uploadList.length > 0 && (
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search local ingestion list..."
                    className="w-full bg-secondary/25 border border-border/60 focus:ring-1 focus:ring-foreground/10 rounded-lg pl-9 h-8 text-[11px]"
                  />
            </div>
              )}

              {/* Uploading Queue Table */}
              {uploadList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/20 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Queue List ({filteredUploadList.length} items)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearList}
                      disabled={isUploading}
                      className="text-[10px] h-6 px-2 hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Wipe Queue
                    </Button>
              </div>

                  <div className="max-h-[260px] overflow-y-auto space-y-1.5 pr-1">
                    {filteredUploadList.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedFile(item)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedFile?.id === item.id 
                            ? "bg-secondary/80 border-border" 
                            : "border-border/40 hover:bg-secondary/35 bg-secondary/15"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">{item.file.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatFileSize(item.file.size)}</p>
                      </div>
                    </div>

                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {/* Badges indicators */}
                          {item.status === "pending" && (
                            <Badge variant="outline" className="border-border/80 text-muted-foreground text-[9px] px-1.5 py-0.5">
                              Pending
                            </Badge>
                          )}
                          {item.status === "uploading" && (
                            <Badge className="bg-primary/20 text-primary border border-primary/30 flex items-center gap-1 text-[9px] px-1.5 py-0.5">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              Parsing
                            </Badge>
                          )}
                          {item.status === "done" && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 text-[9px] px-1.5 py-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Done
                            </Badge>
                          )}
                          {item.status === "error" && (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border border-destructive/20 text-[9px] px-1.5 py-0.5">
                              Failed
                            </Badge>
                          )}

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(item.id); }}
                            disabled={isUploading}
                            className="text-muted-foreground/40 hover:text-destructive p-0.5 rounded transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                    </div>
                  </div>
                    ))}
              </div>
            </div>
              )}

              {/* Status Global message notifications */}
              {message && (
                <div className={`p-3 rounded-lg border text-xs leading-normal font-semibold ${
                  message.includes("failed") || message.includes("errors")
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}>
                  {message}
            </div>
              )}

              {/* Main ingest trigger button */}
              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleUploadAll}
                  disabled={isButtonDisabled}
                  className="px-4 rounded-xl text-xs font-semibold tracking-tight shadow-sm flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Syncing Knowledge Base...
                    </>
                  ) : (
                    "Ingest All Items"
                  )}
                </Button>
          </div>

            </CardContent>
          </Card>
    </div>
    </>
  );
}

function InspectPanel({ selectedFile }: { selectedFile: UploadingFile | null }) {
  return (
    <>
    {/* Right Side: Inspect & Pipeline Preview drawer panel (35%) */}
    <div className="lg:col-span-5">
      <Card className="border border-border/40 bg-card/25 shadow-sm rounded-2xl overflow-hidden min-h-[420px] flex flex-col">
        <CardHeader className="border-b border-border/30 bg-secondary/15 py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Resource Metadata & Pipeline
              </CardTitle>
          <CardDescription className="text-xs">Examine parsed attributes & embedding pipeline</CardDescription>
            </CardHeader>
            
        <CardContent className="p-5 flex-1 flex flex-col justify-between">
              
              {selectedFile ? (
                <div className="space-y-6">
                  
                  {/* Basic information */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <h4 className="text-xs font-semibold text-foreground break-all">{selectedFile.file.name}</h4>
                </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-2 rounded-lg bg-secondary/25 border border-border/30">
                        <span className="text-muted-foreground block mb-0.5 uppercase tracking-wider text-[8px]">Resource Type</span>
                        <span className="font-semibold font-mono">{selectedFile.file.name.split('.').pop()?.toUpperCase() || "TXT"}</span>
                  </div>
                      
                      <div className="p-2 rounded-lg bg-secondary/25 border border-border/30">
                        <span className="text-muted-foreground block mb-0.5 uppercase tracking-wider text-[8px]">Disk Space</span>
                        <span className="font-semibold font-mono">{formatFileSize(selectedFile.file.size)}</span>
                  </div>

                      <div className="p-2 rounded-lg bg-secondary/25 border border-border/30">
                        <span className="text-muted-foreground block mb-0.5 uppercase tracking-wider text-[8px]">Vector Dimension</span>
                        <span className="font-semibold font-mono">1536 (Dense)</span>
                  </div>

                      <div className="p-2 rounded-lg bg-secondary/25 border border-border/30">
                        <span className="text-muted-foreground block mb-0.5 uppercase tracking-wider text-[8px]">Graph Nodes</span>
                        <span className="font-semibold font-mono">Pending extraction</span>
                  </div>
                </div>
              </div>

                  {/* Processing Ingestion Pipeline Visualization */}
                  <div className="space-y-2 pt-4 border-t border-border/30">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Processing Pipeline State</span>
                    
                    <div className="space-y-2">
                      {selectedFile.processedSteps?.map((step, idx) => {
                        const isCompleted = selectedFile.status === "done" || (selectedFile.activeStep !== undefined && idx < selectedFile.activeStep);
                        const isActive = selectedFile.status === "uploading" && selectedFile.activeStep !== undefined && idx === selectedFile.activeStep;
                        
                        return (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] font-bold ${
                                isCompleted 
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : isActive
                                  ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                                  : "border-border text-muted-foreground"
                              }`}>
                                {isCompleted ? "✓" : idx + 1}
                          </div>
                              <span className={isCompleted ? "text-foreground" : "text-muted-foreground"}>{step}</span>
                        </div>
                            
                            {isActive && (
                              <span className="text-[9px] text-primary animate-pulse font-mono">PROCESSING</span>
                            )}
                            {isCompleted && (
                              <span className="text-[9px] text-emerald-500/80 font-mono">SYNCED</span>
                            )}
                      </div>
                        );
                      })}
                </div>
              </div>

                  {/* Document Preview Snippet with highlighted text */}
                  <div className="space-y-2 pt-4 border-t border-border/30">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Semantic Content Highlight</span>
                    <div className="p-3.5 rounded-lg border border-border/30 bg-secondary/15 text-[11px] leading-relaxed text-foreground/80 italic select-none">
                      "The target workspace index coordinates are optimized for dense retrieval. Mapped entities like <span className="bg-primary/20 border-b border-primary text-foreground font-semibold px-0.5">PKM_ENTITY: Project focus</span> represent key milestones parsed by the reflection engine."
                </div>
              </div>

            </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-20 text-muted-foreground space-y-2.5">
                  <Info className="w-6 h-6 text-muted-foreground/60" />
                  <p className="text-xs">No file resource selected.</p>
                  <p className="text-[10px] text-muted-foreground/80 max-w-xs">Select any file card in the ingestion queue to inspect parsed semantic highlights and step pipeline.</p>
            </div>
              )}

              {/* Developer footer alert info */}
              <div className="mt-4 pt-3 border-t border-border/30 text-[10px] text-muted-foreground/60 flex items-center gap-1.5 select-none">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                Indexed items are fully partitioned for query isolation.
          </div>

            </CardContent>
          </Card>
    </div>
    </>
  );
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");

  const [uploadList, setUploadList] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");

  // Searching & Selection State for inspect panel
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<UploadingFile | null>(null);

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
      const extension = "." + file.name.split(".").pop()?.toLowerCase();
      const isDuplicate = uploadList.some(item => item.file.name === file.name && item.file.size === file.size);

      if (allowedExtensions.includes(extension) && !isDuplicate) {
        validFiles.push({
          id: Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
          file,
          status: "pending",
          processedSteps: ["Ingested", "Extracted", "Parsed", "Vectorized", "Graph Synergized"],
          activeStep: 0
        });
      }
    }

    if (validFiles.length > 0) {
      setUploadList(prev => [...prev, ...validFiles]);
      setMessage("");
      // Auto select the first newly added file
      if (!selectedFile) {
        setSelectedFile(validFiles[0]);
      }
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadList(prev => prev.filter(item => item.id !== id));
    if (selectedFile?.id === id) {
      setSelectedFile(null);
    }
  };

  const handleClearList = () => {
    setUploadList([]);
    setMessage("");
    setSelectedFile(null);
  };

  // Simulated progressive steps pipeline
  const runSimulatedPipeline = async (fileId: string) => {
    const stepsCount = 5;
    for (let s = 1; s <= stepsCount; s++) {
      await new Promise((res) => setTimeout(res, 600));
      setUploadList(prev => prev.map(f => {
        if (f.id === fileId) {
          return { ...f, activeStep: s };
        }
        return f;
      }));
    }
  };

  const handleUploadAll = async () => {
    if (uploadList.length === 0 || !workspaceId) return;

    const filesToUpload = uploadList.filter(f => f.status === "pending" || f.status === "error");
    if (filesToUpload.length === 0) return;

    setMessage("");

    for (const fileItem of filesToUpload) {
      // Set status to uploading
      setUploadList(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: "uploading", activeStep: 1 } : f));

      // Run the pipeline animation in background
      runSimulatedPipeline(fileItem.id);

      try {
        const formData = new FormData();
        formData.append("file", fileItem.file);

        await api.postFormData(`/workspaces/${workspaceId}/upload`, formData);

        // Mark as done
        setUploadList(prev => prev.map(f => {
          if (f.id === fileItem.id) {
            const updated = { ...f, status: "done" as const, activeStep: 5 };
            if (selectedFile?.id === f.id) {
              setSelectedFile(updated);
            }
            return updated;
          }
          return f;
        }));
      } catch (err: any) {
        console.error("Failed to upload: " + fileItem.file.name, err);
        setUploadList(prev => prev.map(f => {
          if (f.id === fileItem.id) {
            const updated = { ...f, status: "error" as const, error: err.message || "Failed to process" };
            if (selectedFile?.id === f.id) {
              setSelectedFile(updated);
            }
            return updated;
          }
          return f;
        }));
      }
    }

    setUploadList(latestList => {
      const failed = latestList.filter(f => f.status === "error").length;
      const success = latestList.filter(f => f.status === "done").length;
      if (failed > 0) {
        setMessage(`Ingestion complete with errors. Success: ${success}, Failed: ${failed}.`);
      } else {
        setMessage(`All ${success} document(s) successfully vectorized into Second Brain!`);
      }
      window.dispatchEvent(new Event("data-updated"));
      return latestList;
    });
  };

  const filteredUploadList = uploadList.filter(item =>
    item.file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isButtonDisabled = uploadList.length === 0 || uploadList.every(f => f.status === "done") || uploadList.some(f => f.status === "uploading");
  const isUploading = uploadList.some(f => f.status === "uploading");

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <UploadCloud className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Document Ingestion & Indexing</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Upload regulations, workspace standards, and manuals to synergize context.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Side: Upload zone and items list (65%) */}
        <UploadHub
          isDragging={isDragging}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          uploadList={uploadList}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredUploadList={filteredUploadList}
          handleClearList={handleClearList}
          isUploading={isUploading}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          handleRemoveFile={handleRemoveFile}
          message={message}
          handleUploadAll={handleUploadAll}
          isButtonDisabled={isButtonDisabled}
        />

        {/* Right Side: Inspect & Pipeline Preview drawer panel (35%) */}
        <InspectPanel selectedFile={selectedFile} />

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