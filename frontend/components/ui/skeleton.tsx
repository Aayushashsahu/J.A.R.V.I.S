import React from "react";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/20 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCircle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={`rounded-full shrink-0 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonCircle className="w-10 h-10" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[70%]" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 4, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
      <div className="flex border-b border-white/5 bg-white/5 p-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 mx-2" />
        ))}
      </div>
      <div className="divide-y divide-white/5 p-4 space-y-4">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex pt-2">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3 flex-1 mx-2" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
