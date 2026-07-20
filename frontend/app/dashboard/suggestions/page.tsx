"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, CheckCircle2, XCircle, BrainCircuit, FileText, ArrowRight, Activity, AlertCircle } from "lucide-react";

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/brain/suggestions");
      setSuggestions(response);
    } catch (err) {
      console.error("Failed to load suggestions", err);
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
      setSuggestions(suggestions.filter((s: any) => s.id !== id));
      window.dispatchEvent(new Event("data-updated"));
    } catch (err) {
      console.error(`Failed to ${action} suggestion`, err);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Recommendations</h2>
            <p className="text-sm text-muted-foreground mt-0.5">AI-generated recommendations for maintenance, compliance, and operational improvements.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Generating recommendations...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {suggestions.length === 0 ? (
            <div className="border border-border/40 bg-card/25 rounded-2xl p-10 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3 min-h-[250px] shadow-sm">
              <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold">No pending recommendations.</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm leading-normal">
                Ingest more documents to generate maintenance, compliance, and operational recommendations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {suggestions.map((sug: any) => {
                const content = JSON.parse(sug.content);
                const isBelief = sug.suggestion_type === "new_belief";
                
                return (
                  <Card key={sug.id} className="bg-card/25 border-border/40 hover:border-foreground/10 hover-lift shadow-sm rounded-xl overflow-hidden flex flex-col justify-between">
                    
                    <CardHeader className="border-b border-border/20 bg-secondary/15 py-3 px-5">
                      <div className="flex justify-between items-center gap-4">
                        <CardTitle className="text-xs font-semibold flex items-center gap-2 text-foreground/90">
                          {isBelief ? (
                            <>
                              <BrainCircuit className="w-4 h-4 text-amber-500" />
                              Reflect New Belief
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4 text-blue-400" />
                              Organize Context
                            </>
                          )}
                        </CardTitle>
                        <Badge variant="outline" className="border-border/80 text-muted-foreground font-mono text-[9px] px-1.5 py-0.5">
                          {sug.confidence}% Match
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 flex-1 space-y-4">
                      
                      {isBelief ? (
                        <p className="text-xs font-medium text-foreground leading-relaxed italic">
                          "{content.belief}"
                        </p>
                      ) : (
                        <div className="space-y-3.5">
                          <p className="text-xs text-foreground/80 leading-normal">
                            J.A.R.V.I.S. identified file <span className="font-semibold text-primary break-all">{content.filename}</span> as related to <span className="font-semibold text-primary">{content.suggested_workspace}</span>.
                          </p>
                          
                          {content.evidence && content.evidence.length > 0 && (
                            <div className="text-[11px] text-muted-foreground bg-secondary/25 border border-border/40 p-3 rounded-lg space-y-1.5">
                              <span className="font-bold text-[9px] uppercase tracking-wider text-foreground">Evidence Logs</span>
                              <ul className="space-y-1.5">
                                {content.evidence.map((ev: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-1.5 leading-normal">
                                    <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                    <span>{ev}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                    </CardContent>

                    <CardFooter className="flex justify-end gap-2 border-t border-border/20 py-2.5 px-5 bg-secondary/15">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleResolve(sug.id, "rejected")} 
                        className="h-8 rounded-lg text-xs hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </Button>
                      
                      <Button 
                        size="sm"
                        onClick={() => handleResolve(sug.id, "approved")} 
                        className="h-8 rounded-lg text-xs bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                    </CardFooter>

                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}