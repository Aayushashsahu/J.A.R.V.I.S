"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Calendar, ShieldCheck, Sparkles, Activity, AlertCircle } from "lucide-react";

export default function BeliefsPage() {
  const [beliefs, setBeliefs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBeliefs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/brain/beliefs");
      setBeliefs(response);
    } catch (err) {
      console.error("Failed to load beliefs", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeliefs();

    const handleRefresh = () => {
      fetchBeliefs();
    };

    window.addEventListener("data-updated", handleRefresh);
    return () => {
      window.removeEventListener("data-updated", handleRefresh);
    };
  }, [fetchBeliefs]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Compliance & SOPs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Safety procedures, compliance records, and operational standards tracked by J.A.R.V.I.S.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Loading compliance records...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {beliefs.length === 0 ? (
            <div className="border border-border/40 bg-card/25 rounded-2xl p-10 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3 min-h-[250px] shadow-sm">
              <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold">No compliance records found.</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm leading-normal">
                Upload safety procedures, SOPs, or maintenance documents to populate compliance tracking.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {beliefs.map((belief: any) => {
                const confColor = belief.confidence > 80 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20";
                
                return (
                  <Card key={belief.id} className="bg-card/25 border-border/40 hover:border-foreground/10 hover-lift shadow-sm rounded-xl overflow-hidden flex flex-col justify-between">
                    <CardContent className="pt-5 space-y-4">
                      
                      {/* Badge and confidence */}
                      <div className="flex justify-between items-start gap-4">
                        <Badge variant="outline" className={`shrink-0 font-mono text-[9px] px-2 py-0.5 rounded-md ${confColor}`}>
                          {belief.confidence}% Confidence
                        </Badge>
                        <ShieldCheck className="w-4 h-4 text-muted-foreground/45 shrink-0" />
                      </div>

                      {/* Belief Text */}
                      <p className="text-xs font-medium text-foreground leading-relaxed italic">
                        "{belief.belief_text}"
                      </p>

                    </CardContent>

                    {/* Footer Info */}
                    <div className="px-5 py-3.5 bg-secondary/15 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground/70">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/50" />
                        Created: {new Date(belief.created_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Compliance Record
                      </div>
                    </div>

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