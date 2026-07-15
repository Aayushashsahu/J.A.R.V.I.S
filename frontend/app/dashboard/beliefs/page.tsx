"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <div className="space-y-8 max-w-4xl pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Reflections & Beliefs
        </h2>
        <p className="text-muted-foreground mt-2">
          These are the high-level beliefs and reflections J.A.R.V.I.S. has formed about you based on your recent activity.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></span></div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {beliefs.length === 0 && <p className="text-muted-foreground text-center p-10 border border-dashed border-white/10 rounded-xl">No beliefs generated yet. Add some documents or chat with your Second Brain.</p>}
          {beliefs.map((belief: any) => (
            <Card key={belief.id} className="bg-black/40 backdrop-blur-md border-white/10 hover:border-primary/50 transition-colors shadow-xl">
              <CardContent className="pt-6 flex justify-between items-start">
                <div className="pr-4">
                  <p className="text-lg text-foreground font-medium leading-relaxed">
                    "{belief.belief_text}"
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                    Formed on: {new Date(belief.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={belief.confidence > 80 ? "default" : "secondary"} className="shrink-0">
                  {belief.confidence}% Confidence
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}