"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Network, Info, X, Zap, Heart, Shield, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Dynamically import force graph to prevent Server-Side Rendering (SSR) issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface GraphNode {
  id: string;
  node_id: string;
  node_type: string;
  label: string;
  subType: string;
  color: string;
  details: any;
  val: number;
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export default function KnowledgeGraphPage() {
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [fallbackData, setFallbackData] = useState<{ pkm_entities: any[]; entities: any[] }>({ pkm_entities: [], entities: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  const fetchAllGraphData = async () => {
    setLoading(true);
    try {
      const [responseGraph, responsePkm, responseBeliefs] = await Promise.all([
        api.get("/brain/graph"),
        api.get("/brain/pkm"),
        api.get("/brain/beliefs")
      ]);

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

      const nodes = (responseGraph.nodes || []).map((node: any) => {
        let name = "";
        let subType = "";
        let color = "#3b82f6"; // Default blue
        let details: any = {};

        if (node.node_type === "PKMEntity") {
          const pkm = pkmMap[node.node_id];
          name = pkm ? pkm.value : `PKM: ${node.node_id}`;
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
          name = `Doc [${node.node_id.substring(0, 8)}]`;
          subType = "Document";
          color = "#a855f7"; // Purple
          details = { filename: `Document [${node.node_id}]`, id: node.node_id };
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
  };

  useEffect(() => {
    fetchAllGraphData();

    const handleDataUpdate = () => {
      fetchAllGraphData();
    };

    window.addEventListener("data-updated", handleDataUpdate);
    return () => {
      window.removeEventListener("data-updated", handleDataUpdate);
    };
  }, []);

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
    setIsSidebarOpen(true);
  };

  const hasGraphData = graphData.nodes.length > 0;

  return (
    <div className="relative flex h-[calc(100vh-2.5rem)] max-w-6xl mx-auto overflow-hidden">
      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 space-y-6 px-6 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Network className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Knowledge Graph Synthesizer
            </h2>
            <p className="text-sm text-muted-foreground">
              Map and query workspace document extractions, entity scopes, and beliefs.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground space-y-4">
            <div className="flex space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="ml-3 text-xs">Parsing mental relationships...</span>
          </div>
        ) : (
          <div className="space-y-6 pb-6">
            {hasGraphData ? (
              <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5 bg-black/10">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    🧠 Knowledge Synaptic Map
                  </CardTitle>
                  <CardDescription className="text-xs">Drag nodes to interact. Click nodes to inspect properties.</CardDescription>
                </CardHeader>
                <CardContent ref={containerRef} className="p-0 relative bg-black/20">
                  <ForceGraph2D
                    graphData={graphData}
                    nodeLabel="label"
                    nodeColor={(node: any) => node.color}
                    nodeVal={(node: any) => node.val}
                    linkColor={() => "rgba(255, 255, 255, 0.08)"}
                    linkLabel={(link: any) => link.relationship}
                    onNodeClick={handleNodeClick}
                    width={containerWidth}
                    height={400}
                    cooldownTicks={80}
                    nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
                      const label = node.label;
                      const fontSize = 11 / globalScale;
                      ctx.font = `${fontSize}px Sans-Serif`;

                      ctx.beginPath();
                      ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
                      ctx.fillStyle = node.color;
                      ctx.fill();

                      const labelOffset = 6;
                      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
                      ctx.fillText(label, node.x + labelOffset, node.y + (fontSize / 3));
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="border border-white/10 bg-black/40 backdrop-blur-xl rounded-2xl p-8 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                <Info className="w-8 h-8 text-muted-foreground/60" />
                <p className="text-sm font-semibold">No Knowledge Graph Available</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Once you ingest manual documents, J.A.R.V.I.S. will extract PKMs and draw linkages.
                </p>
              </div>
            )}

            {/* Structured Lists View */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5 bg-black/10">
                  <CardTitle className="text-foreground text-sm font-semibold">PKM Entities</CardTitle>
                  <CardDescription className="text-xs">Structured priorities, goals, and interests.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 max-h-[300px] overflow-y-auto space-y-2">
                  {fallbackData.pkm_entities.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8 text-xs">No PKM entities.</p>
                  ) : (
                    fallbackData.pkm_entities.map((ent: any) => (
                      <div key={ent.id} className="p-3 border border-white/5 rounded-xl bg-white/5 space-y-1.5 text-xs">
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{ent.category}</span>
                        <p className="font-semibold text-foreground leading-normal">{ent.value}</p>
                        <div className="text-[9px] text-muted-foreground">Confidence: {ent.confidence}%</div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5 bg-black/10">
                  <CardTitle className="text-foreground text-sm font-semibold">General Named Entities</CardTitle>
                  <CardDescription className="text-xs">Identified companies, locations, and assets.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 max-h-[300px] overflow-y-auto space-y-2">
                  {fallbackData.entities.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8 text-xs">No named entities.</p>
                  ) : (
                    fallbackData.entities.map((ent: any) => (
                      <div key={ent.id} className="p-2.5 border border-white/5 rounded-xl bg-white/5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">{ent.name}</span>
                        <span className="text-[9px] bg-white/5 text-muted-foreground border border-white/10 px-1.5 py-0.5 rounded uppercase font-bold">{ent.type}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Node Detail Side Drawer */}
      <AnimatePresence>
        {isSidebarOpen && selectedNode && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black z-20 cursor-pointer"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-secondary/95 border-l border-white/10 backdrop-blur-xl shadow-2xl p-6 z-30 flex flex-col space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <Zap className="w-4 h-4 text-primary animate-pulse" />
                  Node Inspector
                </h3>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
                <div className="bg-black/35 rounded-xl p-4 border border-white/5 space-y-2">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Concept Value</span>
                  <p className="text-sm font-semibold text-foreground leading-normal">{selectedNode.label}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold mb-0.5">Primary Class</span>
                    <span className="font-semibold text-foreground uppercase tracking-widest text-[9px]">
                      {selectedNode.node_type}
                    </span>
                  </div>
                  <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold mb-0.5">Subtype</span>
                    <span className="font-semibold text-foreground">
                      {selectedNode.subType || "Core"}
                    </span>
                  </div>
                </div>

                {selectedNode.details && (
                  <div className="space-y-4">
                    {/* PKM source file */}
                    {selectedNode.details.source_file && (
                      <div className="bg-black/35 rounded-xl p-3 border border-white/5 space-y-1">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Source File</span>
                        <span className="font-mono text-foreground font-semibold block break-all">{selectedNode.details.source_file}</span>
                      </div>
                    )}
                    
                    {/* Belief source notes */}
                    {selectedNode.details.source_notes && (
                      <div className="bg-black/35 rounded-xl p-3 border border-white/5 space-y-1">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-bold">Source Context</span>
                        <p className="text-foreground leading-normal">{selectedNode.details.source_notes}</p>
                      </div>
                    )}

                    {/* Confidence score */}
                    {selectedNode.details.confidence !== undefined && (
                      <div className="bg-black/35 rounded-lg p-2.5 border border-white/5 flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">AI Confidence</span>
                        <span className="font-bold text-foreground">{selectedNode.details.confidence}%</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-white/5 border border-white/5 rounded-lg p-2.5 leading-normal">
                  <Info className="w-4 h-4 shrink-0 text-primary" />
                  <span>Synthesized via LLM-extraction from workspace manual references.</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}