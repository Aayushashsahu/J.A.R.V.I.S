"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Network, Sparkles, RefreshCw, Zap, Eye, ArrowRight, Circle, Link, Lightbulb, AlertCircle } from "lucide-react";

interface Connection { source: string; target: string; relationship: string; strength: number; insight: string; }
interface Insight { title: string; summary: string; entities_involved: string[]; action: string; }
interface NeuralData { nodes: any[]; edges: any[]; connections: Connection[]; insights: Insight[]; stats: { total_nodes: number; total_edges: number; new_edges_created: number; insights_generated: number; }; }

export default function NeuralPage() {
  const [neuralData, setNeuralData] = useState<NeuralData | null>(null);
  const [synthesis, setSynthesis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"discover" | "synthesize">("discover");

  const fetchConnections = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const token = localStorage.getItem("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${API_URL}/neural/connections`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setNeuralData(await res.json());
    } catch (err: any) { setError(err.message); } finally { setIsLoading(false); }
  }, []);

  const fetchSynthesis = useCallback(async () => {
    setIsSynthesizing(true); setError(null);
    try {
      const token = localStorage.getItem("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${API_URL}/neural/synthesize`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setSynthesis(await res.json());
    } catch (err: any) { setError(err.message); } finally { setIsSynthesizing(false); }
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Neural Connections</h1>
            <p className="text-xs text-muted-foreground">AI-powered autonomous knowledge discovery</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchConnections} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Discover
          </Button>
          <Button size="sm" onClick={fetchSynthesis} disabled={isSynthesizing} className="gap-1.5 bg-primary text-primary-foreground">
            <Sparkles className={`w-3.5 h-3.5 ${isSynthesizing ? "animate-pulse" : ""}`} />
            {isSynthesizing ? "Synthesizing..." : "Synthesize"}
          </Button>
        </div>
      </div>

      {neuralData?.stats && (
        <div className="grid grid-cols-4 gap-4">
          {[{ label: "Nodes", value: neuralData.stats.total_nodes, icon: Circle },
            { label: "Edges", value: neuralData.stats.total_edges, icon: Link },
            { label: "New Connections", value: neuralData.stats.new_edges_created, icon: Zap },
            { label: "Insights", value: neuralData.stats.insights_generated, icon: Lightbulb }
          ].map((stat) => (
            <Card key={stat.label} className="border-border/40 bg-card/25">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
                <div><p className="text-lg font-bold">{stat.value}</p><p className="text-[10px] text-muted-foreground">{stat.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary/50 border border-border/40 max-w-xs">
        <button onClick={() => setActiveTab("discover")} className={`py-2 rounded-lg text-xs font-medium transition-all ${activeTab === "discover" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Eye className="w-3.5 h-3.5 inline mr-1.5" /> Discover Connections
        </button>
        <button onClick={() => setActiveTab("synthesize")} className={`py-2 rounded-lg text-xs font-medium transition-all ${activeTab === "synthesize" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Brain className="w-3.5 h-3.5 inline mr-1.5" /> Synthesis Digest
        </button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-2 text-destructive text-xs"><AlertCircle className="w-4 h-4" /> {error}</CardContent>
        </Card>
      )}

      {activeTab === "discover" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/40 bg-card/25">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Link className="w-4 h-4 text-primary" /> Discovered Connections</CardTitle>
              <CardDescription className="text-[10px]">AI-discovered semantic relationships</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {neuralData?.connections?.length ? (
                  <div className="space-y-3">
                    {neuralData.connections.map((conn, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-border/30 bg-secondary/15 space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-[9px]">{conn.source}</Badge>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-[9px]">{conn.target}</Badge>
                          <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">{conn.relationship}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{conn.insight}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${conn.strength}%` }} />
                          </div>
                          <span className="text-[9px] font-medium text-muted-foreground">{conn.strength}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-3">
                    <Network className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Upload documents and click Discover to find neural connections</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/25">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Neural Insights</CardTitle>
              <CardDescription className="text-[10px]">Proactive intelligence from your knowledge graph</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {neuralData?.insights?.length ? (
                  <div className="space-y-3">
                    {neuralData.insights.map((insight, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                        <h4 className="text-xs font-semibold">{insight.title}</h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.summary}</p>
                        {insight.action && (<div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-medium"><Zap className="w-3 h-3" /> {insight.action}</div>)}
                        {insight.entities_involved?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {insight.entities_involved.map((e, i) => (<Badge key={i} variant="outline" className="text-[9px]">{e}</Badge>))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-3">
                    <Lightbulb className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Run Discovery to generate neural insights</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "synthesize" && (
        <Card className="border-border/40 bg-card/25">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Knowledge Synthesis Digest</CardTitle>
            <CardDescription className="text-[10px]">AI-generated analysis of your entire knowledge base</CardDescription>
          </CardHeader>
          <CardContent>
            {synthesis ? (
              <div className="space-y-6">
                {synthesis.themes?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Circle className="w-3 h-3 text-primary" /> Key Themes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {synthesis.themes.map((theme: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl border border-border/30 bg-secondary/15">
                          <h4 className="text-xs font-semibold mb-1">{theme.name}</h4>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{theme.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {synthesis.actions?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-500" /> Recommended Actions</h3>
                    <div className="space-y-2">
                      {synthesis.actions.map((action: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-2">
                          <Badge className="text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/20 mt-0.5">{action.priority}</Badge>
                          <div><p className="text-xs font-medium">{action.action}</p><p className="text-[10px] text-muted-foreground">{action.why}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {synthesis.gaps?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-orange-500" /> Knowledge Gaps</h3>
                    <div className="space-y-2">
                      {synthesis.gaps.map((gap: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl border border-orange-500/20 bg-orange-500/5">
                          <p className="text-xs font-medium">{gap.topic}</p>
                          <p className="text-[10px] text-muted-foreground">{gap.why_needed}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-3">
                <Brain className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Click Synthesize to generate a comprehensive knowledge digest</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
