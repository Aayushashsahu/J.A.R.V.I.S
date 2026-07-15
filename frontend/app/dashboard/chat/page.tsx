"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { Bot, User as UserIcon, Send, RefreshCw } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCitationClick = (citation: Citation) => {
    setActiveCitation(citation);
    setIsCitationOpen(true);
  };

  const handleResetDemo = () => {
    setMessages([]);
    setConversationId(null);
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
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !workspaceId) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsLoading(true);

    try {
      const payload: any = { message: userMessage };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }
      
      const response = await api.post(`/workspaces/${workspaceId}/chat`, payload);
      
      console.log("Citations list:", response.citations);
      
      if (!conversationId) setConversationId(response.conversation_id);
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: response.message, 
        citations: response.citations 
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!workspaceId) {
    return <div className="p-8 text-destructive text-center">Please select a workspace from the sidebar.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-5xl mx-auto my-4 border border-white/10 rounded-2xl bg-black/40 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-primary" />
          <div>
            <h2 className="font-semibold text-lg text-foreground tracking-tight">Second Brain Chat</h2>
            <p className="text-xs text-muted-foreground">Ask J.A.R.V.I.S. about your workspace memory</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleResetDemo}
          className="flex items-center gap-1.5 bg-secondary/30 border-white/10 hover:bg-secondary/50 text-xs h-8 px-3 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset demo
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground mt-20 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <p className="text-lg">How can I assist you today?</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className="flex flex-col gap-2">
                  <div className={`rounded-2xl p-4 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap' : 'bg-secondary/50 backdrop-blur-md border border-white/5 text-foreground rounded-tl-sm prose prose-invert max-w-none'}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1 px-1">
                      {msg.citations.map((citation, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => handleCitationClick(citation)}
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-full bg-secondary/60 hover:bg-secondary/80 border border-white/5 hover:border-white/10 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <span>📄</span>
                          <span>{citation.source}</span>
                          {citation.page !== undefined && citation.page !== null && (
                            <span>p. {citation.page}</span>
                          )}
                          {citation.clause_id && (
                            <span>[{citation.clause_id}]</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-secondary/50 backdrop-blur-md border border-white/5 text-foreground rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-white/10 bg-black/20">
        <form onSubmit={handleSend} className="relative flex items-center">
          <Input 
            ref={inputRef}
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Query your second brain..." 
            disabled={isLoading}
            className="flex-1 pr-12 bg-background/50 border-white/10 focus-visible:ring-primary rounded-xl h-12"
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={isLoading || !input.trim()}
            className="absolute right-1 w-10 h-10 rounded-lg"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      {/* Citation Detail Dialog */}
      <Dialog open={isCitationOpen} onOpenChange={setIsCitationOpen}>
        <DialogContent className="sm:max-w-md bg-secondary/95 backdrop-blur-lg border border-white/10 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <span>📄</span> Citation Source Details
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Retrieved context that supported the response.
            </DialogDescription>
          </DialogHeader>
          {activeCitation && (
            <div className="space-y-4 my-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Source file</span>
                  <span className="font-medium font-mono text-foreground break-all">{activeCitation.source}</span>
                </div>
                <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Relevance Score</span>
                  <span className="font-medium text-foreground">{(activeCitation.score * 100).toFixed(2)}%</span>
                </div>
                {activeCitation.page !== undefined && activeCitation.page !== null && (
                  <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Page</span>
                    <span className="font-medium text-foreground">Page {activeCitation.page}</span>
                  </div>
                )}
                {activeCitation.clause_id && (
                  <div className="bg-black/35 rounded-lg p-2.5 border border-white/5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">Section / Clause</span>
                    <span className="font-medium text-foreground">{activeCitation.clause_id}</span>
                  </div>
                )}
              </div>
              <div className="bg-black/35 rounded-xl p-4 border border-white/5 space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Snippet text preview</span>
                <p className="text-sm font-sans leading-relaxed text-foreground whitespace-pre-wrap italic">
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
