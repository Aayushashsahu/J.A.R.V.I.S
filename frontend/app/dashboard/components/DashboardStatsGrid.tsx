import { Card, CardContent } from "@/components/ui/card";
import { FileText, Shield, Network, Wrench, Cpu, AlertTriangle } from "lucide-react";

export interface DashboardStats {
  documents: number;
  beliefs: number;
  pkmEntities: number;
  chatSessions: number;
  kgNodes: number;
  kgEdges: number;
  entities: number;
  suggestions: number;
  timelineEvents: number;
  equipment: number;
  regulations: number;
}

export function DashboardStatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Documents Indexed */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-primary/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Documents Indexed</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.documents}</span>
            <span className="text-[10px] text-muted-foreground/80 block">Engineering docs & procedures</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Equipment Tracked */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-accent/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Equipment Tracked</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.equipment}</span>
            <span className="text-[10px] text-muted-foreground/80 block">Pumps, compressors, exchangers</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Wrench className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Graph Entities */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-primary/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">KG Entities</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.kgNodes}</span>
            <span className="text-[10px] text-muted-foreground/80 block">{stats.kgEdges} relationships mapped</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Network className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Compliance & Regulations */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-emerald-500/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Regulations Tracked</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.regulations}</span>
            <span className="text-[10px] text-muted-foreground/80 block">{stats.beliefs} compliance records</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
