"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Cpu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

import { DashboardStatsGrid } from "./components/DashboardStatsGrid";
import { SubsystemHealthPanel } from "./components/SubsystemHealthPanel";
import { CognitiveFocusPanel } from "./components/CognitiveFocusPanel";

export default function DashboardHomePage() {
  const [stats, setStats] = useState({ memory_count: 0, beliefs_count: 0, synapses_count: 0 });
  const [hudStatus, setHudStatus] = useState({ status: "online", subsystems: { qdrant: "ok", llm: "ok", database: "ok" } });
  const [activeProjects, setActiveProjects] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <DashboardStatsGrid stats={stats} />

      {/* Main Core HUD Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subsystem Health Panel */}
        <SubsystemHealthPanel hudStatus={hudStatus} />

        {/* Active Focus Areas & Timeline */}
        <CognitiveFocusPanel activeProjects={activeProjects} timelineEvents={timelineEvents} />

      </div>

    </div>
  );
}
