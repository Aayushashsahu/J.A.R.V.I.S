import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertCircle } from "lucide-react";

export interface SubsystemHealthPanelProps {
  hudStatus: {
    status: string;
    subsystems: {
      qdrant: string;
      llm: string;
      database: string;
    };
  };
}

export function SubsystemHealthPanel({ hudStatus }: SubsystemHealthPanelProps) {
  return (
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
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
              {hudStatus.subsystems.qdrant.toUpperCase() === "OK" ? "OPERATIONAL" : hudStatus.subsystems.qdrant.toUpperCase()}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-secondary/15 text-xs">
            <span className="font-medium text-foreground/80">Cognitive LLM Broker</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
              {hudStatus.subsystems.llm.toUpperCase() === "OK" ? "OPERATIONAL" : hudStatus.subsystems.llm.toUpperCase()}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-secondary/15 text-xs">
            <span className="font-medium text-foreground/80">Relational Store (SQLite)</span>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
              {hudStatus.subsystems.database.toUpperCase() === "OK" ? "OPERATIONAL" : hudStatus.subsystems.database.toUpperCase()}
            </Badge>
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
  );
}
