"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { 
  Bot, User as UserIcon, Send, RefreshCw, Copy, Check, Sparkles, 
  Settings2, Sliders, Pin, HelpCircle, History, AlertCircle, FileText, CheckCircle2, Shield
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Citation {
  chunk_id: string;
  source: string;
  page?: number;
  clause_id?: string;
  score: number;
  snippet: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  mode?: "rag" | "agent";
  steps?: { node: string; content: string }[];
}

interface PinnedChat {
  id: string;
  title: string;
  active: boolean;
}

function ChatContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isCitationOpen, setIsCitationOpen] = useState(false);
  
  // Advanced search settings
  const [mode, setMode] = useState<"rag" | "agent">("rag");
  const [topK, setTopK] = useState<number>(5);
  const [useHybrid, setUseHybrid] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Pinned/recent chats (mock history with state to look fully premium)
  const [recentChats, setRecentChats] = useState<PinnedChat[]>([
    { id: "c1", title: "Active focus areas synthesis", active: true },
    { id: "c2", title: "Compliance standards audit", active: false },
    { id: "c3", title: "Reflections contradiction check", active: false },
  ]);
  
  // Clipboard copy feedback
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  // Step-by-step tracing for active agent flow
  const [agentSteps, setAgentSteps] = useState<{ node: string; content: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCitationClick = (citation: Citation) => {
    setActiveCitation(citation);
    setIsCitationOpen(true);
  };

  const handleResetDemo = () => {
    setMessages([]);
    setConversationId(null);
    setAgentSteps([]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleFocusEvent = () => {
      inputRef.current?.focus();
    };

    window.addEventListener('focus-chat-input', handleFocusEvent);
    return () => window.removeEventListener('focus-chat-input', handleFocusEvent);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, agentSteps]);

  // Copy helper
  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Stream responder
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !workspaceId) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setAgentSteps([]);

    // Add user message to UI
    setMessages(prev => [...prev, { 
      role: "user", 
      content: userMessage,
      mode 
    }]);

    const token = localStorage.getItem('token');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    if (mode === "agent") {
      // ── Agent Orchestration Mode (LangGraph trace streaming) ──
      try {
        const response = await fetch(`${API_URL}/agent/orchestrate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            goal: userMessage,
            max_steps: 10
          })
        });

        if (!response.ok) {
          throw new Error("Agent pipeline failed to initialize.");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let partialLine = "";
        let finalAnswer = "";
        let localSteps: { node: string; content: string }[] = [];

        while (!done && reader) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          const chunk = decoder.decode(value, { stream: !done });
          const lines = (partialLine + chunk).split("\n");
          partialLine = lines.pop() || "";

          for (const line of lines) {
            const cleaned = line.trim();
            if (!cleaned.startsWith("data:")) continue;
            const dataStr = cleaned.slice(5).trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.event === "trace" || parsed.node) {
                const stepNode = parsed.node || "system";
                const stepContent = parsed.content || "";
                localSteps.push({ node: stepNode, content: stepContent });
                setAgentSteps([...localSteps]);
              } else if (parsed.event === "final" || parsed.answer) {
                finalAnswer = parsed.answer || "";
              }
            } catch (err) {
              // Ignore partial JSON blocks
            }
          }
        }

        setMessages(prev => [...prev, {
          role: "assistant",
          content: finalAnswer || "Agent reasoning finalized.",
          mode: "agent",
          steps: localSteps
        }]);

      } catch (err: any) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `Agent System Error: ${err.message}`,
          mode: "agent"
        }]);
      } finally {
        setIsLoading(false);
      }

    } else {
      // ── Standard RAG Chat Mode (Stream response) ──
      try {
        const response = await fetch(`${API_URL}/workspaces/${workspaceId}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            message: userMessage,
            conversation_id: conversationId || undefined,
            top_k: topK,
            use_hybrid: useHybrid
          })
        });

        if (!response.ok) {
          throw new Error("Chat request failed.");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let partialLine = "";
        let assistantContent = "";
        let citationsList: Citation[] = [];

        // Insert placeholder assistant message that we stream into
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "", 
          citations: [],
          mode: "rag"
        }]);

        while (!done && reader) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          const chunk = decoder.decode(value, { stream: !done });
          const lines = (partialLine + chunk).split("\n");
          partialLine = lines.pop() || "";

          for (const line of lines) {
            const cleaned = line.trim();
            if (!cleaned.startsWith("data:")) continue;
            const dataStr = cleaned.slice(5).trim();
            
            if (dataStr === "[DONE]") {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === "token") {
                assistantContent += parsed.content;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.content = assistantContent;
                  }
                  return updated;
                });
              } else if (parsed.type === "citations") {
                citationsList = parsed.citations || [];
                setMessages(prev => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.citations = citationsList;
                  }
                  return updated;
                });
              }
            } catch (err) {
              // Ignore parsing errors
            }
          }
        }
      } catch (err: any) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `API Error: ${err.message}`,
          mode: "rag"
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSuggestedClick = (text: string) => {
    setInput(text);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (!workspaceId) {
    return (
      <div className="p-8 text-destructive text-center flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <AlertCircle className="w-8 h-8 text-destructive/80" />
        <h3 className="font-semibold">Workspace Context Required</h3>
        <p className="text-xs text-muted-foreground max-w-sm leading-normal">
          Please select a workspace from the sidebar menu to retrieve your Second Brain memory files.
        </p>
      </div>
    );
  }

  const suggestedQuestions = [
    "What projects are currently active?",
    "What are my core long-term beliefs?",
    "Check memory for compliance indicators"
  ];

  return (
    <div className="flex h-[calc(100vh-10rem)] max-w-7xl mx-auto gap-6">
      
      {/* Pinned Chats & Retrieval Control Sidebar */}
      <div className="hidden lg:flex flex-col w-64 bg-card/25 border border-border/40 rounded-2xl p-4 shrink-0 flex-shrink-0 space-y-6">
        
        {/* Mode Selector Toggle */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 block px-1">Engine Mode</span>
          <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary/50 border border-border/40">
            <button
              onClick={() => setMode("rag")}
              className={`py-1.5 rounded-lg text-center text-xs font-medium transition-all ${
                mode === "rag" 
                  ? "bg-popover text-foreground shadow-sm font-semibold" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              RAG Chat
            </button>
            <button
              onClick={() => setMode("agent")}
              className={`py-1.5 rounded-lg text-center text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                mode === "agent" 
                  ? "bg-popover text-foreground shadow-sm font-semibold" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Agent
            </button>
          </div>
        </div>

        {/* History Sidebar */}
        <div className="flex-1 flex flex-col space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 block">Recent Syntheses</span>
            <History className="w-3.5 h-3.5 text-muted-foreground/50" />
          </div>
          
          <div className="space-y-1.5 overflow-y-auto pr-1">
            {recentChats.map((c) => (
              <button
                key={c.id}
                onClick={() => setRecentChats(recentChats.map(item => ({ ...item, active: item.id === c.id })))}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                  c.active 
                    ? "bg-secondary/70 text-foreground font-medium border border-border/50" 
                    : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground border border-transparent"
                }`}
              >
                <Pin className={`w-3 h-3 ${c.active ? "text-primary shrink-0" : "text-muted-foreground/30 shrink-0"}`} />
                <span className="truncate">{c.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration settings slider toggle */}
        <div className="border-t border-border/30 pt-4 space-y-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground/80 hover:text-foreground px-1"
          >
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Retrieval Controls
            </span>
            <Sliders className="w-3 h-3" />
          </button>

          {showSettings && (
            <div className="space-y-3.5 p-3 rounded-xl bg-secondary/35 border border-border/30">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Top K retrieved:</span>
                  <span className="font-semibold text-foreground">{topK}</span>
                </div>
                <input 
                  type="range" 
                  min={1} 
                  max={15} 
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-foreground"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] pt-1">
                <span className="text-muted-foreground">Hybrid Search (BM25):</span>
                <button
                  onClick={() => setUseHybrid(!useHybrid)}
                  className={`w-8 h-4 rounded-full transition-all relative ${useHybrid ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-background transition-all ${useHybrid ? "right-0.5" : "left-0.5"}`}></span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Main Chat Feed */}
      <div className="flex-1 flex flex-col bg-card/25 border border-border/40 rounded-2xl overflow-hidden shadow-sm relative">
        
        {/* Header Indicator */}
        <div className="px-5 py-4 border-b border-border/30 bg-secondary/15 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Second Brain Inquirer</h3>
              <p className="text-[10px] text-muted-foreground leading-normal">
                {mode === "agent" ? "Reasoning core running plan traces" : "RAG retrieval query state"}
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetDemo}
            className="h-8 px-2.5 rounded-lg border-border/60 hover:bg-secondary/40 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            Reset Feed
          </Button>
        </div>

        {/* Scroll Feed */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6 max-w-4xl mx-auto">
            
            {/* Empty state instructions */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-20 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/15 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-semibold">How can J.A.R.V.I.S. assist your project context?</h4>
                  <p className="text-xs text-muted-foreground max-w-sm leading-normal">
                    Query your second brain vault or activate orchestration step tracing to resolve compliance issues.
                  </p>
                </div>
              </div>
            )}

            {/* Message Map loop */}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* User or Bot Avatar */}
                  <div className={`w-8 h-8 rounded-full border border-border/40 flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'user' 
                      ? 'bg-foreground text-background font-semibold text-xs' 
                      : 'bg-secondary/60 text-foreground'
                  }`}>
                    {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className="flex flex-col gap-2">
                    
                    {/* Text Container bubble */}
                    <div className={`rounded-xl p-4 text-xs leading-relaxed transition-all relative group border ${
                      msg.role === 'user' 
                        ? 'bg-foreground/5 text-foreground border-border/50 rounded-tr-none' 
                        : 'bg-card/45 border-border/50 rounded-tl-none text-foreground/90'
                    }`}>
                      
                      {/* Controls like copy inside bubble */}
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopyText(msg.content, idx)}
                          className="p-1 rounded bg-secondary/80 border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy reply text"
                        >
                          {copiedId === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Markdown reader */}
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-[12px] leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {/* Execution Steps if agent mode */}
                      {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/30 space-y-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 block">Agent Execution Trace</span>
                          <div className="space-y-1.5">
                            {msg.steps.map((step, sIdx) => (
                              <div key={sIdx} className="p-2.5 rounded-lg border border-border/30 bg-secondary/20 flex gap-2">
                                <Badge variant="outline" className="h-5 capitalize text-[9px] border-amber-500/20 bg-amber-500/5 text-amber-500">{step.node}</Badge>
                                <span className="text-[11px] text-muted-foreground">{step.content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Citations list pills */}
                    {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 mt-1 px-1">
                        {msg.citations.map((citation, cIdx) => (
                          <button
                            key={cIdx}
                            onClick={() => handleCitationClick(citation)}
                            type="button"
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded-lg bg-secondary/40 hover:bg-secondary border border-border/40 hover:border-foreground/20 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                          >
                            <FileText className="w-3 h-3 text-primary shrink-0" />
                            <span>{citation.source}</span>
                            {citation.page !== undefined && citation.page !== null && (
                              <span className="text-[9px] opacity-75">p.{citation.page}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                  </div>

                </div>
              </div>
            ))}

            {/* Active loader or live trace items */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full border border-border/40 bg-secondary/60 text-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 animate-pulse" />
                  </div>

                  <div className="space-y-3">
                    
                    {/* Standard pulsing loader */}
                    <div className="bg-card/45 border border-border/50 rounded-xl rounded-tl-none p-4 flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }}></span>
                      <span className="ml-1 text-[11px] text-muted-foreground">J.A.R.V.I.S. is synthesizing...</span>
                    </div>

                    {/* Step-by-step trace stream block if mode is agent */}
                    {mode === "agent" && agentSteps.length > 0 && (
                      <div className="p-3.5 rounded-xl border border-border/30 bg-secondary/10 space-y-2 max-w-lg">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-amber-500 block">Orchestrator SSE Stream</span>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {agentSteps.map((step, sIdx) => (
                            <div key={sIdx} className="flex gap-2 text-[10px] items-start">
                              <span className="font-mono text-amber-500 font-bold capitalize select-none shrink-0">[{step.node}]</span>
                              <span className="text-muted-foreground">{step.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Suggested followup questions */}
        {messages.length === 0 && (
          <div className="px-6 py-2 flex flex-wrap gap-2 justify-center shrink-0">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestedClick(q)}
                className="px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/25 hover:bg-secondary hover:border-foreground/20 text-[11px] text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input Text Form */}
        <div className="p-4 border-t border-border/30 bg-secondary/10 shrink-0">
          <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto">
            <Input 
              ref={inputRef}
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              placeholder={mode === "agent" ? "Input orchestrator goal (e.g. verify compliance)..." : "Query your second brain context..."} 
              disabled={isLoading}
              className="flex-1 pr-12 pl-4 bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20 rounded-xl h-11 text-xs"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={isLoading || !input.trim()}
              className="absolute right-1 w-9 h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>

      </div>

      {/* Citation Detail Dialog Drawer */}
      <Dialog open={isCitationOpen} onOpenChange={setIsCitationOpen}>
        <DialogContent className="sm:max-w-md bg-popover border border-border rounded-xl shadow-2xl glass-panel-elevated text-foreground">
          <DialogHeader className="border-b border-border/40 pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Citation Source Provenance
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-[11px]">
              Retrieved evidence node aligned with system facts.
            </DialogDescription>
          </DialogHeader>
          
          {activeCitation && (
            <div className="space-y-4 my-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-secondary/35 rounded-lg p-2.5 border border-border/40">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Source file</span>
                  <span className="font-medium font-mono text-foreground break-all">{activeCitation.source}</span>
                </div>
                <div className="bg-secondary/35 rounded-lg p-2.5 border border-border/40">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Vector Score</span>
                  <span className="font-semibold text-foreground">{(activeCitation.score * 100).toFixed(2)}% Relevance</span>
                </div>
                {activeCitation.page !== undefined && activeCitation.page !== null && (
                  <div className="bg-secondary/35 rounded-lg p-2.5 border border-border/40">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Index Page</span>
                    <span className="font-medium text-foreground">Page {activeCitation.page}</span>
                  </div>
                )}
                {activeCitation.clause_id && (
                  <div className="bg-secondary/35 rounded-lg p-2.5 border border-border/40">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block mb-0.5">Clause / Element</span>
                    <span className="font-medium text-foreground font-mono">{activeCitation.clause_id}</span>
                  </div>
                )}
              </div>
              
              <div className="bg-secondary/35 rounded-xl p-3.5 border border-border/40 space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">Verified Segment Snippet</span>
                <p className="text-xs font-sans leading-relaxed text-foreground whitespace-pre-wrap italic">
                  "{activeCitation.snippet}"
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading chat...</div>}>
      <ChatContent />
    </Suspense>
  );
}
