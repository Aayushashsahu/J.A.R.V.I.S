import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, Factory, Shield, FileText, Activity, CheckCircle } from "lucide-react";

export interface TimelineEvent {
  id: string;
  content: string;
  event_type: string;
  created_at: string;
}

export interface CognitiveFocusPanelProps {
  activeProjects: string[];
  timelineEvents: TimelineEvent[];
}

export function CognitiveFocusPanel({ activeProjects, timelineEvents }: CognitiveFocusPanelProps) {
  return (
    <Card className="bg-card/20 border-border/40 shadow-sm lg:col-span-2 space-y-6">
      <CardHeader className="border-b border-border/30 pb-4">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          Active Plants & Recent Activity
        </CardTitle>
        <CardDescription className="text-xs">Monitored facilities and ingestion stream</CardDescription>
      </CardHeader>

      <CardContent className="p-5 space-y-6">

        {/* Active Plants */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Monitored Facilities</span>
          <div className="flex flex-wrap gap-2">
            {activeProjects.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">No plants registered. Upload documents to begin monitoring.</span>
            ) : (
              activeProjects.map((proj, idx) => (
                <Badge key={idx} variant="secondary" className="bg-secondary/60 text-foreground border border-border/40 hover:bg-secondary py-1 px-2.5 rounded-lg text-xs flex items-center gap-1.5">
                  <Factory className="w-3 h-3 text-primary" />
                  {proj}
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Stream */}
        <div className="space-y-4 pt-4 border-t border-border/30">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Recent Operations Activity</span>

          <div className="space-y-3.5">
            {timelineEvents.map((evt) => (
              <div key={evt.id} className="flex gap-3 items-start text-xs border-b border-border/20 pb-3 last:border-0 last:pb-0">
                <div className="mt-0.5 w-6 h-6 rounded-md bg-secondary/80 flex items-center justify-center shrink-0 border border-border/40">
                  {evt.event_type === "reflection" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : evt.event_type === "creation" ? (
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
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

        {/* AI Agent Status */}
        <div className="pt-4 border-t border-border/30 space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Industrial AI Agent</span>
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-secondary/10 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-semibold">Copilot Engine: READY</span>
            </div>
            <span className="text-muted-foreground text-[11px]">Awaiting operator queries</span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
