import { Card, CardContent } from "@/components/ui/card";
import { FileText, Shield, Network, Wrench } from "lucide-react";

export interface DashboardStats {
  memory_count: number;
  beliefs_count: number;
  synapses_count: number;
}

export function DashboardStatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Documents Indexed */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-primary/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Documents Indexed</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.memory_count}</span>
            <span className="text-[10px] text-muted-foreground/80 block">Engineering docs & procedures</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Records */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-accent/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Compliance Records</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.beliefs_count}</span>
            <span className="text-[10px] text-muted-foreground/80 block">SOPs & safety procedures</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Shield className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Graph Entities */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-primary/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">KG Entities</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">{stats.synapses_count}</span>
            <span className="text-[10px] text-muted-foreground/80 block">Equipment, assets & relations</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Network className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Active Maintenance */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:border-emerald-500/20 hover-lift shadow-sm">
        <CardContent className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Maintenance Items</span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">12</span>
            <span className="text-[10px] text-muted-foreground/80 block">Scheduled & pending work orders</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wrench className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
