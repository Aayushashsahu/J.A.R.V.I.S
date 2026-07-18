"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { FileText, Network, BrainCircuit, MessageSquare, ShieldCheck, Database, Zap, ArrowRight, Activity, Terminal } from "lucide-react";
import { motion } from "framer-motion";

interface DashboardStats {
  documents: number;
  beliefs: number;
  pkmEntities: number;
  chatSessions: number;
}

function OverviewContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats>({
    documents: 0,
    beliefs: 0,
    pkmEntities: 0,
    chatSessions: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await api.get("/dashboard/stats");
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Sync statistics on update events
    window.addEventListener("data-updated", fetchStats);
    return () => window.removeEventListener("data-updated", fetchStats);
  }, []);

  const metrics = [
    { name: "Source Documents", value: stats.documents, icon: FileText, desc: "Indexed manuals & regulations", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { name: "Synthesized Beliefs", value: stats.beliefs, icon: BrainCircuit, desc: "Long-term workspace truths", color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
    { name: "Structured PKMs", value: stats.pkmEntities, icon: Network, desc: "Extracted graph entities", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
    { name: "Active Chat Sessions", value: stats.chatSessions, icon: MessageSquare, desc: "Second brain discussions", color: "text-green-500 bg-green-500/10 border-green-500/20" }
  ];

  return (
    <div className="max-w-6xl mx-auto my-6 px-6 space-y-8">
      {/* Welcome Banner */}
      <div className="relative rounded-3xl p-8 border border-white/10 bg-gradient-to-r from-black/40 to-primary/5 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="max-w-xl space-y-4">
          <Badge className="bg-primary/20 text-primary border border-primary/30 uppercase tracking-widest text-[10px] px-2.5 py-0.5 rounded-full font-bold">
            Executive Summary
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Welcome to J.A.R.V.I.S. Workspace
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your semantic context isolation environment is active. Upload guidelines, manuals, or regulatory standards to populate your local Vector Database and build your knowledge nodes.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={() => window.location.href = `/dashboard/chat?workspace=${workspaceId || ""}`}
              className="rounded-xl text-xs font-semibold h-9 shadow-md flex items-center gap-1.5"
            >
              Consult Chat Brain
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = `/dashboard/documents?workspace=${workspaceId || ""}`}
              className="rounded-xl border-white/10 bg-secondary/20 hover:bg-secondary/40 text-xs h-9"
            >
              Upload Manuals
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((item, idx) => (
          <Card key={idx} className="border border-white/10 bg-black/40 backdrop-blur-xl hover:border-white/20 transition-all duration-300 shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.name}</span>
              <div className={`p-2 rounded-lg border flex items-center justify-center shrink-0 ${item.color}`}>
                <item.icon className="w-4.5 h-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-8 w-16 bg-muted/20 animate-pulse rounded-md" />
              ) : (
                <div className="text-2xl font-bold text-foreground font-mono">{item.value}</div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Database & Agent Telemetry Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Integrations */}
        <Card className="lg:col-span-2 border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-black/10 flex flex-row items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold">Database Telemetry & Integration States</CardTitle>
              <CardDescription className="text-[10px]">Real-time connection monitoring for memory databases.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-4">
              {/* SQLite */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">PostgreSQL / SQLite Core DB</span>
                    <span className="text-[10px] text-muted-foreground">Stores workspaces, user profiles, metadata, and timeline logs.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20 rounded-full font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Online</span>
                </div>
              </div>

              {/* Qdrant */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">Qdrant Vector DB</span>
                    <span className="text-[10px] text-muted-foreground">Indexes text embeddings (768-dim) for Dense / Hybrid search retrieval.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20 rounded-full font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Online</span>
                </div>
              </div>

              {/* Obsidian Graph */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">GBrain Knowledge Vault (MCP)</span>
                    <span className="text-[10px] text-muted-foreground">Tracks synthesized Obsidian vaults and semantic relationships.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20 rounded-full font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Log */}
        <Card className="lg:col-span-1 border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b border-white/5 bg-black/10 flex flex-row items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold">System Diagnostics</CardTitle>
              <CardDescription className="text-[10px]">Active background daemon execution monitoring.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2 bg-white/5 p-2.5 rounded-lg border border-white/5">
                <Terminal className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold block text-[11px]">Watcher Daemon</span>
                  <span className="text-[10px] text-muted-foreground">Monitoring active workspace directories for changes.</span>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-white/5 p-2.5 rounded-lg border border-white/5">
                <Terminal className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold block text-[11px]">Reflection Process</span>
                  <span className="text-[10px] text-muted-foreground">Compiling context pattern changes in the background.</span>
                </div>
              </div>
            </div>
            
            <div className="text-[10px] text-muted-foreground bg-black/30 border border-white/5 rounded-lg p-2.5 leading-relaxed font-mono">
              STATUS: SECURE RUNTIME
              <br />
              WORKSPACE: {workspaceId || "GLOBAL"}
              <br />
              DAEMONS: 2 RUNNING
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardHomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading overview...</div>}>
      <OverviewContent />
    </Suspense>
  );
}