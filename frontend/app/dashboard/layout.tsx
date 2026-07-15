"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, usePathname } from "next/navigation";
import { Home, MessageSquare, FileText, Network, BrainCircuit, Lightbulb, Clock, Sun, Moon } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Determine initial theme on mount
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
    setTheme(savedTheme);
    
    const root = document.documentElement;
    if (savedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is already typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      ) {
        return;
      }

      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const isSlash = e.key === '/';

      if (isCmdK || isSlash) {
        e.preventDefault();
        
        const chatUrl = `/dashboard/chat?workspace=${activeWorkspace}`;
        if (!pathname.startsWith('/dashboard/chat')) {
          router.push(chatUrl);
          // Wait a brief moment for navigation to mount and add listener
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
  }, [pathname, router, activeWorkspace]);

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "Timeline", href: "/dashboard/timeline", icon: Clock },
    { name: "Second Brain Chat", href: `/dashboard/chat?workspace=${activeWorkspace}`, icon: MessageSquare },
    { name: "Documents", href: `/dashboard/documents?workspace=${activeWorkspace}`, icon: FileText },
    { name: "Knowledge Graph", href: "/dashboard/graph", icon: Network },
    { name: "Reflections", href: "/dashboard/beliefs", icon: BrainCircuit },
    { name: "Suggestions", href: "/dashboard/suggestions", icon: Lightbulb }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col text-sidebar-foreground">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">J</div>
            <h1 className="text-xl font-semibold tracking-tight">J.A.R.V.I.S.</h1>
          </div>
          <Select value={activeWorkspace} onValueChange={(v) => v && setActiveWorkspace(v)}>
            <SelectTrigger className="w-full bg-background/50 backdrop-blur-md border-white/10">
              <SelectValue placeholder="Select Workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-4 px-2">Knowledge Base</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href.split("?")[0];
            return (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 ${
                  isActive 
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm' 
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </a>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border flex items-center justify-between text-xs text-sidebar-foreground/40">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            System Online
          </div>
          <button
            onClick={toggleTheme}
            type="button"
            className="p-1.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all cursor-pointer text-sidebar-foreground/60"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background/95">
        {children}
      </main>
    </div>
  );
}
