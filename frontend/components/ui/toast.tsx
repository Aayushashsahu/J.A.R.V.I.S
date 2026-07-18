"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toast: (toast: Omit<Toast, "id">) => void;
  toasts: Toast[];
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ title, description, variant = "info", duration = 4000 }: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9) + "_" + Date.now();
    setToasts((prev) => [...prev, { id, title, description, variant, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, toasts, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-destructive shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-primary shrink-0" />,
};

const variants = {
  success: "border-green-500/20 bg-green-950/20 text-green-200",
  error: "border-destructive/20 bg-destructive/10 text-red-200",
  warning: "border-yellow-500/20 bg-yellow-950/20 text-yellow-200",
  info: "border-primary/20 bg-primary/10 text-blue-200",
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl ${
        variants[toast.variant || "info"]
      }`}
    >
      {icons[toast.variant || "info"]}
      <div className="flex-1 space-y-1">
        <h4 className="font-semibold text-sm leading-none text-foreground">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-xs text-muted-foreground leading-normal">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground/60 hover:text-foreground shrink-0 rounded-md transition-colors p-0.5 cursor-pointer"
        type="button"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
