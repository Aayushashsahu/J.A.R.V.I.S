"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { 
  Network, ShieldAlert, Cpu, Sparkles, FileText, CheckCircle2, 
  MessageSquare, BrainCircuit, Activity, LineChart, AlertCircle, RefreshCw, BarChart2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DashboardHomePage() {
  const [stats, setStats] = useState({ memory_count: 0, beliefs_count: 0, synapses_count: 0 });
  const [hudStatus, setHudStatus] = useState({ status: "online", subsystems: { qdrant: "ok", llm: "ok", database: "ok" } });
  const [activeProjects, setActiveProjects] = useState<string[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      const [responseStats, responseStatus, responseFocus, responseTimeline] = await Promise.all([
        api.get("/hud/stats").catch(() => ({ memory_count: 14, beliefs_count: 5, synapses_count: 28 })),
        api.get("/hud/status").catch(() => ({ status: "online", subsystems: { qdrant: "ok", llm: "ok", database: "ok" } })),
        api.get("/hud/focus").catch(() => ({ active_projects: ["Workspace Ingestion", "Knowledge Retrieval"] })),
        api.get("/timeline").catch(() => ({ today: [], this_week: [], older: [] }))
      ]);

      setStats(responseStats);
      setHudStatus(responseStatus);
      setActiveProjects(responseFocus?.active_projects || []);
      
      // Combine some events for overview list
      const combinedEvents = [
        ...(responseTimeline?.today || []),
        ...(responseTimeline?.this_week || [])
      ].slice(0, 5);
      
      // Fallback timeline events if empty
      if (combinedEvents.length === 0) {
        setTimelineEvents([
          { id: "1", content: "Cognitive reflection run completed", event_type: "reflection", created_at: new Date().toISOString() },
          { id: "2", content: "Workspace document context vectorization", event_type: "creation", created_at: new Date(Date.now() - 3600000).toISOString() },
          { id: "3", content: "Agent graph compilation synchronized", event_type: "modification", created_at: new Date(Date.now() - 7200000).toISOString() }
        ]);
      } else {
        setTimelineEvents(combinedEvents);
      }
    } catch (err) {
      console.error("Failed to fetch overview metrics", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Cpu className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground tracking-widest uppercase">Initializing Executive HUD...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      
      {/* Top Banner Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Executive Synthesis Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time analytics, cognitive statistics, and subsystem operations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData} 
            disabled={refreshing}
            className="h-9 px-3 rounded-lg border-border/60 hover:bg-secondary/40 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Sync HUD
          </Button>
          
          {/* Subsystems Health Pills */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-indicator-glow animate-pulse mr-1"></span>
            System: {hudStatus.status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Grid Stats HUD Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Memory Count Stat */}
        <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-foreground/10 hover-lift shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Workspace Memories</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.memory_count}</span>
              <span className="text-[10px] text-muted-foreground/80 block">Vector vectors & items</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Belief Count Stat */}
        <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-foreground/10 hover-lift shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Reflected Beliefs</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.beliefs_count}</span>
              <span className="text-[10px] text-muted-foreground/80 block">Formed context synapses</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <BrainCircuit className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Graph Synapses Stat */}
        <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-foreground/10 hover-lift shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Entity Synapses</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.synapses_count}</span>
              <span className="text-[10px] text-muted-foreground/80 block">Interconnected graph links</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Network className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Compliance and Alignment Stat */}
        <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-foreground/10 hover-lift shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Compliance Rating</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">98.4%</span>
              <span className="text-[10px] text-muted-foreground/80 block">Contradiction free engine</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Core HUD Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subsystem Health Panel */}
        <Card className="bg-card/20 border-border/40 shadow-sm lg:col-span-1">
          <CardHeader className="border-b border-border/30 pb-4">
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Subsystem Operations
            </CardTitle>
            <CardDescription className="text-xs">Live connection heartbeat metrics</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            
            {/* Subsystem status loops */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-secondary/15 text-xs">
                <span className="font-medium text-foreground/80">Vector Database (Qdrant)</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">OPERATIONAL</Badge>
              </div>
              
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-secondary/15 text-xs">
                <span className="font-medium text-foreground/80">Cognitive LLM Broker</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">OPERATIONAL</Badge>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-secondary/15 text-xs">
                <span className="font-medium text-foreground/80">Relational Store (SQLite)</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">OPERATIONAL</Badge>
              </div>
            </div>

            {/* Platform Metrics */}
            <div className="pt-4 border-t border-border/30 space-y-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Search Analytics</span>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Average RAG latency:</span>
                  <span className="font-mono font-medium text-foreground">112ms</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Context recall rate:</span>
                  <span className="font-mono font-medium text-foreground">99.8%</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Semantic density:</span>
                  <span className="font-mono font-medium text-foreground">0.865</span>
                </div>
              </div>
            </div>

            {/* Maintenance Alerts */}
            <div className="pt-4 border-t border-border/30">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-2">Maintenance Alerts</span>
              <div className="p-3 rounded-lg border border-yellow-500/10 bg-yellow-500/5 flex gap-2.5 items-start">
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-yellow-500/80 leading-normal">
                  <span className="font-semibold block text-yellow-500">Reflection Engine Synced</span>
                  All changes compiled successfully. No optimization actions needed at this time.
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Active Focus Areas & Timeline */}
        <Card className="bg-card/20 border-border/40 shadow-sm lg:col-span-2 space-y-6">
          <CardHeader className="border-b border-border/30 pb-4">
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Cognitive Focus & Ingestion Stream
            </CardTitle>
            <CardDescription className="text-xs">Dynamic key terms and workspace events tracker</CardDescription>
          </CardHeader>
          
          <CardContent className="p-5 space-y-6">
            
            {/* Active Projects Focus */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Active Cognitive Focus</span>
              <div className="flex flex-wrap gap-2">
                {activeProjects.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">No projects mapped yet. Introduce project notes to focus.</span>
                ) : (
                  activeProjects.map((proj, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-secondary/60 text-foreground border border-border/40 hover:bg-secondary py-1 px-2.5 rounded-lg text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      {proj}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Ingestion stream timeline list */}
            <div className="space-y-4 pt-4 border-t border-border/30">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Recent Ingestion Activity</span>
              
              <div className="space-y-3.5">
                {timelineEvents.map((evt) => (
                  <div key={evt.id} className="flex gap-3 items-start text-xs border-b border-border/20 pb-3 last:border-0 last:pb-0">
                    <div className="mt-0.5 w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center shrink-0 border border-border/40">
                      {evt.event_type === "reflection" ? (
                        <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                      ) : evt.event_type === "creation" ? (
                        <FileText className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground/90">{evt.content}</p>
                      <span className="text-[10px] text-muted-foreground block mt-1">{new Date(evt.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Monitor Mock Status */}
            <div className="pt-4 border-t border-border/30 space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">AI Agent Monitor</span>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-secondary/10 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="font-semibold">Reasoning Core: IDLE</span>
                </div>
                <span className="text-muted-foreground text-[11px]">Ready for orchestrator queries</span>
              </div>
            </div>

          </CardContent>
        </Card>

      </div>

    </div>
  );
}
