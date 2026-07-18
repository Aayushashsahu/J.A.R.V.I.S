"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, FileText, Check, X, ShieldAlert, Sparkles, RefreshCw, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/toast";

interface Suggestion {
  id: string;
  suggestion_type: "new_belief" | "workspace_move";
  content: string; // JSON string
  confidence: number;
  created_at: string;
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/brain/suggestions");
      setSuggestions(response);
    } catch (err: any) {
      console.error("Failed to load suggestions", err);
      setError("Failed to sync AI suggestions. Check backend service states.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();

    const handleRefresh = () => {
      fetchSuggestions();
    };

    window.addEventListener("data-updated", handleRefresh);
    return () => {
      window.removeEventListener("data-updated", handleRefresh);
    };
  }, [fetchSuggestions]);

  async function handleResolve(id: string, action: "approved" | "rejected") {
    try {
      await api.post(`/brain/suggestions/${id}/resolve?action=${action}`, {});
      setSuggestions(prev => prev.filter(s => s.id !== id));
      toast({
        title: action === "approved" ? "Suggestion Approved" : "Suggestion Dismissed",
        description: `Recommendation has been successfully ${action}.`,
        variant: "success",
      });
      // Fire global update to reload components (Overview/Beliefs/Timeline)
      window.dispatchEvent(new Event("data-updated"));
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message || "Failed to process suggestion resolution.",
        variant: "error",
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto my-6 px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Optimization Recommendations
            </h2>
            <p className="text-sm text-muted-foreground">
              Review and resolve automated pipeline proposals for knowledge consolidation.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSuggestions}
          className="flex items-center gap-1.5 border-white/10 text-xs h-8 px-3 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center gap-2.5 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-20 space-y-4">
          <div className="flex items-center justify-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-xs">Computing optimization paths...</p>
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 rounded-2xl bg-black/15">
          <div className="w-10 h-10 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">No active recommendations</h4>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            J.A.R.V.I.S. will post new organization cards when pattern optimizations are detected.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {suggestions.map((sug) => {
              const content = JSON.parse(sug.content);
              const isBelief = sug.suggestion_type === "new_belief";
              return (
                <motion.div
                  key={sug.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                >
                  <Card className="border border-white/10 bg-black/40 backdrop-blur-md hover:border-primary/45 transition-all duration-300 rounded-2xl overflow-hidden shadow-lg">
                    <CardHeader className="border-b border-white/5 bg-black/10 flex flex-row items-center justify-between gap-4 py-3.5 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                          {isBelief ? <Brain className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">
                            {isBelief ? "Neural Reflection Suggestion" : "Workspace Alignment Suggestion"}
                          </CardTitle>
                          <CardDescription className="text-[10px]">
                            {isBelief ? "New semantic relationship path" : "File categorization improvement"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className="text-[9px] uppercase tracking-widest bg-primary/10 border border-primary/20 text-primary rounded-full px-2 py-0.5 font-bold">
                        Confidence: {sug.confidence}%
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {isBelief ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground leading-relaxed italic">
                            "{content.belief}"
                          </p>
                          {content.source_file && (
                            <span className="text-[10px] text-muted-foreground bg-black/30 border border-white/5 px-2 py-1 rounded font-mono">
                              SRC: {content.source_file}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-foreground leading-relaxed">
                            Document <span className="font-semibold text-primary">{content.filename}</span> carries high similarity correlations to workspace <span className="font-semibold text-primary">{content.suggested_workspace}</span>.
                          </p>
                          {content.evidence && content.evidence.length > 0 && (
                            <div className="text-xs text-muted-foreground bg-black/35 border border-white/5 p-4 rounded-xl space-y-2">
                              <span className="font-semibold text-[10px] text-foreground uppercase tracking-widest block">Extracted Evidence:</span>
                              <div className="space-y-1.5 font-mono text-[11px]">
                                {content.evidence.map((ev: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className="text-primary shrink-0">→</span>
                                    <span>{ev}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end gap-3 border-t border-white/5 pt-3.5 pb-3.5 px-6 bg-black/10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolve(sug.id, "rejected")}
                        className="hover:bg-destructive/15 hover:text-destructive text-xs h-8 px-3 rounded-lg"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleResolve(sug.id, "approved")}
                        className="text-xs h-8 px-3 rounded-lg font-semibold shadow-md shadow-primary/10"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Approve
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}