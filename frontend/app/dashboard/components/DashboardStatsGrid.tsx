import { Card, CardContent } from "@/components/ui/card";
import { FileText, BrainCircuit, Network, CheckCircle2 } from "lucide-react";

export interface DashboardStats {
  memory_count: number;
  beliefs_count: number;
  synapses_count: number;
}

export function DashboardStatsGrid({ stats }: { stats: DashboardStats }) {
  return (
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
  );
}
