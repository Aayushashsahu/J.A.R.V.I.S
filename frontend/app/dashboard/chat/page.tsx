"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot, User as UserIcon, Send, RefreshCw, Copy, Check, Sparkles,
  Settings2, History, AlertCircle, FileText,
  Volume2, VolumeX, Mic, MicOff, MessageSquare,
  Trash2, Plus, ChevronDown, ChevronUp
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";


/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

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
  timestamp?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  workspaceId: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT HISTORY PERSISTENCE (localStorage)
   ═══════════════════════════════════════════════════════════════════════════ */

const CHAT_STORAGE_KEY = "jarvis_chat_sessions";

function loadChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChatSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage full — silently drop oldest sessions
    const trimmed = sessions.slice(0, 50);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  }
}

function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SPEECH HOOKS (TTS + STT)
   ═══════════════════════════════════════════════════════════════════════════ */

function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, msgIndex: number) => {
    // Stop any current speech
    window.speechSynthesis.cancel();

    if (speakingId === msgIndex) {
      setSpeakingId(null);
      return;
    }

    // Strip markdown formatting for cleaner speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' code block omitted ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to pick a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Natural') ||
      v.name.includes('Samantha') || v.name.includes('Daniel') ||
      v.lang.startsWith('en')
    );
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(msgIndex);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  return { speakingId, speak, stop };
}

function useSpeechRecognition(onResult: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
          onResult(last[0].transcript);
          setIsListening(false);
        }
      };

      recognition.onerror = (e: any) => { console.warn('[STT] Recognition error:', e.error || e); setIsListening(false); };
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, [onResult]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Already started — restart
      recognitionRef.current.stop();
      setTimeout(() => {
        recognitionRef.current?.start();
        setIsListening(true);
      }, 100);
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN CHAT LOGIC HOOK
   ═══════════════════════════════════════════════════════════════════════════ */

function useChatLogic(workspaceId: string | null) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Advanced search settings
  const [mode, setMode] = useState<"rag" | "agent">("rag");
  const [topK, setTopK] = useState<number>(5);
  const [useHybrid, setUseHybrid] = useState<boolean>(false);

  // Step-by-step tracing
  const [agentSteps, setAgentSteps] = useState<{ node: string; content: string }[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load sessions from localStorage on mount
  useEffect(() => {
    const loaded = loadChatSessions();
    setSessions(loaded);
  }, []);

  // Persist sessions when they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveChatSessions(sessions);
    }
  }, [sessions]);

  // Create a new chat session — returns the new ID for immediate use
  const createNewSession = useCallback((): string => {
    const id = generateSessionId();
    const session: ChatSession = {
      id,
      title: "New Conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspaceId: workspaceId || "",
    };
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(id);
    setMessages([]);
    setConversationId(null);
    setAgentSteps([]);
    inputRef.current?.focus();
    return id;
  }, [workspaceId]);

  // Switch to an existing session
  const switchSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(sessionId);
      setMessages(session.messages);
      setConversationId(null);
      setAgentSteps([]);
    }
  }, [sessions]);

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      createNewSession();
    }
  }, [activeSessionId, createNewSession]);

  // Update a session's messages by ID (avoids stale closure issues)
  const updateSessionMessages = useCallback((sessionId: string, msgs: Message[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const firstUserMsg = msgs.find(m => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? "..." : "")
        : s.title;
      return { ...s, messages: msgs, title, updatedAt: Date.now() };
    }));
  }, []);

  // Reset demo (clear current session)
  const handleResetDemo = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setAgentSteps([]);
    if (activeSessionId) {
      updateSessionMessages(activeSessionId, []);
    }
  }, [activeSessionId, updateSessionMessages]);

  useEffect(() => {
    const handleFocusEvent = () => inputRef.current?.focus();
    window.addEventListener('focus-chat-input', handleFocusEvent);
    return () => window.removeEventListener('focus-chat-input', handleFocusEvent);
  }, []);

  const executeRagMode = async (userMessage: string, wsId: string, token: string | null, apiBase: string, sessionId: string) => {
    try {
      const res = await fetch(`${apiBase}/workspaces/${wsId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMessage,
          workspace_id: wsId,
          top_k: topK,
          use_hybrid: useHybrid
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Chat API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.message || data.response || 'No response',
        citations: data.citations || [],
        mode: 'rag',
        timestamp: Date.now()
      };
      setMessages(prev => {
        const updated = [...prev, assistantMsg];
        updateSessionMessages(sessionId, updated);
        return updated;
      });
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `Error: ${err.message}`,
        mode: 'rag',
        timestamp: Date.now()
      };
      setMessages(prev => {
        const updated = [...prev, errorMsg];
        updateSessionMessages(sessionId, updated);
        return updated;
      });
    }
  };

  const executeAgentMode = async (userMessage: string, wsId: string, token: string | null, apiBase: string, sessionId: string) => {
    try {
      const res = await fetch(`${apiBase}/agent/orchestrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          workspace_id: wsId,
          goal: userMessage,
          max_steps: 5
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Agent API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.final_answer || data.message || 'Agent completed',
        citations: data.citations || [],
        mode: 'agent',
        steps: data.steps || [],
        timestamp: Date.now()
      };
      setMessages(prev => {
        const updated = [...prev, assistantMsg];
        updateSessionMessages(sessionId, updated);
        return updated;
      });
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'assistant',
        content: `Error: ${err.message}`,
        mode: 'agent',
        timestamp: Date.now()
      };
      setMessages(prev => {
        const updated = [...prev, errorMsg];
        updateSessionMessages(sessionId, updated);
        return updated;
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !workspaceId) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setAgentSteps([]);

    // Auto-create session if none active — capture the ID immediately
    const currentSessionId = activeSessionId || createNewSession();

    const userMsg: Message = {
      role: "user",
      content: userMessage,
      mode,
      timestamp: Date.now()
    };

    setMessages(prev => {
      const updated = [...prev, userMsg];
      updateSessionMessages(currentSessionId, updated);
      return updated;
    });

    const token = localStorage.getItem('token');
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    try {
      if (mode === "agent") {
        await executeAgentMode(userMessage, workspaceId, token, API_URL, currentSessionId);
      } else {
        await executeRagMode(userMessage, workspaceId, token, API_URL, currentSessionId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedClick = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  return {
    sessions, activeSessionId, messages, input, setInput,
    isLoading, agentSteps, mode, setMode, topK, setTopK,
    useHybrid, setUseHybrid, inputRef, handleSend,
    handleResetDemo, handleSuggestedClick,
    createNewSession, switchSession, deleteSession
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatSidebar({
  mode, setMode, topK, setTopK, useHybrid, setUseHybrid,
  sessions, activeSessionId, createNewSession, switchSession, deleteSession
}: {
  mode: "rag" | "agent", setMode: (m: "rag" | "agent") => void,
  topK: number, setTopK: (k: number) => void,
  useHybrid: boolean, setUseHybrid: (h: boolean) => void,
  sessions: ChatSession[], activeSessionId: string | null,
  createNewSession: () => void, switchSession: (id: string) => void,
  deleteSession: (id: string) => void
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="hidden lg:flex flex-col w-72 bg-card/25 border border-border/40 rounded-2xl p-4 shrink-0 space-y-4">

      {/* Mode Selector */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 block px-1">Copilot Mode</span>
        <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary/50 border border-border/40">
          <button
            onClick={() => setMode("rag")}
            className={`py-1.5 rounded-lg text-center text-xs font-medium transition-all ${
              mode === "rag"
                ? "bg-popover text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Document Search
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

      {/* New Chat Button */}
      <button
        onClick={createNewSession}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/60 hover:border-foreground/30 bg-secondary/20 hover:bg-secondary/40 text-xs text-muted-foreground hover:text-foreground transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        New Conversation
      </button>

      {/* Chat History */}
      <div className="flex-1 flex flex-col space-y-2 min-h-0">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between px-1 hover:opacity-80 transition-opacity"
        >
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            Chat History
            <span className="text-[9px] font-normal normal-case tracking-normal">({sessions.length})</span>
          </span>
          {showHistory ? <ChevronUp className="w-3 h-3 text-muted-foreground/50" /> : <ChevronDown className="w-3 h-3 text-muted-foreground/50" />}
        </button>

        {showHistory && (
          <div className="space-y-1 overflow-y-auto pr-1 flex-1 min-h-0">
            {sessions.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40 text-center py-4">No conversations yet</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                    session.id === activeSessionId
                      ? "bg-secondary/70 text-foreground font-medium border border-border/50"
                      : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground border border-transparent"
                  }`}
                  onClick={() => switchSession(session.id)}
                >
                  <MessageSquare className={`w-3 h-3 shrink-0 ${session.id === activeSessionId ? "text-primary" : "text-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-[11px]">{session.title}</span>
                    <span className="block text-[9px] text-muted-foreground/40 mt-0.5">{formatTime(session.updatedAt)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 hover:text-destructive transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="border-t border-border/30 pt-3 space-y-3">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground/80 hover:text-foreground px-1 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Retrieval Controls
          </span>
          {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showSettings && (
          <div className="space-y-3 p-3 rounded-xl bg-secondary/35 border border-border/30">
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
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatHeader({ mode, handleResetDemo, isListening }: { mode: string, handleResetDemo: () => void, isListening: boolean }) {
  return (
    <div className="px-5 py-4 border-b border-border/30 bg-secondary/15 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Bot className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Industrial AI Copilot</h3>
          <p className="text-[10px] text-muted-foreground leading-normal flex items-center gap-1.5">
            {isListening && (
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Listening...
              </span>
            )}
            {!isListening && (
              mode === "agent" ? "Multi-step reasoning engine" : "RAG-powered document retrieval"
            )}
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
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE LIST (with TTS, smooth scroll)
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatMessageList({
  messages, isLoading, mode, agentSteps, handleCitationClick,
  speakingId, speakTts
}: {
  messages: Message[], isLoading: boolean, mode: string,
  agentSteps: { node: string; content: string }[],
  handleCitationClick: (c: Citation) => void,
  speakingId: number | null,
  speakTts: (text: string, idx: number) => void
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Detect if user has scrolled up to disable auto-scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, agentSteps, autoScroll]);

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTimestamp = (ts?: number) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-6 scroll-smooth"
    >
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/15 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold">How can J.A.R.V.I.S. assist your plant?</h4>
              <p className="text-xs text-muted-foreground max-w-sm leading-normal">
                Ask about equipment failures, find SOPs, check compliance, or analyze maintenance records.
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full border border-border/40 flex items-center justify-center shrink-0 mt-0.5 transition-transform hover:scale-110 ${
                msg.role === 'user'
                  ? 'bg-foreground text-background font-semibold text-xs'
                  : 'bg-secondary/60 text-foreground'
              }`}>
                {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="flex flex-col gap-1.5">
                {/* Message bubble */}
                <div className={`rounded-xl p-4 text-xs leading-relaxed transition-all relative group border ${
                  msg.role === 'user'
                    ? 'bg-foreground/5 text-foreground border-border/50 rounded-tr-none'
                    : 'bg-card/45 border-border/50 rounded-tl-none text-foreground/90'
                }`}>

                  {/* Hover controls */}
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {/* TTS button for assistant messages */}
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => speakTts(msg.content, idx)}
                        className="p-1 rounded bg-secondary/80 border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title={speakingId === idx ? "Stop reading" : "Read aloud"}
                      >
                        {speakingId === idx ? (
                          <VolumeX className="w-3.5 h-3.5 text-primary animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopyText(msg.content, idx)}
                      className="p-1 rounded bg-secondary/80 border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy text"
                    >
                      {copiedId === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Content */}
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-secondary/50 prose-pre:border-border/50 max-w-none text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Agent execution steps */}
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

                {/* Timestamp + Citations */}
                <div className="flex flex-col gap-1.5 px-1">
                  {msg.timestamp && (
                    <span className="text-[9px] text-muted-foreground/30">{formatTimestamp(msg.timestamp)}</span>
                  )}

                  {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2">
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
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full border border-border/40 bg-secondary/60 text-foreground flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="space-y-3">
                <div className="bg-card/45 border border-border/50 rounded-xl rounded-tl-none p-4 flex items-center gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  <span className="ml-1 text-[11px] text-muted-foreground">Analyzing industrial documents...</span>
                </div>

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

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      {!autoScroll && messages.length > 0 && (
        <button
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            setAutoScroll(true);
          }}
          className="fixed bottom-28 right-8 w-10 h-10 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
          title="Scroll to bottom"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INPUT AREA (with STT voice input)
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatInputArea({
  input, setInput, isLoading, mode, inputRef, handleSend, handleSuggestedClick,
  suggestedQuestions, hasMessages, isListening, startListening, stopListening, sttSupported
}: {
  input: string, setInput: (v: string) => void, isLoading: boolean, mode: string,
  inputRef: React.RefObject<HTMLInputElement | null>, handleSend: (e: React.FormEvent) => void,
  handleSuggestedClick: (text: string) => void, suggestedQuestions: string[], hasMessages: boolean,
  isListening: boolean, startListening: () => void, stopListening: () => void, sttSupported: boolean
}) {
  return (
    <>
      {/* Suggested questions */}
      {!hasMessages && (
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

      {/* Input form */}
      <div className="p-4 border-t border-border/30 bg-secondary/10 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto gap-2">
          {/* Voice input button */}
          {sttSupported && (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? "bg-red-500/20 border border-red-500/40 text-red-400 animate-pulse"
                  : "bg-secondary/50 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : mode === "agent" ? "Describe your analysis goal (e.g. root cause analysis)..." : "Ask about equipment, SOPs, maintenance..."}
            disabled={isLoading}
            className="flex-1 pr-12 pl-4 bg-background/50 border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20 rounded-xl h-11 text-xs"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="absolute right-1 w-9 h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CITATION DIALOG
   ═══════════════════════════════════════════════════════════════════════════ */

function CitationDialogContent({ activeCitation }: { activeCitation: Citation | null }) {
  if (!activeCitation) return null;

  return (
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
          &ldquo;{activeCitation.snippet}&rdquo;
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace");

  const {
    sessions, activeSessionId, messages, input, setInput,
    isLoading, agentSteps, mode, setMode, topK, setTopK,
    useHybrid, setUseHybrid, inputRef, handleSend,
    handleResetDemo, handleSuggestedClick,
    createNewSession, switchSession, deleteSession
  } = useChatLogic(workspaceId);

  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isCitationOpen, setIsCitationOpen] = useState(false);

  // TTS hook
  const { speakingId, speak: speakTts } = useSpeechSynthesis();

  // STT hook
  const handleSttResult = useCallback((transcript: string) => {
    setInput(prev => prev ? prev + " " + transcript : transcript);
    inputRef.current?.focus();
  }, [setInput, inputRef]);
  const { isListening, isSupported: sttSupported, startListening, stopListening } = useSpeechRecognition(handleSttResult);

  const handleCitationClick = (citation: Citation) => {
    setActiveCitation(citation);
    setIsCitationOpen(true);
  };

  if (!workspaceId) {
    return (
      <div className="p-8 text-destructive text-center flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <AlertCircle className="w-8 h-8 text-destructive/80" />
        <h3 className="font-semibold">Plant Context Required</h3>
        <p className="text-xs text-muted-foreground max-w-sm leading-normal">
          Please select a plant from the sidebar menu to access industrial documents and procedures.
        </p>
      </div>
    );
  }

  const suggestedQuestions = [
    "Why did Pump P-204 fail?",
    "Show SOP for Boiler Startup",
    "What maintenance happened last month?"
  ];

  return (
    <div className="flex h-[calc(100vh-10rem)] max-w-7xl mx-auto gap-6">
      <ChatSidebar
        mode={mode} setMode={setMode}
        topK={topK} setTopK={setTopK}
        useHybrid={useHybrid} setUseHybrid={setUseHybrid}
        sessions={sessions} activeSessionId={activeSessionId}
        createNewSession={createNewSession} switchSession={switchSession}
        deleteSession={deleteSession}
      />

      <div className="flex-1 flex flex-col bg-card/25 border border-border/40 rounded-2xl overflow-hidden shadow-sm relative">
        <ChatHeader mode={mode} handleResetDemo={handleResetDemo} isListening={isListening} />

        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          mode={mode}
          agentSteps={agentSteps}
          handleCitationClick={handleCitationClick}
          speakingId={speakingId}
          speakTts={speakTts}
        />

        <ChatInputArea
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          mode={mode}
          inputRef={inputRef}
          handleSend={handleSend}
          handleSuggestedClick={handleSuggestedClick}
          suggestedQuestions={suggestedQuestions}
          hasMessages={messages.length > 0}
          isListening={isListening}
          startListening={startListening}
          stopListening={stopListening}
          sttSupported={sttSupported}
        />
      </div>

      <Dialog open={isCitationOpen} onOpenChange={setIsCitationOpen}>
        <DialogContent className="sm:max-w-md bg-popover border border-border rounded-xl shadow-2xl glass-panel-elevated text-foreground">
          <DialogHeader className="border-b border-border/40 pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Document Source
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-[11px]">
              Retrieved evidence from industrial knowledge base.
            </DialogDescription>
          </DialogHeader>
          <CitationDialogContent activeCitation={activeCitation} />
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
