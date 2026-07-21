"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, Brain, FileText, Network, Shield, Wrench, 
  Search, BarChart3, Clock, ArrowRight, Sparkles, Zap,
  ChevronRight, Activity, AlertTriangle, CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: FileText,
    title: "Universal Document Ingestion",
    description: "Process PDFs, P&IDs, scanned forms, spreadsheets, and engineering drawings with AI-powered entity extraction.",
    color: "text-blue-400",
    bg: "bg-blue-500/10"
  },
  {
    icon: Brain,
    title: "Industrial AI Copilot",
    description: "RAG-powered conversational AI that answers operational, maintenance, and engineering queries with source citations.",
    color: "text-purple-400",
    bg: "bg-purple-500/10"
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    description: "Automatic entity extraction — equipment IDs, failure modes, regulations — with relationship mapping across documents.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10"
  },
  {
    icon: Shield,
    title: "Compliance Intelligence",
    description: "Map regulatory requirements against procedures. Identify compliance gaps and auto-generate audit evidence packages.",
    color: "text-amber-400",
    bg: "bg-amber-500/10"
  },
  {
    icon: Wrench,
    title: "Maintenance Intelligence",
    description: "Predictive maintenance recommendations and Root Cause Analysis from maintenance logs, failure reports, and OEM manuals.",
    color: "text-red-400",
    bg: "bg-red-500/10"
  },
  {
    icon: Search,
    title: "Hybrid Search",
    description: "Dense vector + BM25 keyword search with Reciprocal Rank Fusion for maximum recall across your document corpus.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10"
  }
];

const stats = [
  { label: "Document Types", value: "15+", icon: FileText },
  { label: "Entity Categories", value: "12", icon: Network },
  { label: "Search Modes", value: "3", icon: Search },
  { label: "Response Time", value: "<2s", icon: Zap }
];

const demoQuestions = [
  "Why did Pump P-204 fail?",
  "Show SOP for Boiler Startup",
  "What maintenance happened last month?",
  "Which documents reference Compressor C-102?",
  "Find similar failures",
  "Generate Root Cause Analysis",
  "Summarize inspection reports",
  "Show compliance gaps"
];

export default function LandingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp * 1000;
          if (Date.now() < exp) {
            setIsAuthenticated(true);
          }
        }
      } catch {}
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-bold tracking-wider font-mono uppercase">
              J.A.R.V.I.S.
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button 
                onClick={() => router.push("/dashboard")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Open Command Center
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => router.push("/login")}
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => router.push("/register")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              ET AI Hackathon 2026 · Problem Statement #8
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
              The Unified Asset &{" "}
              <span className="text-primary">Operations Brain</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Transform disconnected industrial documents into operational intelligence using 
              <span className="text-foreground font-medium"> Agentic AI</span>, 
              <span className="text-foreground font-medium"> Knowledge Graphs</span>, and 
              <span className="text-foreground font-medium"> Retrieval-Augmented Generation</span>.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg"
                onClick={() => router.push(isAuthenticated ? "/dashboard" : "/register")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-12 text-sm"
              >
                <Zap className="w-4 h-4 mr-2" />
                Start Using J.A.R.V.I.S.
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push("/login")}
                className="px-8 h-12 text-sm"
              >
                View Demo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center">
                  <stat.icon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for Industrial Operations
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Purpose-built for steel plants, oil refineries, power plants, chemical facilities, 
              and manufacturing environments.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="p-6 rounded-2xl border border-border/40 bg-card/50 hover:bg-card/80 transition-all hover-lift group"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.bg} border border-border/40 flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Questions Section */}
      <section className="py-20 px-6 bg-secondary/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ask Your Industrial AI Copilot
            </h2>
            <p className="text-muted-foreground">
              Natural language queries across your entire document corpus
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {demoQuestions.map((question, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/60 transition-all cursor-pointer group"
                onClick={() => router.push(isAuthenticated ? "/dashboard/chat" : "/login")}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                  "{question}"
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Preview */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Enterprise-Grade Architecture
            </h2>
            <p className="text-muted-foreground">
              Production-ready with proper auth, multi-tenant isolation, and streaming responses
            </p>
          </div>

          <div className="p-8 rounded-2xl border border-border/40 bg-card/30 font-mono text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div className="font-semibold">Frontend</div>
                <div className="text-xs text-muted-foreground">Next.js 15 · TypeScript · Tailwind CSS</div>
              </div>
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <Brain className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="font-semibold">AI Engine</div>
                <div className="text-xs text-muted-foreground">LangGraph · NVIDIA NIM · Gemini</div>
              </div>
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto">
                  <Network className="w-6 h-6 text-purple-400" />
                </div>
                <div className="font-semibold">Vector DB</div>
                <div className="text-xs text-muted-foreground">Qdrant · 768-dim embeddings · Hybrid search</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold">J.A.R.V.I.S.</span>
            <span className="text-xs text-muted-foreground">Industrial Knowledge Intelligence</span>
          </div>
          <div className="text-xs text-muted-foreground">
            ET AI Hackathon 2026 · Problem Statement #8
          </div>
        </div>
      </footer>
    </div>
  );
}