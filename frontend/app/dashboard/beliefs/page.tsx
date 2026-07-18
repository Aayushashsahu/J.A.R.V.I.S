"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Star, Clock, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/toast";

interface Belief {
  id: string;
  belief_text: string;
  confidence: number;
  created_at: string;
  source_notes?: string;
}

export default function BeliefsPage() {
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBeliefs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/brain/beliefs");
      setBeliefs(response);
    } catch (err: any) {
      console.error("Failed to load beliefs", err);
      setError("Failed to sync neural beliefs. Check database connectivity.");
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

  const handleTuneConfidence = (text: string) => {
    toast({
      title: "Recalibration In Progress",
      description: `Initiated confidence realignment for: "${text.substring(0, 30)}..."`,
      variant: "info",
    });
  };

  const getConfidenceLevel = (score: number) => {
    if (score >= 85) return { text: "High Certainty", color: "bg-green-500/10 text-green-400 border-green-500/20" };
    if (score >= 60) return { text: "Moderate", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
    return { text: "Inductive Pattern", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
  };

  return (
    <div className="max-w-4xl mx-auto my-6 px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Neural Reflections & Beliefs
              <Sparkles className="w-4 h-4 text-primary" />
            </h2>
            <p className="text-sm text-muted-foreground">
              Patterns, guidelines, and rules J.A.R.V.I.S. has synthesized in this second brain database.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchBeliefs}
          className="flex items-center gap-1.5 border-white/10 text-xs h-8 px-3 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
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
          <p className="text-xs">Analyzing workspace beliefs structure...</p>
        </div>
      ) : beliefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 rounded-2xl bg-black/15">
          <div className="w-10 h-10 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-3">
            <Brain className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">No beliefs synthesized</h4>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            J.A.R.V.I.S. will write new long-term reflections as you upload guidelines and discuss them in chat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {beliefs.map((belief) => {
            const conf = getConfidenceLevel(belief.confidence);
            return (
              <Card
                key={belief.id}
                className="border border-white/10 bg-black/40 backdrop-blur-md hover:border-primary/40 hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden"
              >
                <CardContent className="pt-6 flex justify-between items-start gap-6">
                  <div className="space-y-4 flex-1">
                    <p className="text-sm font-medium text-foreground leading-relaxed italic">
                      "{belief.belief_text}"
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        Formed: {new Date(belief.created_at).toLocaleDateString()}
                      </span>
                      {belief.source_notes && (
                        <span className="bg-black/35 px-2 py-0.5 rounded border border-white/5 font-mono">
                          SRC: {belief.source_notes.substring(0, 30)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <Badge className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${conf.color}`}>
                      {conf.text}
                    </Badge>
                    <button
                      onClick={() => handleTuneConfidence(belief.belief_text)}
                      className="text-[10px] text-primary hover:underline bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg font-semibold"
                      type="button"
                    >
                      Calibrate ({belief.confidence}%)
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}