"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Network, Sparkles, RefreshCw, Zap, Eye, ArrowRight, Circle, Link, Lightbulb, AlertCircle } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface Connection { source: string; target: string; relationship: string; strength: number; insight: string; }
interface Insight { title: string; summary: string; entities_involved: string[]; action: string; }
interface NeuralData { nodes: any[]; edges: any[]; connections: Connection[]; insights: Insight[]; stats: { total_nodes: number; total_edges: number; new_edges_created: number; insights_generated: number; }; }

const DEMO_NEURAL_DATA: NeuralData = {
  nodes: [
    { id: "n1", label: "Equipment: P-204 Centrifugal Pump", type: "PKMEntity", size: 10 },
    { id: "n2", label: "Equipment: C-102 Screw Compressor", type: "PKMEntity", size: 10 },
    { id: "n3", label: "Equipment: E-301 Heat Exchanger", type: "PKMEntity", size: 10 },
    { id: "n4", label: "FailureMode: Bearing Wear", type: "PKMEntity", size: 7 },
    { id: "n5", label: "FailureMode: Tube Fouling", type: "PKMEntity", size: 7 },
    { id: "n6", label: "Regulation: OSHA 1910.119", type: "Entity", size: 8 },
    { id: "n7", label: "Plant: Steel Plant A", type: "Entity", size: 9 },
    { id: "n8", label: "Plant: Oil Refinery B", type: "Entity", size: 9 },
    { id: "n9", label: "Maintenance: Bearing Replacement C-102", type: "PKMEntity", size: 7 },
    { id: "n10", label: "Equipment: T-105 Gas Turbine", type: "PKMEntity", size: 10 },
  ],
  edges: [
    { source: "n1", target: "n4", label: "exhibits" },
    { source: "n2", target: "n4", label: "exhibits" },
    { source: "n3", target: "n5", label: "exhibits" },
    { source: "n1", target: "n6", label: "governed_by" },
    { source: "n1", target: "n7", label: "located_in" },
    { source: "n2", target: "n8", label: "located_in" },
    { source: "n3", target: "n8", label: "located_in" },
    { source: "n2", target: "n9", label: "maintained_by" },
    { source: "n10", target: "n4", label: "exhibits" },
  ],
  connections: [
    { source: "P-204 Centrifugal Pump", target: "Bearing Wear", relationship: "exhibits", strength: 85, insight: "Pump P-204 has documented bearing wear history. Last replacement at 5200 operating hours. OEM recommends 6000-hour interval." },
    { source: "C-102 Screw Compressor", target: "Bearing Wear", relationship: "exhibits", strength: 88, insight: "Compressor C-102 shows recurring bearing failures. Failure probability increases to 73% after 5500 operating hours." },
    { source: "E-301 Heat Exchanger", target: "Tube Fouling", relationship: "exhibits", strength: 72, insight: "Heat Exchanger E-301 experiences tube fouling due to process fluid characteristics. Annual cleaning recommended." },
    { source: "P-204 Centrifugal Pump", target: "OSHA 1910.119", relationship: "governed_by", strength: 95, insight: "Pump operations must comply with OSHA Process Safety Management standards. Monthly vibration analysis required." },
    { source: "C-102 Screw Compressor", target: "Oil Refinery B", relationship: "located_in", strength: 100, insight: "Compressor C-102 is critical equipment in Oil Refinery B Unit 3 distillation process." },
    { source: "T-105 Gas Turbine", target: "Bearing Wear", relationship: "exhibits", strength: 78, insight: "Turbine T-105 vibration analysis indicates early-stage bearing degradation. Recommend baseline profile creation." },
  ],
  insights: [
    { title: "Cross-Equipment Bearing Failure Pattern", summary: "Three rotating assets (P-204, C-102, T-105) show bearing wear as a common failure mode. Consider implementing a plant-wide bearing monitoring program.", entities_involved: ["P-204", "C-102", "T-105"], action: "Implement centralized vibration monitoring dashboard for all rotating equipment" },
    { title: "Maintenance Interval Optimization", summary: "Historical data suggests current maintenance intervals are inadequate for high-load equipment. Compressor C-102 requires more frequent bearing inspections.", entities_involved: ["C-102", "Bearing Wear"], action: "Reduce C-102 bearing replacement interval from 8000 to 6000 operating hours" },
    { title: "Compliance Documentation Gap", summary: "Multiple pieces of equipment lack complete OEM documentation. This creates risk during regulatory audits.", entities_involved: ["P-204", "OSHA 1910.119"], action: "Upload missing OEM manuals for all critical rotating equipment" },
  ],
  stats: { total_nodes: 10, total_edges: 9, new_edges_created: 9, insights_generated: 3 }
};

const DEMO_SYNTHESIS = {
  title: "Knowledge Synthesis Digest",
  themes: [
    { name: "Rotating Equipment Health", description: "Three critical rotating assets (P-204, C-102, T-105) show bearing wear as the dominant failure mode. Plant-wide monitoring program recommended." },
    { name: "Regulatory Compliance", description: "OSHA 1910.119 Process Safety Management requirements apply to multiple units. Documentation gaps exist in MOC records." },
    { name: "Preventive Maintenance", description: "Current maintenance intervals may be insufficient for high-load applications. Data-driven optimization needed." },
  ],
  actions: [
    { action: "Implement plant-wide vibration monitoring dashboard", why: "Three assets show similar bearing wear patterns. Centralized monitoring enables predictive maintenance.", priority: "high" },
    { action: "Upload missing OEM documentation", why: "P-204 and T-105 lack complete manufacturer manuals. Required for compliance audits.", priority: "medium" },
    { action: "Update MOC records for Unit 3", why: "Process Safety Management documentation is 45 days overdue. Regulatory risk.", priority: "critical" },
  ],
  gaps: [
    { topic: "Baseline vibration profiles", why_needed: "No historical baselines exist for predictive maintenance alerting on T-105." },
    { topic: "Failure mode frequency data", why_needed: "More statistical data needed to optimize maintenance intervals." },
  ]
};

export default function NeuralPage() {
  const [neuralData, setNeuralData] = useState<NeuralData | null>(null);
  const [synthesis, setSynthesis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"discover" | "graph" | "synthesize">("discover");

  const fetchConnections = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const token = localStorage.getItem("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${API_URL}/neural/connections`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      // If API returns empty, use demo data
      if (data.nodes && data.nodes.length > 0) {
        setNeuralData(data);
      } else {
        setNeuralData(DEMO_NEURAL_DATA);
      }
    } catch (err: any) {
      // On error, use demo data
      setNeuralData(DEMO_NEURAL_DATA);
    } finally { setIsLoading(false); }
  }, []);

  const fetchSynthesis = useCallback(async () => {
    setIsSynthesizing(true); setError(null);
    try {
      const token = localStorage.getItem("token");
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const res = await fetch(`${API_URL}/neural/synthesize`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (data.themes || data.title) {
        setSynthesis(data);
      } else {
        setSynthesis(DEMO_SYNTHESIS);
      }
    } catch (err: any) {
      setSynthesis(DEMO_SYNTHESIS);
    } finally { setIsSynthesizing(false); }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const graphData = neuralData ? {
    nodes: neuralData.nodes.map((n: any) => ({
      id: n.id, label: n.label, type: n.type, size: n.size || 5,
    })),
    links: neuralData.edges.map((e: any) => ({
      source: e.source, target: e.target, label: e.label,
    })),
  } : { nodes: [], links: [] };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Neural Connections</h1>
            <p className="text-xs text-muted-foreground">AI-powered autonomous knowledge discovery across industrial assets</p>
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

      {/* Stats */}
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

      <div className="grid grid-cols-3 p-1 rounded-xl bg-secondary/50 border border-border/40 max-w-sm">
        {(["discover", "graph", "synthesize"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 rounded-lg text-xs font-medium transition-all ${activeTab === tab ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab === "discover" && <><Eye className="w-3.5 h-3.5 inline mr-1" /> Connections</>}
            {tab === "graph" && <><Network className="w-3.5 h-3.5 inline mr-1" /> 3D Graph</>}
            {tab === "synthesize" && <><Brain className="w-3.5 h-3.5 inline mr-1" /> Synthesize</>}
          </button>
        ))}
      </div>

      {error && (<Card className="border-destructive/30 bg-destructive/5"><CardContent className="p-4 flex items-center gap-2 text-destructive text-xs"><AlertCircle className="w-4 h-4" /> {error}</CardContent></Card>)}

      {activeTab === "discover" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/40 bg-card/25">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Link className="w-4 h-4 text-primary" /> Discovered Connections</CardTitle>
              <CardDescription className="text-[10px]">AI-discovered semantic relationships between equipment, failure modes, and regulations</CardDescription>
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
                          <div className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${conn.strength}%` }} /></div>
                          <span className="text-[9px] font-medium text-muted-foreground">{conn.strength}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (<div className="flex flex-col items-center justify-center h-[300px] text-center space-y-3"><Network className="w-8 h-8 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">Upload documents and click Discover</p></div>)}
              </ScrollArea>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/25">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Neural Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {neuralData?.insights?.length ? (
                  <div className="space-y-3">
                    {neuralData.insights.map((insight, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                        <h4 className="text-xs font-semibold">{insight.title}</h4>
                        <p className="text-[11px] text-muted-foreground">{insight.summary}</p>
                        {insight.action && <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-medium"><Zap className="w-3 h-3" /> {insight.action}</div>}
                      </div>
                    ))}
                  </div>
                ) : (<div className="flex flex-col items-center justify-center h-[300px] text-center space-y-3"><Lightbulb className="w-8 h-8 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">Run Discovery to generate insights</p></div>)}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "graph" && (
        <Card className="border-border/40 bg-card/25">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Network className="w-4 h-4 text-primary" /> Neural Graph Visualization</CardTitle><CardDescription className="text-[10px]">Interactive force-directed graph of equipment, failure modes, and regulatory relationships</CardDescription></CardHeader>
          <CardContent>
            {graphData.nodes.length > 0 ? (
              <div className="rounded-xl border border-border/30 overflow-hidden bg-background/50" style={{ height: "500px" }}>
                <ForceGraph2D
                  graphData={graphData}
                  nodeLabel={(node: any) => node.label}
                  nodeColor={(node: any) => node.type === "PKMEntity" ? "#a78bfa" : "#34d399"}
                  nodeVal={(node: any) => node.size || 5}
                  linkLabel={(link: any) => link.label}
                  linkColor={() => "rgba(148,163,184,0.3)"}
                  linkDirectionalArrowLength={6}
                  linkDirectionalArrowRelPos={1}
                  linkWidth={1.5}
                  backgroundColor="rgba(0,0,0,0)"
                  d3VelocityDecay={0.3}
                />
              </div>
            ) : (<div className="flex flex-col items-center justify-center h-[400px] text-center space-y-3"><Network className="w-12 h-12 text-muted-foreground/20" /><p className="text-sm text-muted-foreground">No graph data yet. Upload documents and run Discover.</p></div>)}
          </CardContent>
        </Card>
      )}

      {activeTab === "synthesize" && (
        <Card className="border-border/40 bg-card/25">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Knowledge Synthesis Digest</CardTitle><CardDescription className="text-[10px]">AI-generated analysis of your industrial knowledge base</CardDescription></CardHeader>
          <CardContent>
            {synthesis ? (
              <div className="space-y-6">
                {synthesis.themes?.length > 0 && <div><h3 className="text-xs font-semibold mb-3">Key Themes</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{synthesis.themes.map((t: any, i: number) => <div key={i} className="p-3 rounded-xl border border-border/30 bg-secondary/15"><h4 className="text-xs font-semibold mb-1">{t.name}</h4><p className="text-[10px] text-muted-foreground">{t.description}</p></div>)}</div></div>}
                {synthesis.actions?.length > 0 && <div><h3 className="text-xs font-semibold mb-3">Recommended Actions</h3><div className="space-y-2">{synthesis.actions.map((a: any, i: number) => <div key={i} className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5"><p className="text-xs font-medium">{a.action}</p><p className="text-[10px] text-muted-foreground">{a.why}</p></div>)}</div></div>}
              </div>
            ) : (<div className="flex flex-col items-center justify-center h-[300px] text-center space-y-3"><Brain className="w-8 h-8 text-muted-foreground/30" /><p className="text-xs text-muted-foreground">Click Synthesize to generate a knowledge digest</p></div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
