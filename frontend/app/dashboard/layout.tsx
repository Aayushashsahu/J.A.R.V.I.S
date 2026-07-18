"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, usePathname } from "next/navigation";
import { Home, MessageSquare, FileText, Network, BrainCircuit, Lightbulb, Clock, Sun, Moon, Search, Keyboard, Command } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>("");
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCmdKOpen, setIsCmdKOpen] = useState(false);

  useEffect(() => {
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
    toast({
      title: `${nextTheme === "dark" ? "Dark" : "Light"} mode enabled`,
      description: "Visual settings have been updated.",
      variant: "info",
    });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
    localStorage.setItem("sidebarOpen", String(!isSidebarOpen));
  };

  useEffect(() => {
    const savedSidebar = localStorage.getItem("sidebarOpen");
    if (savedSidebar !== null) {
      setIsSidebarOpen(savedSidebar === "true");
    }
  }, []);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const data = await api.get("/workspaces");
        setWorkspaces(data);
        if (data.length > 0) {
          // Check URL first or local storage
          const savedWs = localStorage.getItem("activeWorkspaceId");
          if (savedWs && data.some((w: any) => w.id === savedWs)) {
            setActiveWorkspace(savedWs);
          } else {
            setActiveWorkspace(data[0].id);
            localStorage.setItem("activeWorkspaceId", data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch workspaces", err);
        router.push("/login");
      }
    }
    fetchWorkspaces();
  }, [router]);

  const handleWorkspaceChange = (id: string | null) => {
    if (!id) return;
    setActiveWorkspace(id);
    localStorage.setItem("activeWorkspaceId", id);
    toast({
      title: "Workspace Switched",
      description: `Active context changed to ${workspaces.find((w: any) => w.id === id)?.name || "selected workspace"}.`,
      variant: "success",
    });
    // Trigger global update event for page data reload
    window.dispatchEvent(new Event("data-updated"));
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+K or Ctrl+K triggers Command Palette
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        setIsCmdKOpen(prev => !prev);
      }

      // Cmd+B toggles sidebar
      const isCmdB = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b';
      if (isCmdB) {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWorkspace]);

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: Home },
    { name: "Timeline Log", href: "/dashboard/timeline", icon: Clock },
    { name: "Second Brain Chat", href: `/dashboard/chat?workspace=${activeWorkspace}`, icon: MessageSquare },
    { name: "Documents Hub", href: `/dashboard/documents?workspace=${activeWorkspace}`, icon: FileText },
    { name: "Knowledge Graph", href: "/dashboard/graph", icon: Network },
    { name: "Reflections", href: "/dashboard/beliefs", icon: BrainCircuit },
    { name: "Recommendations", href: "/dashboard/suggestions", icon: Lightbulb }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background transition-all duration-300">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: "0" }}
            exit={{ x: "-100%" }}
            className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col text-sidebar-foreground z-20 shrink-0"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          >
            <div className="p-5 border-b border-sidebar-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-base shadow-lg">J</div>
                  <h1 className="text-lg font-bold tracking-tight text-foreground">J.A.R.V.I.S.</h1>
                </div>
                <div className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                  v2.0
                </div>
              </div>
              <Select value={activeWorkspace} onValueChange={handleWorkspaceChange}>
                <SelectTrigger className="w-full bg-background/50 backdrop-blur-md border-white/10 h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Select Workspace" />
                </SelectTrigger>
                <SelectContent className="popover text-xs">
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <div className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest mb-3 px-2">Knowledge Base</div>
              {navItems.map((item) => {
                const isActive = pathname === item.href.split("?")[0];
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-200 ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-md'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </div>
                  </a>
                );
              })}
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-sidebar-border flex items-center justify-between text-xs text-sidebar-foreground/40 bg-black/10">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-semibold text-[10px]">Secure Sandbox</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCmdKOpen(true)}
                  type="button"
                  className="p-1.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/60 cursor-pointer"
                  title="Command Palette (Cmd+K)"
                >
                  <Command className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={toggleTheme}
                  type="button"
                  className="p-1.5 rounded-lg border border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/60 cursor-pointer"
                  title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Toggle Sidebar Button when collapsed */}
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed bottom-4 left-4 z-30 p-2.5 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md hover:bg-white/5 text-foreground cursor-pointer shadow-lg"
          title="Open Sidebar"
        >
          <Home className="w-4 h-4" />
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background/95 transition-all duration-300">
        <div className="p-6">{children}</div>
      </main>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {isCmdKOpen && (
          <CommandPalette
            navItems={navItems}
            onClose={() => setIsCmdKOpen(false)}
            onToggleTheme={toggleTheme}
            router={router}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Reusable Command Palette Component
function CommandPalette({
  navItems,
  onClose,
  onToggleTheme,
  router
}: {
  navItems: any[];
  onClose: () => void;
  onToggleTheme: () => void;
  router: any;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const filtered = navItems.filter(item =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black cursor-pointer"
        onClick={onClose}
      />

      {/* Palette Container */}
      <motion.div
        initial={{ scale: 0.95, y: -20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: -20, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative max-w-lg w-full bg-secondary/95 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col"
      >
        <div className="flex items-center gap-2 px-4 border-b border-white/10 h-12">
          <Search className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or page name..."
            className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder-muted-foreground focus:ring-0"
            autoFocus
          />
          <span className="text-[10px] border border-white/15 bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded font-mono">ESC</span>
        </div>

        <div className="p-2 max-h-[300px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No matches found.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
                className="w-full text-left flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 text-xs text-foreground font-medium transition-colors"
                type="button"
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="w-4 h-4 text-primary shrink-0" />
                  <span>{item.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">Jump</span>
              </button>
            ))
          )}

          {/* Quick Utility Actions */}
          <div className="border-t border-white/5 pt-1.5 mt-1.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold block px-2.5 py-1">Utilities</span>
            <button
              onClick={() => {
                onToggleTheme();
                onClose();
              }}
              className="w-full text-left flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 text-xs text-foreground font-medium transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-primary shrink-0" />
                <span>Toggle Visual Contrast Theme</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Switch</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}