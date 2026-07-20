"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { api } from "@/lib/api";
import { Sparkles, Loader2, Key, Mail, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error("Invalid credentials");
      
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#07070a] px-4 select-none relative overflow-hidden">
      
      {/* Decorative background visual elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[150px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-500/5 blur-[150px]" />

      <Card className="w-full max-w-[420px] bg-card/30 border-border/40 shadow-2xl glass-panel-elevated rounded-2xl relative z-10">
        
        <CardHeader className="text-center pt-8 pb-5">
          <div className="mx-auto w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold tracking-tight shadow-md mb-4 select-none">
            J
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">Welcome to J.A.R.V.I.S.</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">Industrial Knowledge Intelligence Platform</CardDescription>
        </CardHeader>

        <CardContent className="px-6 py-4">
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Email Address
              </label>
              <Input 
                type="email" 
                placeholder="name@company.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                disabled={loading}
                className="bg-secondary/25 border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20 rounded-xl h-10 text-xs"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                Password
              </label>
              <Input 
                type="password" 
                placeholder="••••••••"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                disabled={loading}
                className="bg-secondary/25 border-border/60 focus-visible:ring-1 focus-visible:ring-foreground/20 rounded-xl h-10 text-xs"
              />
            </div>

            {/* Error notifications */}
            {error && (
              <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-[11px] font-semibold flex items-center gap-2 animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl h-10 text-xs font-semibold tracking-tight shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Access Command Center
                </>
              )}
            </Button>
            
          </form>
        </CardContent>

        <CardFooter className="flex justify-center pb-8 pt-2">
          <p className="text-xs text-muted-foreground select-none">
            Don't have an account?{" "}
            <Link href="/register" className="text-foreground hover:underline font-semibold transition-all">
              Register Credentials
            </Link>
          </p>
        </CardFooter>

      </Card>
    </div>
  );
}
