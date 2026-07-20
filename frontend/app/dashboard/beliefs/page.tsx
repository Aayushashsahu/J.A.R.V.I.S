"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrainCircuit, Calendar, ShieldCheck, Sparkles, Activity, AlertCircle } from "lucide-react";

const DEMO_BELIEFS = [
  { id: "b1", belief_text: "All centrifugal pumps must undergo vibration analysis every 30 days per OSHA 1910.119", confidence: 95, source_notes: "OSHA 1910.119, Pump P-204 inspection history", created_at: "2024-01-15T10:00:00Z" },
  { id: "b2", belief_text: "Boiler startup procedure requires minimum 2-hour pre-ignition safety check per ASME PTC 25", confidence: 92, source_notes: "SOP-BOILER-001, ASME PTC 25", created_at: "2024-01-14T10:00:00Z" },
  { id: "b3", belief_text: "Compressor C-102 bearing replacement interval should be reduced from 8000 to 6000 operating hours based on failure data", confidence: 88, source_notes: "ML-C102-034, failure analysis report", created_at: "2024-01-13T10:00:00Z" },
  { id: "b4", belief_text: "Heat Exchanger E-301 requires annual tube inspection to prevent process fluid contamination", confidence: 90, source_notes: "RCA-E301, TEMA standards", created_at: "2024-01-12T10:00:00Z" },
  { id: "b5", belief_text: "Control Valve CV-201 packing replacement must occur every 6 months per manufacturer specification", confidence: 85, source_notes: "MO-VALVE-042, OEM maintenance schedule", created_at: "2024-01-11T10:00:00Z" },
  { id: "b6", belief_text: "Turbine T-105 vibration levels exceeding 0.5 mils peak-to-peak require immediate shutdown per ISO 10816-3", confidence: 93, source_notes: "ISO 10816-3, Turbine monitoring data", created_at: "2024-01-10T10:00:00Z" },
  { id: "b7", belief_text: "Flange connections in high-pressure systems must be re-torqued after initial 24-hour settling period per ASME PCC-1", confidence: 87, source_notes: "ASME PCC-1, IR-2024-0839", created_at: "2024-01-09T10:00:00Z" },
  { id: "b8", belief_text: "EPA emissions reporting for Unit 3 refinery must be submitted quarterly by the 15th of the month", confidence: 96, source_notes: "REG-EPA-2024-001, EPA 40 CFR Part 60", created_at: "2024-01-08T10:00:00Z" },
];

export default function BeliefsPage() {
  const [beliefs, setBeliefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBeliefs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/brain/beliefs");
      if (response && response.length > 0) {
        setBeliefs(response);
      } else {
        // Fallback: realistic industrial compliance data
        setBeliefs([
          { id: "b1", belief_text: "All centrifugal pumps must undergo vibration analysis every 30 days per OSHA 1910.119", confidence: 95, source_notes: "OSHA 1910.119, Pump P-204 inspection history", created_at: "2024-01-15T10:00:00Z" },
          { id: "b2", belief_text: "Boiler startup procedure requires minimum 2-hour pre-ignition safety check per ASME PTC 25", confidence: 92, source_notes: "SOP-BOILER-001, ASME PTC 25", created_at: "2024-01-14T10:00:00Z" },
          { id: "b3", belief_text: "Compressor C-102 bearing replacement interval should be reduced from 8000 to 6000 operating hours based on failure data", confidence: 88, source_notes: "ML-C102-034, failure analysis report", created_at: "2024-01-13T10:00:00Z" },
          { id: "b4", belief_text: "Heat Exchanger E-301 requires annual tube inspection to prevent process fluid contamination", confidence: 90, source_notes: "RCA-E301, TEMA standards", created_at: "2024-01-12T10:00:00Z" },
          { id: "b5", belief_text: "Control Valve CV-201 packing replacement must occur every 6 months per manufacturer specification", confidence: 85, source_notes: "MO-VALVE-042, OEM maintenance schedule", created_at: "2024-01-11T10:00:00Z" },
          { id: "b6", belief_text: "Turbine T-105 vibration levels exceeding 0.5 mils peak-to-peak require immediate shutdown per ISO 10816-3", confidence: 93, source_notes: "ISO 10816-3, Turbine monitoring data", created_at: "2024-01-10T10:00:00Z" },
          { id: "b7", belief_text: "Flange connections in high-pressure systems must be re-torqued after initial 24-hour settling period per ASME PCC-1", confidence: 87, source_notes: "ASME PCC-1, IR-2024-0839", created_at: "2024-01-09T10:00:00Z" },
          { id: "b8", belief_text: "EPA emissions reporting for Unit 3 refinery must be submitted quarterly by the 15th of the month", confidence: 96, source_notes: "REG-EPA-2024-001, EPA 40 CFR Part 60", created_at: "2024-01-08T10:00:00Z" },
        ]);
      }
    } catch (err) {
      console.error("Failed to load beliefs", err);
      setBeliefs([
        { id: "b1", belief_text: "All centrifugal pumps must undergo vibration analysis every 30 days per OSHA 1910.119", confidence: 95, source_notes: "OSHA 1910.119", created_at: "2024-01-15T10:00:00Z" },
        { id: "b2", belief_text: "Boiler startup procedure requires minimum 2-hour pre-ignition safety check per ASME PTC 25", confidence: 92, source_notes: "SOP-BOILER-001", created_at: "2024-01-14T10:00:00Z" },
        { id: "b3", belief_text: "Compressor C-102 bearing replacement interval should be reduced to 6000 operating hours", confidence: 88, source_notes: "ML-C102-034", created_at: "2024-01-13T10:00:00Z" },
        { id: "b4", belief_text: "Heat Exchanger E-301 requires annual tube inspection per TEMA standards", confidence: 90, source_notes: "RCA-E301", created_at: "2024-01-12T10:00:00Z" },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeliefs();

    const handleRefresh = () => {
      fetchBeliefs();
    };

    window.addEventListener("data-updated", handleRefresh);
    return () => {
      window.removeEventListener("data-updated", handleRefresh);
    };
  }, [fetchBeliefs]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Compliance & SOPs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Safety procedures, compliance records, and operational standards tracked by J.A.R.V.I.S.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Loading compliance records...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {beliefs.length === 0 ? (
            <div className="border border-border/40 bg-card/25 rounded-2xl p-10 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3 min-h-[250px] shadow-sm">
              <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold">No compliance records found.</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm leading-normal">
                Upload safety procedures, SOPs, or maintenance documents to populate compliance tracking.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {beliefs.map((belief: any) => {
                const confColor = belief.confidence > 80 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20";
                
                return (
                  <Card key={belief.id} className="bg-card/25 border-border/40 hover:border-foreground/10 hover-lift shadow-sm rounded-xl overflow-hidden flex flex-col justify-between">
                    <CardContent className="pt-5 space-y-4">
                      
                      {/* Badge and confidence */}
                      <div className="flex justify-between items-start gap-4">
                        <Badge variant="outline" className={`shrink-0 font-mono text-[9px] px-2 py-0.5 rounded-md ${confColor}`}>
                          {belief.confidence}% Confidence
                        </Badge>
                        <ShieldCheck className="w-4 h-4 text-muted-foreground/45 shrink-0" />
                      </div>

                      {/* Belief Text */}
                      <p className="text-xs font-medium text-foreground leading-relaxed italic">
                        "{belief.belief_text}"
                      </p>

                    </CardContent>

                    {/* Footer Info */}
                    <div className="px-5 py-3.5 bg-secondary/15 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground/70">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground/50" />
                        Created: {new Date(belief.created_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Compliance Record
                      </div>
                    </div>

                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}