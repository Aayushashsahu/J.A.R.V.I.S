"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Clock, CheckCircle, FileText, BrainCircuit, Activity, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TimelineEvent {
  id: string;
  event_type: string;
  content: string;
  created_at: string;
}

interface TimelineData {
  today: TimelineEvent[];
  this_week: TimelineEvent[];
  older: TimelineEvent[];
}

export default function TimelinePage() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/timeline");
      setData(response);
    } catch (err) {
      console.error("Failed to fetch timeline", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();

    const handleRefresh = () => {
      fetchTimeline();
    };

    window.addEventListener("data-updated", handleRefresh);
    return () => {
      window.removeEventListener("data-updated", handleRefresh);
    };
  }, [fetchTimeline]);

  const getIcon = (type: string) => {
    switch (type) {
      case "creation":
        return <FileText className="w-4 h-4 text-blue-400" />;
      case "modification":
        return <FileText className="w-4 h-4 text-amber-400" />;
      case "reflection":
        return <BrainCircuit className="w-4 h-4 text-purple-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-muted-foreground/60" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Activity className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground tracking-widest uppercase">Retrieving memory timeline...</span>
      </div>
    );
  }

  const renderSection = (title: string, events: TimelineEvent[]) => {
    if (!events || events.length === 0) return null;

    return (
      <div className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 px-1">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          {title}
        </h3>
        
        <div className="relative border-l border-border/40 ml-4 pl-6 space-y-6">
          {events.map((event) => (
            <div key={event.id} className="relative group">
              
              {/* Timeline dot icon bubble indicator */}
              <div className="absolute -left-[35px] top-0 bg-background p-1.5 rounded-full border border-border/60 shadow-sm flex items-center justify-center transition-all group-hover:border-foreground/20">
                {getIcon(event.event_type)}
              </div>

              {/* Event card details */}
              <div className="bg-card/25 border border-border/40 hover:border-foreground/10 hover-lift p-4 rounded-xl shadow-sm transition-all space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs font-semibold text-foreground/90 leading-relaxed">{event.content}</p>
                  
                  <Badge variant="outline" className="capitalize font-mono text-[8px] px-1.5 py-0 rounded shrink-0 border-border bg-secondary/35 text-muted-foreground">
                    {event.event_type}
                  </Badge>
                </div>
                
                <span className="text-[10px] text-muted-foreground block font-mono">
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>

            </div>
          ))}
        </div>
      </div>
    );
  };

  const hasEvents = data && (data.today.length > 0 || data.this_week.length > 0 || data.older.length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Memory Timeline</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track the sequential evolution and synapses formations of your Second Brain.</p>
          </div>
        </div>
      </div>

      {hasEvents && data ? (
        <div className="space-y-10 pt-4">
          {renderSection("Today", data.today)}
          {renderSection("This Week", data.this_week)}
          {renderSection("Older Events", data.older)}
        </div>
      ) : (
        <div className="border border-border/40 bg-card/25 rounded-2xl p-10 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3 min-h-[250px] shadow-sm">
          <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold">No memory events logged yet.</p>
          <p className="text-xs text-muted-foreground/80 max-w-sm leading-normal">
            Memory events are logged when you ingest documents, run reflections, or execute agent planning.
          </p>
        </div>
      )}

    </div>
  );
}