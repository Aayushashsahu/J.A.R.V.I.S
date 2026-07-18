"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_URL } from "@/lib/api";
import { Bot, User as UserIcon, Send, RefreshCw, Layers, ShieldAlert, Sparkles, X, Star, XCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/toast";

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
  isStreaming?: boolean;
}

function ChatContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useHybrid, setUseHybrid] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Citations Sidebar / Drawer State
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isCitationOpen, setIsCitationOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isScrolledToBottomRef = useRef(true);

  const handleCitationClick = (citation: Citation) => {
    setActiveCitation(citation);
    setIsCitationOpen(true);
  };

  const handleResetDemo = () => {
    setMessages([]);
    setConversationId(null);
    toast({
      title: "Conversation cleared",
      description: "Chat history and session memories have been reset.",
      variant: "info",
    });
  };

  const scrollToBottom = () => {
    if (isScrolledToBottomRef.current || messages.length === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      isScrolledToBottomRef.current = true;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;
    isScrolledToBottomRef.current = (scrollHeight - scrollTop - clientHeight) < 100;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !workspaceId) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // 1. Add User message
    const userMsgObj: Message = { role: "user", content: userMessage };
    setMessages(prev => [...prev, userMsgObj]);

    // 2. Add empty streaming placeholder for assistant
    const assistantMsgPlaceholder: Message = {
      role: "assistant",
      content: "",
      isStreaming: true,
      citations: [],
    };
    setMessages(prev => [...prev, assistantMsgPlaceholder]);

    try {
      const token = localStorage.getItem("token");
      const payload: any = {
        message: userMessage,
        use_hybrid: useHybrid,
        top_k: 5
      };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      // Call Streaming endpoint
      const response = await fetch(`${API_URL}/workspaces/${workspaceId}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Failed to initialize chat session stream");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Stream reader not supported");

      let buffer = "";
      let fullAssistantText = "";
      let finalCitations: Citation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE framing: lines starting with 'data: '
        const lines = buffer.split("\n");
        // Keep the last partial line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine.startsWith("data: ")) continue;
          
          const sseData = cleanedLine.slice(6);
          if (sseData === "[DONE]") continue;

          try {
            const parsed = JSON.parse(sseData);
            if (parsed.type === "token") {
              fullAssistantText += parsed.content;
              // Update assistant message content in real time
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  last.content = fullAssistantText;
                }
                return updated;
              });
            } else if (parsed.type === "citations") {
              finalCitations = parsed.citations || [];
            }
          } catch (err) {
            // Ignore incomplete JSON chunks in streaming lines
          }
        }
      }

      // Finish streaming update
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant") {
          last.isStreaming = false;
          last.citations = finalCitations;
        }
        return updated;
      });

      // Extract conversation_id if not present
      if (!conversationId) {
        // Just perform a rapid GET or infer session
        setConversationId("active_session_" + Date.now().toString().slice(-4));
      }

    } catch (err: any) {
      toast({
        title: "Streaming error",
        description: err.message || "Something went wrong during generation.",
        variant: "error",
      });
      // Replace placeholder with error
      setMessages(prev => {
        const updated = prev.slice(0, -1);
        return [
          ...updated,
          {
            role: "assistant",
            content: `Failed to generate a response: ${err.message || "API connection lost."}`
          }
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!workspaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Workspace Required</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-2">
          Please select a workspace from the sidebar selector to interact with your second brain.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-2.5rem)] max-w-6xl mx-auto overflow-hidden">
      {/* Chat Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full border border-white/10 rounded-2xl bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-foreground tracking-tight flex items-center gap-1.5">
                Second Brain RAG Console
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </h2>
              <p className="text-xs text-muted-foreground">
                Synthesizing answers using Priority RAG Evidence Hierarchy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Hybrid Switch */}
            <div className="flex items-center gap-2 bg-secondary/35 border border-white/5 rounded-lg px-2.5 py-1">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hybrid BM25</span>
              <button
                type="button"
                onClick={() => {
                  setUseHybrid(!useHybrid);
                  toast({
                    title: !useHybrid ? "Hybrid Search Enabled" : "Dense Search Enabled",
                    description: !useHybrid 
                      ? "Query uses BM25 keyword matching + Dense embeddings with RRF merging."
                      : "Query uses semantic dense vector similarity only.",
                    variant: "info",
                  });
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useHybrid ? "bg-primary" : "bg-white/15"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useHybrid ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDemo}
              className="flex items-center gap-1.5 bg-secondary/30 border-white/10 hover:bg-secondary/50 text-xs h-8 px-3 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </Button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-6" onScroll={handleScroll}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground mt-20 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Interactive Knowledge Base</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Ask questions about clearance rules (e.g. LPG clearance), inspections, and OISD standards in this workspace context.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md border ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-secondary text-secondary-foreground border-white/10'
                    }`}>
                      {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className="flex flex-col gap-2">
                      {/* Bubble */}
                      <div className={`rounded-2xl p-4 text-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-sm whitespace-pre-wrap shadow-lg' 
                          : 'bg-secondary/40 backdrop-blur-md border border-white/5 text-foreground rounded-tl-sm prose prose-invert max-w-none shadow-md'
                      }`}>
                        {msg.role === 'assistant' ? (
                          msg.content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <div className="flex items-center gap-2 py-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                              <span className="text-xs text-muted-foreground italic">Thinking...</span>
                            </div>
                          )
                        ) : (
                          msg.content
                        )}
                      </div>

                      {/* Citations badges */}
                      {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1 px-1">
                          {msg.citations.map((citation, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => handleCitationClick(citation)}
                              type="button"
                              className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-full bg-secondary/80 hover:bg-secondary border border-white/5 hover:border-white/15 transition-all duration-200 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <span>📄</span>
                              <span className="truncate max-w-[120px]">{citation.source}</span>
                              {citation.page !== undefined && citation.page !== null && (
                                <span className="opacity-80">p.{citation.page}</span>
                              )}
                              <Badge className="text-[9px] px-1 bg-primary/10 text-primary border border-primary/20 shrink-0">
                                {Math.round(citation.score * 100)}%
                              </Badge>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Tray */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <form onSubmit={handleSend} className="relative flex items-center space-x-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your second brain specifications..."
              disabled={isLoading}
              className="flex-1 pr-12 bg-background/50 border-white/10 focus-visible:ring-primary rounded-xl h-12 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 w-9 h-9 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Citations Side Drawer (Premium Dashboard Look) */}
      <AnimatePresence>
        {isCitationOpen && activeCitation && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCitationOpen(false)}
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
                  <Layers className="w-4 h-4 text-primary" />
                  Citation Telemetry
                </h3>
                <button
                  onClick={() => setIsCitationOpen(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">Source Manual</span>
                  <span className="font-semibold text-xs text-foreground block font-mono break-all bg-black/30 p-2.5 rounded-lg border border-white/5">
                    {activeCitation.source}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-semibold mb-0.5">Score</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                      {(activeCitation.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-semibold mb-0.5">Location</span>
                    <span className="font-semibold text-foreground">
                      {activeCitation.page ? `Page ${activeCitation.page}` : "In-line text"}
                    </span>
                  </div>
                </div>

                {activeCitation.clause_id && (
                  <div className="bg-black/35 rounded-lg p-2.5 border border-white/5 text-xs">
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-semibold mb-0.5">Ref Clause</span>
                    <span className="font-semibold text-foreground font-mono">{activeCitation.clause_id}</span>
                  </div>
                )}

                <div className="bg-black/35 rounded-xl p-4 border border-white/5 space-y-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">Retrieved Snippet</span>
                  <p className="text-xs font-sans leading-relaxed text-foreground whitespace-pre-wrap italic">
                    "{activeCitation.snippet}"
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Provenance validated by Second Brain RRF matcher.</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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