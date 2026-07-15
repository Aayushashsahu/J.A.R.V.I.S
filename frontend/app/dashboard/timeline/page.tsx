"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Clock, CheckCircle, FileText, BrainCircuit } from "lucide-react";

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
    // Initial fetch
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
        return <FileText className="w-5 h-5 text-blue-400" />;
      case "modification":
        return <FileText className="w-5 h-5 text-yellow-400" />;
      case "reflection":
        return <BrainCircuit className="w-5 h-5 text-purple-400" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Loading memory timeline...
      </div>
    );
  }

  const renderSection = (title: string, events: TimelineEvent[]) => {
    if (!events || events.length === 0) return null;

    return (
      <div className="mb-12">
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-foreground">
          <Clock className="w-5 h-5 text-primary" />
          {title}
        </h3>
        <div className="relative border-l border-white/10 ml-3 space-y-8">
          {events.map((event) => (
            <div key={event.id} className="relative pl-8">
              <div
                className="absolute -left-3 top-0 bg-black/50 p-1 rounded-full border border-white/10 shadow-sm"
              >
                {getIcon(event.event_type)}
              </div>
              <div
                className="bg-secondary/20 border border-white/5 p-4 rounded-xl backdrop-blur-sm"
              >
                <p className="text-sm text-foreground/90">{event.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Memory Timeline</h1>
      <p className="text-muted-foreground mb-12">
        The evolution of your second brain
      </p>

      {data && (
        <>
          {renderSection("Today", data.today)}
          {renderSection("This Week", data.this_week)}
          {renderSection("Older", data.older)}
        </>
      )}

      {(!data ||
        (data.today.length === 0 &&
          data.this_week.length === 0 &&
          data.older.length === 0)) && (
        <div className="text-center text-muted-foreground mt-20">
          No memory events found yet.
        </div>
      )}
    </div>
  );
}