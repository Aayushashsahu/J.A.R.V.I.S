"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { Loader2, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error("Invalid username or password");

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      toast({
        title: "Welcome back!",
        description: "Successfully authenticated to J.A.R.V.I.S.",
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Login failed",
        description: err.message || "Invalid credentials",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background relative overflow-hidden px-4">
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm space-y-6"
      >
        <Card className="border border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 pt-6 text-center space-y-2">
            <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
              <KeyRound className="w-5 h-5 animate-pulse" />
            </div>
            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
              J.A.R.V.I.S. Portal
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Connect to your industrial AI second brain
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="bg-background/40 border-white/10 h-10 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                  className="bg-background/40 border-white/10 h-10 text-xs rounded-lg"
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg leading-relaxed">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl text-xs font-semibold h-10 shadow-md flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-white/5 bg-black/10 py-3.5">
            <div className="text-[11px] text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary hover:underline font-semibold">
                Register
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}