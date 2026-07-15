"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Network, Info } from "lucide-react";

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
            // NOTE: Flagging to Aayush that GET /workspaces/{id}/documents is needed to map raw node_id to actual document filenames.
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

    // Initial fetch
    fetchAllGraphData();

    // Set up listener for data updates from other components (e.g., after upload)
    const handleDataUpdate = () => {
      fetchAllGraphData();
    };

    window.addEventListener("data-updated", handleDataUpdate);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdate);
    };
  }, []); // Empty deps means this effect runs once on mount and cleans up on unmount

  // Update container width dynamically to adapt graph rendering size
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
    <div className="space-y-6 max-w-6xl mx-auto my-4 px-4">
      <div className="flex items-center gap-3">
        <Network className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Interactive Knowledge Graph</h2>
          <p className="text-sm text-muted-foreground">Visualize relationships between structured entities, beliefs, and documents.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce mr-1.5" style={{ animationDelay: "0ms" }}></span>
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce mr-1.5" style={{ animationDelay: "150ms" }}></span>
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }}></span>
          <span className="ml-3 text-sm">Synthesizing knowledge graph...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {hasGraphData ? (
            <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-black/10">
                <CardTitle className="flex items-center gap-2">
                  <span>🧠</span> Mind Synthesis Map
                </CardTitle>
                <CardDescription>Drag nodes to inspect synapses. Click a node to reveal provenance.</CardDescription>
              </CardHeader>
              <CardContent ref={containerRef} className="p-0 relative bg-black/20">
                <ForceGraph2D
                  graphData={graphData}
                  nodeLabel="label"
                  nodeColor={(node: any) => node.color}
                  nodeVal={(node: any) => node.val}
                  linkColor={() => "rgba(255, 255, 255, 0.12)"}
                  linkLabel={(link: any) => link.relationship}
                  onNodeClick={handleNodeClick}
                  width={containerWidth}
                  height={450}
                  cooldownTicks={100}
                  nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
                    const label = node.label;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;

                    // Draw node circle
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color;
                    ctx.fill();

                    // Node label
                    const labelOffset = 6;
                    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
                    ctx.fillText(label, node.x + labelOffset, node.y + (fontSize / 3));
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="border border-white/10 bg-black/40 backdrop-blur-xl rounded-2xl p-6 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
              <Info className="w-8 h-8 text-muted-foreground/60" />
              <p className="text-base">Your knowledge graph is currently empty.</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm">Ingest files in the Documents page to build nodes and extract relationships.</p>
            </div>
          )}

          {/* PKM Lists (Rendered as fallback / secondary view) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-black/10">
                <CardTitle className="text-foreground">PKM Entities</CardTitle>
                <CardDescription>Structured goals, priorities, and interests.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 max-h-[350px] overflow-y-auto space-y-3">
                {fallbackData.pkm_entities.length === 0 && (
                  <p className="text-muted-foreground text-center py-8 text-xs">No PKM entities found yet.</p>
                )}
                {fallbackData.pkm_entities.map((ent: any) => (
                  <div key={ent.id} className="p-3 border border-white/5 rounded-xl bg-white/5 shadow-sm space-y-1">
                    <Badge variant="secondary" className="bg-secondary/40 text-foreground border-white/5 text-[10px]">{ent.category}</Badge>
                    <p className="font-semibold text-foreground text-sm leading-snug">{ent.value}</p>
                    <p className="text-[10px] text-muted-foreground">Confidence: {ent.confidence}% {ent.source_file && `· Source: ${ent.source_file}`}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-black/10">
                <CardTitle className="text-foreground">General Entities</CardTitle>
                <CardDescription>Identified companies, concepts, and people.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 max-h-[350px] overflow-y-auto space-y-3">
                {fallbackData.entities.length === 0 && (
                  <p className="text-muted-foreground text-center py-8 text-xs">No general entities found yet.</p>
                )}
                {fallbackData.entities.map((ent: any) => (
                  <div key={ent.id} className="p-3 border border-white/5 rounded-xl bg-white/5 shadow-sm flex items-center justify-between">
                    <span className="font-medium text-foreground text-sm">{ent.name}</span>
                    <Badge variant="outline" className="border-white/10 text-[10px]">{ent.type}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Node Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-secondary/95 backdrop-blur-lg border border-white/10 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <span>🧠</span> Node Details
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Structured entity details and source attribution.
            </DialogDescription>
          </DialogHeader>
          {selectedNode && (
            <div className="space-y-4 my-2">
              <div className="bg-black/35 rounded-xl p-4 border border-white/5 space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Label / Value</span>
                <p className="text-base font-semibold text-foreground leading-snug">{selectedNode.label}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Node Type</span>
                  <Badge variant="secondary" className="bg-secondary/40 text-foreground border-white/5 text-[10px] mt-0.5">{selectedNode.node_type}</Badge>
                </div>
                <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Sub-category</span>
                  <span className="font-medium text-foreground text-xs leading-none">{selectedNode.subType || "N/A"}</span>
                </div>
              </div>

              {selectedNode.details && (
                <div className="space-y-2">
                  {/* Handle PKMEntity source */}
                  {selectedNode.details.source_file && (
                    <div className="bg-black/35 rounded-xl p-3 border border-white/5 text-xs">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Source file</span>
                      <span className="font-mono text-foreground font-medium">{selectedNode.details.source_file}</span>
                    </div>
                  )}
                  {/* Handle Belief source */}
                  {selectedNode.details.source_notes && (
                    <div className="bg-black/35 rounded-xl p-3 border border-white/5 text-xs">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Source Notes</span>
                      <span className="text-foreground">{selectedNode.details.source_notes}</span>
                    </div>
                  )}
                  {/* Handle Document placeholder label flag */}
                  {selectedNode.details.isPlaceholder && (
                    <div className="bg-destructive/10 text-destructive rounded-xl p-3 border border-destructive/20 text-xs">
                      <span className="font-medium">⚠️ Developer Handoff Flag (to Aayush)</span>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-normal">
                        Raw node ID is shown. A new endpoint <code className="font-mono font-bold text-foreground">GET /workspaces/{id}/documents</code> is needed in the backend to resolve this ID into a human-readable document filename.
                      </p>
                    </div>
                  )}
                  {/* Confidence details if present */}
                  {selectedNode.details.confidence !== undefined && (
                    <div className="bg-black/35 rounded-xl p-3 border border-white/5 text-xs">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Confidence Score</span>
                      <span className="font-medium text-foreground">{selectedNode.details.confidence}%</span>
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