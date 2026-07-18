import * as React from "react"
import { motion, type HTMLMotionProps } from "framer-motion"

export const Loader2 = () => {
  return (
    <motion.div
      className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
    />
  );
};

export const Loader3 = () => {
  return (
    <motion.div
      className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"
    />
  );
};

export const Loader4 = () => {
  return (
    <motion.div
      className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
    />
  );
};

export const SkeletonCircle = () => {
  return (
    <motion.div
      className="w-4 h-4 rounded-full bg-muted/20 animate-pulse"
    />
  );
};

export const SkeletonText = ({ width = "w-32" }: { width?: string }) => {
  return (
    <motion.div
      className={`h-4 rounded ${width} bg-muted/20 animate-pulse`}
    />
  );
};

export const SkeletonTextLine = ({ width = "w-full" }: { width?: string }) => {
  return (
    <motion.div
      className={`
        h-4 rounded ${width} 
        bg-gradient-to-r from-muted/20 via-muted/25 to-muted/30 
        bg-[length:200%_100%] 
        animate-shine
        `
      }
      style={{ backgroundSize: '200% 100%' }}
    />
  );
};

export const Shimmer = ({ className = "", ...props }: HTMLMotionProps<"div">) => {
  return (
    <motion.div
      className={`
        animate-shimmer
        ${className}
      `}
      {...props}
    />
  );
};
