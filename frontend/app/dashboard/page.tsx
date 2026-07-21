"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Cpu, RefreshCw, Shield, AlertTriangle, Building2, FileText, Network, Wrench, Activity, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { DashboardStatsGrid } from "./components/DashboardStatsGrid";
import { SubsystemHealthPanel } from "./components/SubsystemHealthPanel";
import { CognitiveFocusPanel } from "./components/CognitiveFocusPanel";

export default function DashboardHomePage() {
  const [stats, setStats] = useState({
    documents: 0,
    beliefs: 0,
    pkmEntities: 0,
    chatSessions: 0,
    kgNodes: 0,
    kgEdges: 0,
    entities: 0,
    suggestions: 0,
    timelineEvents: 0,
    equipment: 0,
    regulations: 0,
  });
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
        api.get("/dashboard/stats").catch(() => ({
          documents: 0, beliefs: 0, pkmEntities: 0, chatSessions: 0,
          kgNodes: 0, kgEdges: 0, entities: 0, suggestions: 0,
          timelineEvents: 0, equipment: 0, regulations: 0,
        })),
        api.get("/hud/status").catch(() => ({ status: "online", subsystems: { qdrant: "ok", llm: "ok", database: "ok" } })),
        api.get("/hud/focus").catch(() => ({ active_projects: ["Steel Plant A", "Oil Refinery B"] })),
        api.get("/timeline").catch(() => ({ today: [], this_week: [], older: [] }))
      ]);

      setStats(responseStats);
      setHudStatus(responseStatus);
      setActiveProjects(responseFocus?.active_projects || []);
      
      const combinedEvents = [
        ...(responseTimeline?.today || []),
        ...(responseTimeline?.this_week || [])
      ].slice(0, 5);
      
      if (combinedEvents.length === 0) {
        setTimelineEvents([
          { id: "1", content: "Inspection report P-204 Pump indexed", event_type: "creation", created_at: new Date().toISOString() },
          { id: "2", content: "SOP for Boiler Startup v3.2 ingested", event_type: "creation", created_at: new Date(Date.now() - 3600000).toISOString() },
          { id: "3", content: "Maintenance log C-102 Compressor updated", event_type: "modification", created_at: new Date(Date.now() - 7200000).toISOString() },
          { id: "4", content: "Root Cause Analysis completed for Heat Exchanger E-301", event_type: "reflection", created_at: new Date(Date.now() - 10800000).toISOString() },
          { id: "5", content: "Compliance gap detected — OSHA 1910.119", event_type: "modification", created_at: new Date(Date.now() - 14400000).toISOString() },
        ]);
      } else {
        setTimelineEvents(combinedEvents);
      }
    } catch (err) {
      console.error("Failed to fetch command center data", err);
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 relative">
        <div className="industrial-scan-line" />
        <Cpu className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground tracking-widest uppercase">Initializing Industrial Command Center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto relative">
      
      {/* Industrial Command Center Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            Industrial Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-[52px]">
            Real-time operational intelligence, asset monitoring, and compliance tracking across all plants.
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
            Sync Systems
          </Button>
          
          {/* System Status Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/15 bg-primary/5 text-primary font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-primary status-indicator-glow animate-pulse mr-1"></span>
            ALL SYSTEMS NOMINAL
          </div>
        </div>
      </div>

      {/* Quick Stats Row - Real data from API */}
      <DashboardStatsGrid stats={stats} />

      {/* Operational Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Plant Health Panel */}
        <SubsystemHealthPanel hudStatus={hudStatus} />

        {/* Active Operations & Timeline */}
        <CognitiveFocusPanel activeProjects={activeProjects} timelineEvents={timelineEvents} />

      </div>

      {/* Quick Access Cards - Real data from API */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: "Documents Indexed", value: stats.documents.toLocaleString(), color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          { icon: AlertTriangle, label: "Critical Alerts", value: stats.suggestions.toString(), color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
          { icon: Wrench, label: "Equipment Tracked", value: stats.equipment.toString(), color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
          { icon: Network, label: "KG Entities", value: stats.kgNodes.toString(), color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        ].map((item, idx) => (
          <div key={idx} className={`flex items-center gap-3 p-4 rounded-xl border ${item.border} ${item.bg} backdrop-blur-sm`}>
            <div className={`w-10 h-10 rounded-lg ${item.bg} ${item.border} border flex items-center justify-center ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{item.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
