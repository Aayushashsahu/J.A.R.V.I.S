"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, usePathname } from "next/navigation";
import { 
  Home, MessageSquare, FileText, Network, BrainCircuit, Lightbulb, 
  Clock, Sun, Moon, Search, Command, ChevronLeft, ChevronRight, 
  Settings, Database, HelpCircle, Activity, Shield, Sparkles, LogOut, Loader2
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [userProfile, setUserProfile] = useState<{ email: string } | null>(null);

  // Initialize theme and sidebar state
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
    setTheme(savedTheme);
    const root = document.documentElement;
    if (savedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const savedSidebar = localStorage.getItem("sidebarCollapsed") === "true";
    setSidebarCollapsed(savedSidebar);
    
    // Fetch profile if any (mock or real)
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          setUserProfile({ email: payload.sub || "User" });
        }
      } catch (e) {
        setUserProfile({ email: "Profile" });
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    const root = document.documentElement;
    if (nextTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", nextTheme);
  };

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem("sidebarCollapsed", String(nextState));
  };

  // Fetch workspaces
  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const data = await api.get("/workspaces");
        setWorkspaces(data);
        if (data.length > 0) {
          setActiveWorkspace(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch workspaces", err);
        router.push("/login");
      }
    }
    fetchWorkspaces();
  }, [router]);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      ) {
        // Allow escape to close palette even if in input
        if (e.key === "Escape" && commandPaletteOpen) {
          setCommandPaletteOpen(false);
        }
        return;
      }

      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash = e.key === '/';

      if (isCmdK) {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      } else if (isSlash) {
        e.preventDefault();
        const chatUrl = `/dashboard/chat?workspace=${activeWorkspace}`;
        if (!pathname.startsWith('/dashboard/chat')) {
          router.push(chatUrl);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('focus-chat-input'));
          }, 150);
        } else {
          window.dispatchEvent(new CustomEvent('focus-chat-input'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathname, router, activeWorkspace, commandPaletteOpen]);

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "Memory Timeline", href: "/dashboard/timeline", icon: Clock },
    { name: "Second Brain Chat", href: `/dashboard/chat?workspace=${activeWorkspace}`, icon: MessageSquare },
    { name: "Document Ingestion", href: `/dashboard/documents?workspace=${activeWorkspace}`, icon: FileText },
    { name: "Knowledge Graph", href: "/dashboard/graph", icon: Network },
        { name: "Neural Connections", href: "/dashboard/neural", icon: Sparkles },
    { name: "Reflections & Beliefs", href: "/dashboard/beliefs", icon: BrainCircuit },
    { name: "Smart Suggestions", href: "/dashboard/suggestions", icon: Lightbulb }
  ];

  // Commands for command palette
  const commandsList = [
    { category: "Navigation", name: "Go to Workspace Overview", action: () => router.push("/dashboard"), icon: Home },
    { category: "Navigation", name: "Go to Second Brain Chat", action: () => router.push(`/dashboard/chat?workspace=${activeWorkspace}`), icon: MessageSquare },
    { category: "Navigation", name: "Go to Document Ingestion", action: () => router.push(`/dashboard/documents?workspace=${activeWorkspace}`), icon: FileText },
    { category: "Navigation", name: "Go to Knowledge Graph", action: () => router.push("/dashboard/graph"), icon: Network },
    { category: "Navigation", name: "Go to Reflections & Beliefs", action: () => router.push("/dashboard/beliefs"), icon: BrainCircuit },
    { category: "Navigation", name: "Go to Smart Suggestions", action: () => router.push("/dashboard/suggestions"), icon: Lightbulb },
    { category: "Navigation", name: "Go to Memory Timeline", action: () => router.push("/dashboard/timeline"), icon: Clock },
    { category: "System", name: "Switch to Dark Mode", action: () => { setTheme("dark"); document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }, icon: Moon },
    { category: "System", name: "Switch to Light Mode", action: () => { setTheme("light"); document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }, icon: Sun },
    { category: "System", name: "Collapse/Expand Sidebar", action: () => toggleSidebar(), icon: ChevronLeft },
    { category: "Auth", name: "Log Out / Exit Platform", action: () => { localStorage.removeItem("token"); router.push("/login"); }, icon: LogOut },
  ];

  // Filter commands
  const filteredCommands = commandsList.filter(cmd => 
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cmd.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCommandTrigger = (action: () => void) => {
    action();
    setCommandPaletteOpen(false);
    setSearchQuery("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground transition-all duration-300">
      
      {/* Sidebar Navigation */}
      <aside 
        className={`relative flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 z-20 shrink-0 ${
          sidebarCollapsed ? "w-[68px]" : "w-64"
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center font-bold tracking-tight shadow-md shrink-0 select-none">
              J
            </div>
            {!sidebarCollapsed && (
              <span className="text-sm font-semibold tracking-wider font-mono text-foreground uppercase truncate">
                J.A.R.V.I.S.
              </span>
            )}
          </div>
          
          <button 
            onClick={toggleSidebar}
            className="p-1 rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-sidebar-border">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-lg bg-sidebar-accent border border-sidebar-border flex items-center justify-center font-bold text-xs cursor-pointer hover:border-foreground/30 transition-colors" title="Switch Workspace">
                {workspaces.find(w => w.id === activeWorkspace)?.name?.[0]?.toUpperCase() || "W"}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-sidebar-foreground/40 block px-1">Active Space</span>
              <Select value={activeWorkspace} onValueChange={(v) => v && setActiveWorkspace(v)}>
                <SelectTrigger className="w-full h-9 bg-sidebar-accent/50 border-sidebar-border/80 focus:ring-1 focus:ring-foreground/10 text-xs">
                  <SelectValue placeholder="Select Workspace" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="text-xs">{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <div className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-widest mb-3 px-3 pt-2">
              Cognitive Engine
            </div>
          )}
          {navItems.map((item) => {
            const isActive = pathname === item.href.split("?")[0];
            return (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-xs relative ${
                  isActive 
                  ? 'bg-sidebar-accent text-foreground font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] border border-sidebar-border/60' 
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-foreground border border-transparent'
                }`}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <item.icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-foreground' : 'text-sidebar-foreground/50'}`} />
                {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                {isActive && !sidebarCollapsed && (
                  <span className="absolute right-2 w-1 h-1.5 rounded-full bg-foreground" />
                )}
              </a>
            );
          })}
        </nav>

        {/* User profile / status indicator bar */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/10 flex flex-col gap-2">
          {/* System status */}
          <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/50">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-indicator-glow animate-pulse"></span>
              {!sidebarCollapsed && <span>Engine Active</span>}
            </div>
            
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              type="button"
              className="p-1 rounded-md text-sidebar-foreground/40 hover:text-foreground hover:bg-sidebar-accent transition-colors"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* User badge */}
          {userProfile && !sidebarCollapsed && (
            <div className="flex items-center justify-between pt-1 border-t border-sidebar-border/30">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-zinc-800 text-[10px] text-zinc-300 flex items-center justify-center font-semibold border border-white/5 uppercase shrink-0">
                  {userProfile.email[0]}
                </div>
                <span className="text-[11px] text-sidebar-foreground/75 truncate select-none">
                  {userProfile.email.split('@')[0]}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1 rounded-md text-sidebar-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors" 
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        
        {/* Global Header Bar */}
        <header className="h-16 border-b border-border/40 px-6 flex items-center justify-between shrink-0 glass-panel z-10">
          
          {/* Breadcrumb / Title Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium font-mono text-muted-foreground/60">J.A.R.V.I.S.</span>
            <span className="text-xs text-muted-foreground/30">/</span>
            <span className="text-xs font-semibold tracking-tight text-foreground/80">
              {navItems.find(item => pathname === item.href.split("?")[0])?.name || "Overview"}
            </span>
          </div>

          {/* Search Trigger Command Bar (⌘K) */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/35 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:bg-secondary/60 transition-all w-48 md:w-64"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span className="text-left flex-1 font-sans">Search platform...</span>
              <kbd className="hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground/80">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
            
            {/* Quick Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/10 bg-emerald-500/5 text-emerald-500 font-mono text-[10px]">
              <Shield className="w-3 h-3" />
              Secure RAG Node
            </div>
          </div>
        </header>

        {/* Page children wrapped in relative overlay for premium layout spacing */}
        <main className="flex-1 overflow-y-auto relative p-6 md:p-8 bg-background/95">
          {children}
        </main>
      </div>

      {/* Command Palette Dialog */}
      <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-popover border border-border/80 rounded-xl shadow-2xl glass-panel-elevated">
          <div className="flex items-center border-b border-border/60 px-4 py-3 bg-secondary/30">
            <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-3" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workspaces, pages, engine controls..." 
              className="w-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground focus:ring-0"
              autoFocus
            />
            <kbd className="h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
          
          <div className="max-h-[320px] overflow-y-auto p-2 space-y-3">
            {filteredCommands.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No commands matching "{searchQuery}"
              </div>
            ) : (
              // Group commands by category
              ["Navigation", "System", "Auth"].map(category => {
                const categoryCmds = filteredCommands.filter(c => c.category === category);
                if (categoryCmds.length === 0) return null;
                return (
                  <div key={category}>
                    <div className="text-[10px] font-semibold text-muted-foreground/45 uppercase tracking-wider px-3 py-1.5 select-none">
                      {category}
                    </div>
                    <div className="space-y-0.5">
                      {categoryCmds.map((cmd, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleCommandTrigger(cmd.action)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs hover:bg-secondary/60 hover:text-foreground text-muted-foreground transition-all duration-100 group"
                        >
                          <div className="flex items-center gap-3">
                            <cmd.icon className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                            <span>{cmd.name}</span>
                          </div>
                          <kbd className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground/60 font-mono transition-opacity">
                            ↵ Enter
                          </kbd>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="p-3 border-t border-border/50 bg-secondary/15 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>↑↓ Navigation</span>
            <span>⌘K Toggle Palette</span>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
