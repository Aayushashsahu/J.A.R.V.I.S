"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Network, Info, Database, Compass, Eye, Activity, Tag } from "lucide-react";

// Dynamically import force graph to prevent Server-Side Rendering (SSR) issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export default function KnowledgeGraphPage() {
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [fallbackData, setFallbackData] = useState<{ pkm_entities: any[]; entities: any[] }>({ pkm_entities: [], entities: [] });
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    async function fetchAllGraphData() {
      try {
        const [responseGraph, responsePkm, responseBeliefs] = await Promise.all([
          api.get("/brain/graph"),
          api.get("/brain/pkm"),
          api.get("/brain/beliefs")
        ]);

        // Keep local fallback copy
        setFallbackData(responsePkm);

        const pkmMap = (responsePkm.pkm_entities || []).reduce((acc: any, item: any) => {
          acc[item.id] = item;
          return acc;
        }, {});

        const entityMap = (responsePkm.entities || []).reduce((acc: any, item: any) => {
          acc[item.id] = item;
          return acc;
        }, {});

        const beliefMap = (responseBeliefs || []).reduce((acc: any, item: any) => {
          acc[item.id] = item;
          return acc;
        }, {});

        // Map nodes
        const nodes = (responseGraph.nodes || []).map((node: any) => {
          let name = "";
          let subType = "";
          let color = "#3b82f6"; // Default blue
          let details: any = {};

          if (node.node_type === "PKMEntity") {
            const pkm = pkmMap[node.node_id];
            name = pkm ? pkm.value : `PKM Entity: ${node.node_id}`;
            subType = pkm ? pkm.category : "PKMEntity";
            color = "#10b981"; // Emerald
            details = pkm || {};
          } else if (node.node_type === "Entity") {
            const ent = entityMap[node.node_id];
            name = ent ? ent.name : `Entity: ${node.node_id}`;
            subType = ent ? ent.type : "Entity";
            color = "#ec4899"; // Pink
            details = ent || {};
          } else if (node.node_type === "Belief") {
            const belief = beliefMap[node.node_id];
            name = belief ? belief.belief_text : `Belief: ${node.node_id}`;
            subType = "Belief";
            color = "#f59e0b"; // Amber
            details = belief || {};
          } else if (node.node_type === "Document") {
            name = `Document [${node.node_id.substring(0, 8)}]`;
            subType = "Document";
            color = "#a855f7"; // Purple
            details = { filename: `Document [${node.node_id}]`, id: node.node_id, isPlaceholder: true };
          }

          return {
            id: node.id,
            node_id: node.node_id,
            node_type: node.node_type,
            label: name,
            subType,
            color,
            details,
            val: node.node_type === "Document" ? 12 : 8
          };
        });

        // Map edges
        const links = (responseGraph.edges || []).map((edge: any) => ({
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          relationship: edge.relationship_type
        }));

        setGraphData({ nodes, links });
      } catch (err) {
        console.error("Failed to load graph data", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllGraphData();

    const handleDataUpdate = () => {
      fetchAllGraphData();
    };

    window.addEventListener("data-updated", handleDataUpdate);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdate);
    };
  }, []);

  // Update container width dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    setIsDialogOpen(true);
  };

  const hasGraphData = graphData.nodes.length > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <Network className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Interactive Knowledge Graph</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Visualize relationships between structured entities, beliefs, and documents.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-3">
          <Activity className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Synthesizing synapses map...</span>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Main 2D force graph visualizer canvas container */}
          {hasGraphData ? (
            <Card className="border border-border/40 bg-card/25 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/30 bg-secondary/15 py-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Compass className="w-4.5 h-4.5 text-primary" />
                  Cognitive Mind Synthesis Map
                </CardTitle>
                <CardDescription className="text-xs">Drag nodes to inspect synapses. Click a node to reveal provenance.</CardDescription>
              </CardHeader>
              
              <CardContent ref={containerRef} className="p-0 relative bg-black/10 flex items-center justify-center">
                <ForceGraph2D
                  graphData={graphData}
                  nodeLabel="label"
                  nodeColor={(node: any) => node.color}
                  nodeVal={(node: any) => node.val}
                  linkColor={() => "rgba(255, 255, 255, 0.08)"}
                  linkLabel={(link: any) => link.relationship}
                  onNodeClick={handleNodeClick}
                  width={containerWidth}
                  height={450}
                  cooldownTicks={100}
                  nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
                    const label = node.label;
                    const fontSize = 11 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;

                    // Draw node circle
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color;
                    ctx.fill();

                    // Node text label
                    const labelOffset = 6;
                    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
                    ctx.fillText(label, node.x + labelOffset, node.y + (fontSize / 3));
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="border border-border/40 bg-card/25 rounded-2xl p-10 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3 shadow-sm min-h-[300px]">
              <Info className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold">Your Knowledge Graph is currently empty.</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm leading-normal">
                Vectorize document items in the ingestion hub to extract cognitive entities and relationships.
              </p>
            </div>
          )}

          {/* PKM Lists Grid (Rendered as fallback / secondary view) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PKM Entities card */}
            <Card className="border border-border/40 bg-card/25 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/30 bg-secondary/15 py-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  PKM Goal Entities
                </CardTitle>
                <CardDescription className="text-xs">Structured priorities and milestone coordinates.</CardDescription>
              </CardHeader>
              
              <CardContent className="p-4 max-h-[350px] overflow-y-auto space-y-2.5">
                {fallbackData.pkm_entities.length === 0 && (
                  <p className="text-muted-foreground text-center py-10 text-xs italic">No goals or milestones mapped yet.</p>
                )}
                {fallbackData.pkm_entities.map((ent: any) => (
                  <div key={ent.id} className="p-3 border border-border/30 rounded-xl bg-secondary/15 hover:border-foreground/10 hover-lift space-y-2 transition-all">
                    <div className="flex justify-between items-center">
                      <Badge variant="secondary" className="bg-secondary/40 text-foreground border border-border/40 text-[9px] px-1.5 py-0.5">{ent.category}</Badge>
                      <span className="text-[9px] text-muted-foreground font-mono">{ent.confidence}% Conf.</span>
                    </div>
                    <p className="font-semibold text-foreground text-xs leading-normal">"{ent.value}"</p>
                    {ent.source_file && (
                      <p className="text-[9px] text-muted-foreground font-mono truncate">Source: {ent.source_file}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* General Concepts Entities card */}
            <Card className="border border-border/40 bg-card/25 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/30 bg-secondary/15 py-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-pink-400" />
                  General Concept Entities
                </CardTitle>
                <CardDescription className="text-xs">Identified companies, terms, and context nodes.</CardDescription>
              </CardHeader>
              
              <CardContent className="p-4 max-h-[350px] overflow-y-auto space-y-2">
                {fallbackData.entities.length === 0 && (
                  <p className="text-muted-foreground text-center py-10 text-xs italic">No concepts mapped.</p>
                )}
                {fallbackData.entities.map((ent: any) => (
                  <div key={ent.id} className="p-2.5 border border-border/30 rounded-xl bg-secondary/15 hover:border-foreground/10 hover-lift flex items-center justify-between text-xs transition-all">
                    <span className="font-semibold text-foreground">{ent.name}</span>
                    <Badge variant="outline" className="border-border text-[9px] text-muted-foreground">{ent.type}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* Node Detail Dialog overlay */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-popover border border-border rounded-xl shadow-2xl glass-panel-elevated text-foreground">
          <DialogHeader className="border-b border-border/40 pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4.5 h-4.5 text-primary" /> Synapse Node Attributes
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-[11px]">
              Provenance records mapped by RAG indexer.
            </DialogDescription>
          </DialogHeader>
          
          {selectedNode && (
            <div className="space-y-4 my-2">
              
              <div className="bg-secondary/35 rounded-xl p-3.5 border border-border/40 space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Label / Synthesized Text</span>
                <p className="text-xs font-semibold text-foreground leading-normal">"{selectedNode.label}"</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-secondary/35 rounded-lg p-2.5 border border-border/40">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Node Type</span>
                  <Badge variant="secondary" className="bg-secondary/40 text-foreground border border-border/40 text-[9px] mt-0.5">{selectedNode.node_type}</Badge>
                </div>
                <div className="bg-secondary/35 rounded-lg p-2.5 border border-border/40">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Category</span>
                  <span className="font-semibold text-foreground text-xs block mt-0.5">{selectedNode.subType || "Unclassified"}</span>
                </div>
              </div>

              {selectedNode.details && (
                <div className="space-y-2">
                  {/* File origin */}
                  {selectedNode.details.source_file && (
                    <div className="bg-secondary/35 rounded-xl p-3 border border-border/40 text-[11px]">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Source file provenance</span>
                      <span className="font-mono text-foreground font-semibold break-all">{selectedNode.details.source_file}</span>
                    </div>
                  )}
                  {/* Belief notes */}
                  {selectedNode.details.source_notes && (
                    <div className="bg-secondary/35 rounded-xl p-3 border border-border/40 text-[11px]">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Notes origin</span>
                      <span className="text-foreground leading-normal">{selectedNode.details.source_notes}</span>
                    </div>
                  )}
                  {/* Developer handoff flag warning details */}
                  {selectedNode.details.isPlaceholder && (
                    <div className="bg-destructive/10 text-destructive rounded-xl p-3.5 border border-destructive/20 text-[11px] leading-normal">
                      <span className="font-semibold block mb-1">⚠️ Dev Flag (Pending Ingestion Endpoint)</span>
                      This document node requires the <code className="font-mono text-[10px] font-bold text-foreground">GET /workspaces/id/documents</code> endpoint to map raw hashes to file metadata.
                    </div>
                  )}
                  {/* Confidence score */}
                  {selectedNode.details.confidence !== undefined && (
                    <div className="bg-secondary/35 rounded-xl p-3 border border-border/40 text-[11px]">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Confidence mapping</span>
                      <span className="font-semibold text-foreground font-mono">{selectedNode.details.confidence}% accuracy</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}