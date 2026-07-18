"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Clock, CheckCircle, FileText, BrainCircuit, XCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get("/timeline");
      setData(response);
    } catch (err: any) {
      console.error("Failed to fetch timeline", err);
      setError("Failed to load timeline. Please check your database connection.");
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
        return <FileText className="w-4 h-4 text-yellow-400" />;
      case "reflection":
        return <BrainCircuit className="w-4 h-4 text-purple-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "creation":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "modification":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "reflection":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-white/5 text-muted-foreground border-white/10";
    }
  };

  const renderSection = (title: string, events: TimelineEvent[]) => {
    if (!events || events.length === 0) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase tracking-widest">{title}</h3>
        </div>

        <div className="relative border-l border-white/10 ml-3.5 space-y-6 pl-6">
          {events.map((event) => (
            <div key={event.id} className="relative group">
              {/* Dot Icon */}
              <div className="absolute -left-[31px] top-0 bg-background p-1.5 rounded-full border border-white/10 shadow-md transition-all group-hover:border-primary/50">
                {getIcon(event.event_type)}
              </div>
              
              <div className="glass-card border border-white/5 p-4 rounded-xl backdrop-blur-sm space-y-3 hover:border-white/15 transition-all duration-300">
                <div className="flex items-center justify-between gap-4">
                  <Badge className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border ${getBadgeColor(event.event_type)}`}>
                    {event.event_type}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground/90">{event.content}</p>
                <div className="text-[9px] text-muted-foreground font-mono">
                  REF: {event.id.substring(0, 8).toUpperCase()} · {new Date(event.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto my-6 px-6 text-center text-muted-foreground space-y-4 py-20">
        <div className="flex items-center justify-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <p className="text-xs">Accessing system diagnostics logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto my-6 px-6 text-center text-destructive space-y-4 py-20">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold">Diagnostic Failure</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
      </div>
    );
  }

  const isEmpty = !data || (data.today.length === 0 && data.this_week.length === 0 && data.older.length === 0);

  return (
    <div className="max-w-3xl mx-auto my-6 px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Clock className="w-6 h-6 animate-spin-slow" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Workspace Memory Audit Log
          </h2>
          <p className="text-sm text-muted-foreground">
            A chronological timeline audit of updates, extractions, and reflections compiled in this second brain.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed border-white/10 rounded-2xl bg-black/15">
          <div className="w-10 h-10 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center mb-3">
            <Info className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">No events recorded</h4>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            Daemon watches are running. Commits will appear here automatically when workspace documents are indexed.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {data && renderSection("Today", data.today)}
          {data && renderSection("This Week", data.this_week)}
          {data && renderSection("Older Logs", data.older)}
        </div>
      )}
    </div>
  );
}

// Badge helper wrapper
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${className}`}>
      {children}
    </span>
  );
}